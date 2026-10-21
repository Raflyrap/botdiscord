const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ChannelType,
  MessageFlags,
} = require('discord.js');

/**
 * Helper untuk menghapus seluruh channel & kategori di server
 */
async function wipeAllChannels(guild, { keepGeneral = false, interactionChannelId = null } = {}) {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let deletedCount = 0;

  // 1. Jika keepGeneral aktif, buat 1 channel #general baru terlebih dahulu
  let newGeneral = null;
  if (keepGeneral) {
    try {
      newGeneral = await guild.channels.create({
        name: 'general',
        type: ChannelType.GuildText,
        reason: 'Reset server /delete: channel general baru',
      });
      const infoEmbed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle('Server Berhasil Dibersihkan')
        .setDescription(
          `Seluruh kategori, channel teks, dan channel suara lama telah dihapus secara bersih.\n\n` +
          `Server sekarang sudah direset. Gunakan perintah **/setup** untuk memasang template baru kapan saja!`
        )
        .setTimestamp();
      await newGeneral.send({ embeds: [infoEmbed] }).catch(() => {});
    } catch (e) {
      console.warn('Gagal membuat channel general baru:', e.message);
    }
  }

  // 2. Hapus seluruh channel teks & suara (non-kategori), simpan interactionChannel untuk dihapus paling akhir
  for (const [, ch] of channels) {
    if (newGeneral && ch.id === newGeneral.id) continue;
    if (interactionChannelId && ch.id === interactionChannelId) continue;

    if (ch.type !== ChannelType.GuildCategory) {
      try {
        await ch.delete('Server wipe via /delete');
        deletedCount++;
      } catch (err) {
        console.warn(`Gagal menghapus channel ${ch.name}:`, err.message);
      }
    }
  }

  // 3. Hapus seluruh kategori
  for (const [, ch] of channels) {
    if (ch.type === ChannelType.GuildCategory) {
      try {
        await ch.delete('Server wipe via /delete');
        deletedCount++;
      } catch (err) {
        console.warn(`Gagal menghapus kategori ${ch.name}:`, err.message);
      }
    }
  }

  // 4. Terakhir, hapus interaction channel jika bukan channel general baru
  if (interactionChannelId && (!newGeneral || interactionChannelId !== newGeneral.id)) {
    const lastCh = channels.get(interactionChannelId) || (await guild.channels.fetch(interactionChannelId).catch(() => null));
    if (lastCh) {
      try {
        await lastCh.delete('Server wipe via /delete (final channel)');
        deletedCount++;
      } catch (err) {
        console.warn(`Gagal menghapus channel interaksi terakhir:`, err.message);
      }
    }
  }

  return { deletedCount, newGeneral };
}

/**
 * Helper untuk menghapus 1 kategori beserta seluruh channel di dalamnya
 */
async function deleteCategoryAndChildren(category) {
  let count = 0;
  const children = category.guild.channels.cache.filter((c) => c.parentId === category.id);
  for (const [, ch] of children) {
    try {
      await ch.delete('Kategori dihapus bersama isinya via /delete');
      count++;
    } catch (e) {
      console.warn(`Gagal hapus child channel ${ch.name}:`, e.message);
    }
  }
  try {
    await category.delete('Kategori dihapus via /delete');
    count++;
  } catch (e) {
    console.warn(`Gagal hapus kategori ${category.name}:`, e.message);
  }
  return count;
}

