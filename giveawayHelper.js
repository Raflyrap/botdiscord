const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const DATA_PATH = path.join(__dirname, 'giveawayData.json');

// Membaca data giveaway
function loadGiveawayData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8') || '{}');
  } catch {
    return {};
  }
}

// Menyimpan data giveaway
function saveGiveawayData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat menyimpan giveawayData.json:', err.message);
  }
}

function getGiveaway(guildId) {
  const data = loadGiveawayData();
  return data[guildId] || null;
}

function setGiveaway(guildId, updates) {
  const data = loadGiveawayData();
  data[guildId] = { ...(data[guildId] || {}), ...updates };
  saveGiveawayData(data);
  return data[guildId];
}

// Membangun Embed Panel Giveaway Publik (Tanpa Emoji, Tanpa Jumlah/Daftar Peserta)
function createGiveawayEmbed(data, guild) {
  const winnersCount = data.winnersCount || 1;
  const isEnded = data.status === 'ended';
  const prize = data.prize || 'Discord Nitro / Hadiah Spesial';
  const desc = data.description || 'Klik tombol "Ikut Giveaway" di bawah untuk berpartisipasi!';

  let winnerText = 'Belum diundi';
  if (isEnded && data.winners && data.winners.length > 0) {
    winnerText = data.winners.map((id) => `<@${id}>`).join(', ');
  }

  const embed = new EmbedBuilder()
    .setColor(isEnded ? 0x57F287 : 0x5865F2)
    .setAuthor({
      name: `${guild.name} • Giveaway Resmi`,
      iconURL: guild.iconURL() || guild.client.user.displayAvatarURL(),
    })
    .setTitle(`GIVEAWAY: ${prize}`)
    .setDescription(
      `${desc}\n\n` +
      `**Informasi Giveaway:**\n` +
      `> • Kuota Pemenang: **${winnersCount} Pemenang**\n` +
      `> • Status: **${isEnded ? 'Selesai (Sudah Diundi)' : 'Sedang Berlangsung'}**\n` +
      (isEnded ? `> • Pemenang: ${winnerText}\n` : '')
    )
    .setFooter({
      text: isEnded
        ? 'Giveaway telah berakhir. Nantikan sesi giveaway berikutnya.'
        : 'Klik tombol di bawah untuk bergabung dalam giveaway.',
    })
    .setTimestamp();

  return embed;
}

// Membangun ActionRow Tombol Publik (HANYA 1 TOMBOL IKUT GIVEAWAY, TANPA EMOJI, TANPA ANGKA)
function createGiveawayRows(data) {
  const isEnded = data.status === 'ended';

  const joinBtn = new ButtonBuilder()
    .setCustomId('btn_giveaway_join')
    .setLabel('Ikut Giveaway')
    .setStyle(isEnded ? ButtonStyle.Secondary : ButtonStyle.Success)
    .setDisabled(isEnded);

  return [new ActionRowBuilder().addComponents(joinBtn)];
}

// Membangun ActionRow Tombol Kontrol Khusus Admin / Owner (Privat Ephemeral)
function createAdminGiveawayRows(participantsCount = 0) {
  const editBtn = new ButtonBuilder()
    .setCustomId('btn_giveaway_edit')
    .setLabel('Edit Hadiah')
    .setStyle(ButtonStyle.Secondary);

  const listBtn = new ButtonBuilder()
    .setCustomId('btn_giveaway_list')
    .setLabel(`List Peserta (${participantsCount})`)
    .setStyle(ButtonStyle.Primary);

  const startBtn = new ButtonBuilder()
    .setCustomId('btn_giveaway_start')
    .setLabel('Mulai Gacha')
    .setStyle(ButtonStyle.Success);

  const resetBtn = new ButtonBuilder()
    .setCustomId('btn_giveaway_reset')
    .setLabel('Reset')
    .setStyle(ButtonStyle.Danger);

  return new ActionRowBuilder().addComponents(editBtn, listBtn, startBtn, resetBtn);
}

// Setup channel giveaway untuk guild tertentu
async function setupGiveawayChannel(guild, targetChannel = null) {
  let channel = targetChannel;

  if (!channel) {
    const { getOrCreateChannel } = require('./templateSetupHelper');
    // Cari kategori Official atau Event atau buat baru
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
    let category = channels.find(
      (c) => c.type === ChannelType.GuildCategory && (c.name.includes('Official') || c.name.includes('OFFICIAL') || c.name.includes('FITUR FLYBOT'))
    );

    if (!category) {
      category = await guild.channels.create({
        name: '───────Official───────',
        type: ChannelType.GuildCategory,
      });
    }

    channel = await getOrCreateChannel(guild, {
      name: '🎉︱giveaway',
      type: ChannelType.GuildText,
      parentId: category.id,
      topic: 'Channel resmi penyelenggaraan giveaway dan event berhadiah server!',
    });
  }

  const existingData = getGiveaway(guild.id) || {
    prize: 'Discord Nitro / Hadiah Spesial',
    description: 'Klik tombol "Ikut Giveaway" di bawah untuk mendaftarkan diri kamu dalam undian!',
    winnersCount: 1,
    participants: [],
    status: 'active',
  };

  const embed = createGiveawayEmbed(existingData, guild);
  const rows = createGiveawayRows(existingData);

  const sentMsg = await channel.send({ embeds: [embed], components: rows });

  setGiveaway(guild.id, {
    ...existingData,
    channelId: channel.id,
    messageId: sentMsg.id,
  });

  return { channel, message: sentMsg };
}

// Pastikan channel giveaway otomatis muncul di Server Official dan memperbarui panel tombol
async function ensureOfficialGiveawayChannel(client) {
  try {
    const officialGuildId = process.env.OFFICIAL_GUILD_ID || '1563902604394627074';
    const officialGuild = client.guilds.cache.get(officialGuildId) || (await client.guilds.fetch(officialGuildId).catch(() => null));
    if (!officialGuild) return;

    let currentGw = getGiveaway(officialGuild.id);
    let channel = null;

    if (currentGw?.channelId) {
      channel = officialGuild.channels.cache.get(currentGw.channelId) || (await officialGuild.channels.fetch(currentGw.channelId).catch(() => null));
    }

    if (!channel) {
      channel = officialGuild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && (c.name.includes('giveaway') || c.name.includes('event'))
      );
    }

    if (!channel) {
      await setupGiveawayChannel(officialGuild);
      console.log('[GIVEAWAY] Berhasil membuat channel #giveaway otomatis di Server Official.');
      return;
    }

    // Jika channel sudah ada, perbarui pesan panel giveaway agar tombol dan formatnya langsung 1 tombol
    if (!currentGw) {
      currentGw = {
        prize: 'Discord Nitro / Hadiah Spesial',
        description: 'Klik tombol di bawah untuk bergabung dalam giveaway.',
        winnersCount: 1,
        participants: [],
        status: 'active',
      };
    }

    let updatedMessage = false;
    if (currentGw?.messageId) {
      try {
        const msg = await channel.messages.fetch(currentGw.messageId).catch(() => null);
        if (msg) {
          await msg.edit({
            embeds: [createGiveawayEmbed(currentGw, officialGuild)],
            components: createGiveawayRows(currentGw),
          });
          updatedMessage = true;
        }
      } catch (_) {}
    }

    if (!updatedMessage) {
      const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      const botMsg = messages?.find((m) => m.author.id === client.user.id && m.components.length > 0);
      if (botMsg) {
        await botMsg.edit({
          embeds: [createGiveawayEmbed(currentGw, officialGuild)],
          components: createGiveawayRows(currentGw),
        }).catch(() => {});
        setGiveaway(officialGuild.id, {
          ...currentGw,
          channelId: channel.id,
          messageId: botMsg.id,
        });
      } else {
        const sentMsg = await channel.send({
          embeds: [createGiveawayEmbed(currentGw, officialGuild)],
          components: createGiveawayRows(currentGw),
        }).catch(() => null);
        if (sentMsg) {
          setGiveaway(officialGuild.id, {
            ...currentGw,
            channelId: channel.id,
            messageId: sentMsg.id,
          });
        }
      }
    }
  } catch (err) {
    console.error('[GIVEAWAY] Error saat memastikan channel Server Official:', err.message);
  }
}