// Dialog Konfirmasi Penghapusan Total
function createConfirmWipeDialog(mode = 'semuanya', guildName = 'Server') {
  const isClean = mode === 'semua_plus_general';
  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setTitle('⚠️ KONFIRMASI PENGHAPUSAN TOTAL SERVER')
    .setDescription(
      `Perhatian! Kamu akan menghapus **SELURUH channel teks, channel suara, dan kategori** di **${guildName}**!\n\n` +
      (isClean
        ? `• **Mode**: Hapus Semuanya & Buat 1 Channel \`#general\` Baru.\n• Channel lama akan dihapus total, lalu disisakan 1 channel teks baru untuk mulai ulang.`
        : `• **Mode**: Hapus SEMUANYA Sampai **Kosong Total Melompong**.\n• Server akan benar-benar kosong tanpa channel sama sekali!`) +
      `\n\n**Tindakan ini permanen dan TIDAK BISA DIBATALKAN.** Apakah kamu benar-benar yakin?`
    )
    .setFooter({ text: 'Tekan tombol merah untuk konfirmasi eksekusi' })
    .setTimestamp();

  const confirmBtn = new ButtonBuilder()
    .setCustomId(isClean ? 'btn_delete_confirm_clean' : 'btn_delete_confirm_all')
    .setLabel(isClean ? 'Ya, Hapus Semua (Sisakan #general)' : 'Ya, Hapus SEMUA Sampai Kosong')
    .setStyle(ButtonStyle.Danger);

  const cancelBtn = new ButtonBuilder()
    .setCustomId('btn_delete_cancel')
    .setLabel('Batalkan')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);
  return { embeds: [embed], components: [row] };
}

// Dashboard Tampilan Utama /delete
function getDeleteDashboard(guild, currentChannel) {
  const parentCategory = currentChannel.parent;

  const embed = new EmbedBuilder()
    .setColor(0xed4245)
    .setAuthor({ name: 'FlyBot • Manajemen Penghapusan Channel', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle(`Pusat Penghapusan Channel  •  ${guild.name}`)
    .setDescription(
      `Pilih aksi penghapusan yang kamu inginkan:\n\n` +
      `**1. PENGHAPUSAN TOTAL (SEMUA KOSONG):**\n` +
      `• **Hapus SEMUANYA**: Menghapus seluruh kategori, channel teks, dan channel suara sampai kosong bersih total.\n` +
      `• **Hapus Semua + #general**: Menghapus seluruh channel lama dan membuat 1 channel \`#general\` bersih baru.\n\n` +
      `**2. PENGHAPUSAN 1 PER 1:**\n` +
      `• **Hapus Channel Ini**: Menghapus channel saat ini (<#${currentChannel.id}>).\n` +
      (parentCategory
        ? `• **Hapus Kategori Ini**: Menghapus kategori **${parentCategory.name}** beserta seluruh channel di dalamnya.\n\n`
        : '\n') +
      `*Pilih opsi di bawah untuk melanjutkan:*`
    )
    .setFooter({ text: `${guild.name} • Hanya Administrator yang dapat mengeksekusi` })
    .setTimestamp();

  const allBtn = new ButtonBuilder()
    .setCustomId('btn_delete_open_all')
    .setLabel('Hapus SEMUANYA (Kosong Total)')
    .setStyle(ButtonStyle.Danger);

  const cleanBtn = new ButtonBuilder()
    .setCustomId('btn_delete_open_clean')
    .setLabel('Hapus Semua & Sisakan #general')
    .setStyle(ButtonStyle.Primary);

  const thisChBtn = new ButtonBuilder()
    .setCustomId('btn_delete_current_direct')
    .setLabel(`Hapus Channel Ini (#${currentChannel.name})`)
    .setStyle(ButtonStyle.Secondary);

  const buttonRow = new ActionRowBuilder().addComponents(allBtn, cleanBtn, thisChBtn);

  const selectOptions = [
    {
      label: '⚠️ Hapus SEMUANYA Sampai Kosong Bersih',
      description: 'Menghapus total semua kategori & channel tanpa tersisa',
      value: 'semuanya',
    },
    {
      label: '🧹 Hapus SEMUANYA & Sisakan #general Baru',
      description: 'Menghapus semua channel & kategori lama, buat 1 #general baru',
      value: 'semua_plus_general',
    },
    {
      label: `🗑️ Hapus Channel Ini Saja (#${currentChannel.name})`,
      description: 'Menghapus hanya channel ini',
      value: 'this_channel',
    },
  ];

  if (parentCategory) {
    selectOptions.push({
      label: `📁 Hapus Kategori [${parentCategory.name.substring(0, 50)}]`,
      description: 'Menghapus kategori ini beserta seluruh channel di dalamnya',
      value: 'this_category',
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_delete_choice')
    .setPlaceholder('Pilih aksi penghapusan...')
    .addOptions(selectOptions);

  const menuRow = new ActionRowBuilder().addComponents(selectMenu);

  return { embeds: [embed], components: [buttonRow, menuRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('delete')
    .setDescription('Hapus channel & kategori server (pilihan 1 per 1 atau hapus semuanya sampai kosong)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Pilih mode: Semuanya atau 1 per 1 (Kosongkan untuk menu interaktif)')
        .setRequired(false)
        .addChoices(
          { name: '⚠️ Hapus SEMUANYA (Kosong Bersih Total)', value: 'semuanya' },
          { name: '🧹 Hapus SEMUANYA & Sisakan #general Baru', value: 'semua_plus_general' },
          { name: '🗑️ Hapus 1 Channel Saja', value: 'channel' },
          { name: '📁 Hapus 1 Kategori Beserta Isinya', value: 'kategori' }
        )
    )
    .addChannelOption((opt) =>
      opt
        .setName('target_channel')
        .setDescription('Pilih channel yang ingin dihapus (jika mode: 1 Channel)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('target_kategori')
        .setDescription('Pilih kategori yang ingin dihapus beserta isinya (jika mode: Kategori)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Owner Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const mode = interaction.options.getString('mode');
    const targetChannel = interaction.options.getChannel('target_channel');
    const targetCategory = interaction.options.getChannel('target_kategori');

    // 1. Mode: Hapus SEMUANYA (Butuh konfirmasi)
    if (mode === 'semuanya' || mode === 'semua_plus_general') {
      const dialog = createConfirmWipeDialog(mode, interaction.guild.name);
      return interaction.reply({ ...dialog, flags: MessageFlags.Ephemeral });
    }

    // 2. Mode: Hapus 1 Channel
    if (mode === 'channel') {
      const chToDelete = targetChannel || interaction.channel;
      const chName = chToDelete.name;
      const isCurrent = chToDelete.id === interaction.channel.id;

      if (isCurrent) {
        await interaction.reply({
          content: `🗑️ Menghapus channel **#${chName}** dalam beberapa detik...`,
          flags: MessageFlags.Ephemeral,
        });
        setTimeout(async () => {
          await chToDelete.delete('Dihapus via /delete').catch(console.error);
        }, 1500);
        return;
      } else {
        await chToDelete.delete('Dihapus via /delete');
        return interaction.reply({
          content: `✅ Channel **#${chName}** telah berhasil dihapus.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // 3. Mode: Hapus 1 Kategori
    if (mode === 'kategori') {
      const catToDelete = targetCategory || (interaction.channel.parent ? interaction.channel.parent : null);
      if (!catToDelete) {
        return interaction.reply({
          content: '⚠️ Harap pilih parameter `target_kategori` yang ingin dihapus!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const deletedCount = await deleteCategoryAndChildren(catToDelete);
      return interaction.editReply({
        content: `✅ Kategori **${catToDelete.name}** dan seluruh isinya (${deletedCount} item) telah berhasil dihapus secara bersih.`,
      });
    }

    // 4. Jika tanpa opsi parameter: Tampilkan Dashboard Interaktif
    const dashboard = getDeleteDashboard(interaction.guild, interaction.channel);
    const replyMsg = await interaction.reply({
      ...dashboard,
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    // Pasang Collector untuk merespons tombol & dropdown
    const collector = replyMsg.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 180000, // 3 menit
    });

    collector.on('collect', async (i) => {
      // 1. Buka Dialog Konfirmasi Wipe
      if (i.customId === 'btn_delete_open_all' || (i.customId === 'menu_delete_choice' && i.values[0] === 'semuanya')) {
        const dialog = createConfirmWipeDialog('semuanya', interaction.guild.name);
        return i.update(dialog);
      }

      if (i.customId === 'btn_delete_open_clean' || (i.customId === 'menu_delete_choice' && i.values[0] === 'semua_plus_general')) {
        const dialog = createConfirmWipeDialog('semua_plus_general', interaction.guild.name);
        return i.update(dialog);
      }

      // 2. Batalkan
      if (i.customId === 'btn_delete_cancel') {
        return i.update({
          content: '❌ Penghapusan dibatalkan. Tidak ada channel yang dihapus.',
          embeds: [],
          components: [],
        });
      }

      // 3. Konfirmasi Hapus SEMUANYA (Kosong Total)
      if (i.customId === 'btn_delete_confirm_all') {
        await i.update({
          content: '⏳ **Sedang menghapus SELURUH channel dan kategori...** Server akan kosong bersih.',
          embeds: [],
          components: [],
        });

        // Kirim DM pemberitahuan ke user
        await i.user.send(`⏳ Sedang membersihkan total seluruh channel di server **${interaction.guild.name}**...`).catch(() => {});

        const { deletedCount } = await wipeAllChannels(interaction.guild, {
          keepGeneral: false,
          interactionChannelId: interaction.channel.id,
        });

        await i.user.send(`✅ **Server Reset Selesai!** Seluruh channel dan kategori (${deletedCount} total) di **${interaction.guild.name}** telah dihapus bersih. Server sekarang kosong melompong.`).catch(() => {});
        return;
      }

      // 4. Konfirmasi Hapus SEMUANYA (Sisakan #general)
      if (i.customId === 'btn_delete_confirm_clean') {
        await i.update({
          content: '⏳ **Sedang mereset server...** Menghapus semua channel lama dan membuat 1 channel #general baru.',
          embeds: [],
          components: [],
        });

        await i.user.send(`⏳ Sedang mereset server **${interaction.guild.name}**...`).catch(() => {});

        const { deletedCount, newGeneral } = await wipeAllChannels(interaction.guild, {
          keepGeneral: true,
          interactionChannelId: interaction.channel.id,
        });

        await i.user.send(`✅ **Reset Selesai!** ${deletedCount} channel & kategori lama telah dihapus. Channel baru <#${newGeneral?.id}> telah siap di **${interaction.guild.name}**. Ketik \`/setup\` kapan saja untuk memasang template baru!`).catch(() => {});
        return;
      }

      // 5. Hapus Channel Saat Ini Saja
      if (i.customId === 'btn_delete_current_direct' || (i.customId === 'menu_delete_choice' && i.values[0] === 'this_channel')) {
        await i.update({
          content: `🗑️ Menghapus channel **#${interaction.channel.name}** dalam beberapa detik...`,
          embeds: [],
          components: [],
        });
        setTimeout(async () => {
          await interaction.channel.delete('Dihapus via /delete').catch(console.error);
        }, 1500);
        return;
      }

      // 6. Hapus Kategori Saat Ini Beserta Isinya
      if (i.customId === 'menu_delete_choice' && i.values[0] === 'this_category') {
        const parentCategory = interaction.channel.parent;
        if (!parentCategory) {
          return i.update({
            content: '⚠️ Channel ini tidak berada di dalam kategori.',
            embeds: [],
            components: [],
          });
        }
        await i.update({
          content: `⏳ Menghapus kategori **${parentCategory.name}** beserta seluruh isinya...`,
          embeds: [],
          components: [],
        });
        const count = await deleteCategoryAndChildren(parentCategory);
        await i.user.send(`✅ Kategori **${parentCategory.name}** beserta isinya (${count} item) di server **${interaction.guild.name}** telah berhasil dihapus.`).catch(() => {});
      }
    });
  },

  wipeAllChannels,
  deleteCategoryAndChildren,
};