// Handler Tombol: Ikut Giveaway
async function handleGiveawayJoin(interaction) {
  const gw = getGiveaway(interaction.guildId);
  if (!gw) {
    return interaction.reply({
      content: 'Data giveaway tidak ditemukan.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (gw.status === 'ended') {
    return interaction.reply({
      content: 'Giveaway ini telah berakhir. Nantikan sesi giveaway berikutnya.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const participants = gw.participants || [];
  const userId = interaction.user.id;
  const isAlreadyJoined = participants.includes(userId);
  const isAdmin = isGiveawayAdmin(interaction);

  let statusMsg = '';
  if (isAlreadyJoined) {
    gw.participants = participants.filter((id) => id !== userId);
    statusMsg = 'Kamu telah membatalkan keikutsertaan dalam giveaway ini.';
  } else {
    gw.participants.push(userId);
    statusMsg = 'Selamat, kamu berhasil terdaftar dalam giveaway ini.';
  }
  setGiveaway(interaction.guildId, { participants: gw.participants });

  // Khusus Admin/Owner: Tampilkan panel kontrol privat beserta jumlah peserta rahasia
  if (isAdmin) {
    const adminEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Panel Kontrol Giveaway (Khusus Owner / Admin)')
      .setDescription(
        `${statusMsg}\n\n` +
        `**Informasi Peserta Rahasia:**\n` +
        `> • Total Peserta Saat Ini: **${gw.participants.length} Orang**\n` +
        `> • Status: **${gw.status === 'ended' ? 'Selesai' : 'Sedang Berlangsung'}**\n\n` +
        `Gunakan tombol di bawah untuk mengelola giveaway:`
      );

    const adminRow = createAdminGiveawayRows(gw.participants.length);
    return interaction.reply({
      embeds: [adminEmbed],
      components: [adminRow],
      flags: MessageFlags.Ephemeral,
    });
  }

  // Member biasa: Hanya notifikasi status sederhana, tanpa tombol admin & tanpa info peserta lain
  return interaction.reply({
    content: statusMsg,
    flags: MessageFlags.Ephemeral,
  });
}

// Helper: Cek hak akses admin/owner
function isGiveawayAdmin(interaction) {
  return (
    interaction.guild?.ownerId === interaction.user.id ||
    interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
  );
}

// Handler Tombol: Edit Giveaway (Tampilkan Modal)
async function handleGiveawayEditButton(interaction) {
  if (!isGiveawayAdmin(interaction)) {
    return interaction.reply({
      content: 'Hanya Administrator atau Owner server yang dapat mengedit giveaway!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const gw = getGiveaway(interaction.guildId) || {};

  const modal = new ModalBuilder()
    .setCustomId('modal_giveaway_edit')
    .setTitle('Edit Pengaturan Giveaway');

  const prizeInput = new TextInputBuilder()
    .setCustomId('gw_prize')
    .setLabel('Hadiah Giveaway')
    .setStyle(TextInputStyle.Short)
    .setValue(gw.prize || 'Discord Nitro 1 Bulan')
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('gw_desc')
    .setLabel('Deskripsi & Syarat Giveaway')
    .setStyle(TextInputStyle.Paragraph)
    .setValue(gw.description || 'Klik tombol "Ikut Giveaway" di bawah untuk mendaftar!')
    .setRequired(false);

  const winnersInput = new TextInputBuilder()
    .setCustomId('gw_winners')
    .setLabel('Jumlah Pemenang (1 - 10)')
    .setStyle(TextInputStyle.Short)
    .setValue(String(gw.winnersCount || 1))
    .setMaxLength(2)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prizeInput),
    new ActionRowBuilder().addComponents(descInput),
    new ActionRowBuilder().addComponents(winnersInput)
  );

  return interaction.showModal(modal);
}

// Handler Submit Modal Edit Giveaway
async function handleGiveawayEditSubmit(interaction) {
  if (!isGiveawayAdmin(interaction)) {
    return interaction.reply({
      content: 'Hanya Administrator atau Owner server yang dapat mengedit giveaway!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const prize = interaction.fields.getTextInputValue('gw_prize').trim();
  const description = interaction.fields.getTextInputValue('gw_desc').trim();
  const winnersCountRaw = parseInt(interaction.fields.getTextInputValue('gw_winners').trim(), 10) || 1;
  const winnersCount = Math.max(1, Math.min(winnersCountRaw, 20));

  const gw = getGiveaway(interaction.guildId) || { participants: [] };
  gw.prize = prize;
  gw.description = description;
  gw.winnersCount = winnersCount;
  gw.status = 'active';

  setGiveaway(interaction.guildId, gw);

  // Perbarui pesan panel di channel publik
  if (gw.channelId && gw.messageId) {
    try {
      const ch = interaction.guild.channels.cache.get(gw.channelId) || await interaction.guild.channels.fetch(gw.channelId).catch(() => null);
      if (ch) {
        const msg = await ch.messages.fetch(gw.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [createGiveawayEmbed(gw, interaction.guild)], components: createGiveawayRows(gw) });
        }
      }
    } catch (_) {}
  }

  const adminEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Pengaturan Giveaway Berhasil Diperbarui')
    .setDescription(
      `Pengaturan giveaway publik telah diperbarui.\n\n` +
      `• Hadiah: **${prize}**\n` +
      `• Kuota Pemenang: **${winnersCount} Orang**\n` +
      `• Total Peserta Rahasia: **${gw.participants.length} Orang**`
    );

  return interaction.reply({
    embeds: [adminEmbed],
    components: [createAdminGiveawayRows(gw.participants.length)],
    flags: MessageFlags.Ephemeral,
  });
}

// Handler Tombol: List Peserta
async function handleGiveawayList(interaction) {
  if (!isGiveawayAdmin(interaction)) {
    return interaction.reply({
      content: 'Hanya Administrator atau Owner server yang dapat melihat daftar peserta!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const gw = getGiveaway(interaction.guildId);
  const participants = gw?.participants || [];

  if (participants.length === 0) {
    return interaction.reply({
      content: 'Belum ada peserta yang mengikuti giveaway ini.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const listMentions = participants.slice(0, 50).map((id, idx) => `${idx + 1}. <@${id}>`).join('\n');
  const remaining = participants.length > 50 ? `\n...dan ${participants.length - 50} peserta lainnya.` : '';

  return interaction.reply({
    content: `**Daftar Peserta Giveaway (${participants.length} Orang):**\n${listMentions}${remaining}`,
    flags: MessageFlags.Ephemeral,
  });
}

// Handler Tombol: Mulai Gacha Undian Pemenang
async function handleGiveawayStart(interaction) {
  if (!isGiveawayAdmin(interaction)) {
    return interaction.reply({
      content: 'Hanya Administrator atau Owner server yang dapat mengundi giveaway!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const gw = getGiveaway(interaction.guildId);
  const participants = gw?.participants || [];

  if (participants.length === 0) {
    return interaction.reply({
      content: 'Belum ada peserta yang bergabung dalam giveaway ini. Tidak dapat melakukan pengundian.',
      flags: MessageFlags.Ephemeral,
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Acak pemenang
  const shuffled = [...participants].sort(() => Math.random() - 0.5);
  const winnersCount = Math.min(gw.winnersCount || 1, participants.length);
  const winners = shuffled.slice(0, winnersCount);

  gw.winners = winners;
  gw.status = 'ended';
  setGiveaway(interaction.guildId, gw);

  // Perbarui pesan panel di channel publik
  if (gw.channelId && gw.messageId) {
    try {
      const ch = interaction.guild.channels.cache.get(gw.channelId) || await interaction.guild.channels.fetch(gw.channelId).catch(() => null);
      if (ch) {
        const msg = await ch.messages.fetch(gw.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [createGiveawayEmbed(gw, interaction.guild)], components: createGiveawayRows(gw) });
        }
      }
    } catch (_) {}
  }

  // Kirim pengumuman di channel publik
  const winnerTags = winners.map((id) => `<@${id}>`).join(' ');
  const announceEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('SELAMAT KEPADA PEMENANG GIVEAWAY!')
    .setDescription(
      `Selamat kepada: ${winnerTags}\n\n` +
      `Kalian memenangkan: **${gw.prize || 'Hadiah Spesial'}**!\n\n` +
      `Silakan hubungi Administrator / Penyelenggara (<@${interaction.user.id}>) untuk mengklaim hadiah kamu.`
    )
    .setFooter({ text: 'FlyBot Official Giveaway System' })
    .setTimestamp();

  // Kirim ke channel giveaway tempat panel berada
  const targetChannel = interaction.guild.channels.cache.get(gw.channelId) || interaction.channel;
  if (targetChannel && typeof targetChannel.send === 'function') {
    await targetChannel.send({
      content: `Selamat ${winnerTags}!`,
      embeds: [announceEmbed],
    }).catch(() => {});
  }

  await interaction.editReply({
    content: `Pengundian berhasil selesai. Pemenang: ${winnerTags}`,
  });

  // Kirim DM otomatis ke setiap pemenang
  for (const winnerId of winners) {
    try {
      const winnerUser = await interaction.client.users.fetch(winnerId);
      await winnerUser.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('SELAMAT! KAMU MEMENANGKAN GIVEAWAY!')
            .setDescription(
              `Hai <@${winnerId}>! Kamu telah terpilih sebagai pemenang dalam giveaway **${gw.prize || 'Hadiah Spesial'}** di server **${interaction.guild.name}**!\n\n` +
              `Silakan segera hubungi Administrator / Owner server (<@${interaction.user.id}>) untuk mengklaim hadiahmu.`
            )
            .setFooter({ text: `${interaction.guild.name} • FlyBot Giveaway` })
            .setTimestamp(),
        ],
      });
    } catch (dmErr) {
      console.warn(`[GIVEAWAY DM] Gagal kirim DM ke ${winnerId}:`, dmErr.message);
    }
  }
}

// Handler Tombol: Reset Giveaway
async function handleGiveawayReset(interaction) {
  if (!isGiveawayAdmin(interaction)) {
    return interaction.reply({
      content: 'Hanya Administrator atau Owner server yang dapat mereset giveaway!',
      flags: MessageFlags.Ephemeral,
    });
  }

  const gw = getGiveaway(interaction.guildId) || {};
  gw.participants = [];
  gw.winners = [];
  gw.status = 'active';

  setGiveaway(interaction.guildId, gw);

  // Perbarui pesan panel di channel publik
  if (gw.channelId && gw.messageId) {
    try {
      const ch = interaction.guild.channels.cache.get(gw.channelId) || await interaction.guild.channels.fetch(gw.channelId).catch(() => null);
      if (ch) {
        const msg = await ch.messages.fetch(gw.messageId).catch(() => null);
        if (msg) {
          await msg.edit({ embeds: [createGiveawayEmbed(gw, interaction.guild)], components: createGiveawayRows(gw) });
        }
      }
    } catch (_) {}
  }

  const adminEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('Giveaway Berhasil Direset')
    .setDescription('Daftar peserta telah dikosongkan (0 Peserta) dan sesi giveaway baru telah dibuka kembali.');

  return interaction.update({
    embeds: [adminEmbed],
    components: [createAdminGiveawayRows(0)],
  });
}

module.exports = {
  loadGiveawayData,
  saveGiveawayData,
  getGiveaway,
  setGiveaway,
  createGiveawayEmbed,
  createGiveawayRows,
  createAdminGiveawayRows,
  isGiveawayAdmin,
  setupGiveawayChannel,
  ensureOfficialGiveawayChannel,
  handleGiveawayJoin,
  handleGiveawayEditButton,
  handleGiveawayEditSubmit,
  handleGiveawayList,
  handleGiveawayStart,
  handleGiveawayReset,
};

