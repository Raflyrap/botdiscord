const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
  ComponentType,
} = require('discord.js');

const {
  setupWelcomeAndLeave,
  setupVerification,
  setupGames,
  setupSupportTicket,
  setupServerStats,
  setupVoiceHub,
  setupAuditLogServer,
  setupHdStudio,
  setupAll,
} = require('../setupHelper');

// Helper untuk membangun Embed hasil setup
function createResultEmbed(featureKey, result, guild) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({ name: `${guild.name} • Setup Server`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  if (featureKey === 'welcome') {
    embed
      .setTitle('Setup Welcome & Leave Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel notifikasi telah berhasil disiapkan:\n\n` +
        `• Channel Welcome: <#${result.welcomeChannel.id}>\n` +
        `• Channel Leave: <#${result.leaveChannel.id}>\n\n` +
        `Bot akan otomatis mengirimkan kartu sambutan visual setiap ada member baru yang bergabung dan log saat member keluar.`
      );
  } else if (featureKey === 'verif') {
    embed
      .setTitle('Setup Verifikasi Server Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan panel verifikasi telah siap digunakan:\n\n` +
        `• Channel Verifikasi: <#${result.channel.id}>\n` +
        `• Role Member: ${result.role ? `<@&${result.role.id}>` : '@Member'}\n` +
        `• Status Kunci: ${result.lockedCount} channel telah disembunyikan dari member belum verifikasi.\n\n` +
        `Member baru hanya perlu menekan tombol hijau di <#${result.channel.id}> untuk otomatis membuka seluruh channel server.`
      );
  } else if (featureKey === 'game') {
    embed
      .setTitle('Setup Arena Mini Games Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan 3 arena permainan interaktif telah siap:\n\n` +
        `• <#${result.coinChannel.id}> — Tebak Koin (Gambar / Angka)\n` +
        `• <#${result.numberChannel.id}> — Tebak Angka (1 - 100)\n` +
        `• <#${result.rpsChannel.id}> — Suit (Gunting Batu Kertas)\n\n` +
        `Setiap channel sudah dilengkapi petunjuk permanen dan tombol bermain berhadiah Koin & XP.`
      );
  } else if (featureKey === 'ticket') {
    embed
      .setTitle('Setup Tiket Bantuan / Support Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel panel telah siap:\n\n` +
        `• Channel Panel: <#${result.channel.id}>\n\n` +
        `Member tinggal mengklik tombol **Buat Tiket** di <#${result.channel.id}> untuk membuka channel privat bersama staff.`
      );
  } else if (featureKey === 'stats') {
    embed
      .setTitle('Setup Statistik Server Realtime Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan 3 voice channel counter realtime telah dibuat di posisi teratas:\n\n` +
        `• <#${result.memberChannel.id}>\n` +
        `• <#${result.adminChannel.id}>\n` +
        `• <#${result.activeChannel.id}>\n\n` +
        `Channel counter terkunci otomatis (hanya baca) dan angkanya diperbarui secara realtime.`
      );
  } else if (featureKey === 'voice') {
    embed
      .setTitle('Setup Voice Hub (Join-to-Create) Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan voice hub telah aktif:\n\n` +
        `• Voice Trigger: <#${result.hubChannel.id}>\n` +
        (result.textChat ? `• Companion Text: <#${result.textChat.id}>\n\n` : '\n') +
        `Setiap member yang masuk ke <#${result.hubChannel.id}> akan **otomatis dibuatkan voice room pribadi**, dan channel akan otomatis terhapus saat sudah kosong.`
      );
  } else if (featureKey === 'log') {
    embed
      .setTitle('Setup Audit Log Server Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel rahasia <#${result.channel.id}> telah siap.\n\n` +
        `Channel dikunci otomatis hanya untuk Administrator, mencatat:\n` +
        `• Pesan terhapus & diedit\n` +
        `• Riwayat member keluar\n` +
        `• Perubahan role member`
      );
  } else if (featureKey === 'hd') {
    embed
      .setTitle('Setup Studio Auto-HD Foto Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel <#${result.hdChannel.id}> telah siap.\n\n` +
        `Setiap foto yang dikirimkan di channel tersebut akan **otomatis di-HD-kan** (2x / 4x HD) oleh bot tanpa perlu perintah manual.`
      );
  } else if (featureKey === 'all') {
    const lines = [];
    if (result.welcome) lines.push(`• **Welcome & Leave**: <#${result.welcome.welcomeChannel.id}> & <#${result.welcome.leaveChannel.id}>`);
    if (result.verif) lines.push(`• **Verifikasi**: <#${result.verif.channel.id}> (${result.verif.role ? `<@&${result.verif.role.id}>` : '@Member'})`);
    if (result.game) lines.push(`• **Mini Games**: <#${result.game.coinChannel.id}>, <#${result.game.numberChannel.id}>, <#${result.game.rpsChannel.id}>`);
    if (result.ticket) lines.push(`• **Tiket Support**: <#${result.ticket.channel.id}>`);
    if (result.stats) lines.push(`• **Server Stats**: <#${result.stats.memberChannel.id}>, <#${result.stats.adminChannel.id}>, <#${result.stats.activeChannel.id}>`);
    if (result.voice) lines.push(`• **Voice Hub**: <#${result.voice.hubChannel.id}>`);
    if (result.log) lines.push(`• **Audit Log**: <#${result.log.channel.id}>`);
    if (result.hd) lines.push(`• **Studio HD**: <#${result.hd.hdChannel.id}>`);

    embed
      .setTitle('🚀 Seluruh Setup Server Berhasil Dijalankan (All-in-One)')
      .setDescription(
        `Semua kategori, channel teks, channel suara (voice), role, permission, dan panel otomatis telah selesai dibuat dan langsung aktif:\n\n` +
        lines.join('\n') +
        `\n\n✅ Seluruh fitur sudah terhubung dan berfungsi normal 100%! Server kamu sekarang siap digunakan secara profesional.`
      );

    if (result.errors && result.errors.length > 0) {
      embed.addFields({
        name: 'Catatan Kendala',
        value: result.errors.join('\n'),
      });
    }
  }

  return embed;
}

// Fungsi eksekutor setup
async function executeSetupAction(featureKey, guild) {
  switch (featureKey) {
    case 'welcome':
      return await setupWelcomeAndLeave(guild);
    case 'verif':
      return await setupVerification(guild);
    case 'game':
      return await setupGames(guild);
    case 'ticket':
      return await setupSupportTicket(guild);
    case 'stats':
      return await setupServerStats(guild);
    case 'voice':
      return await setupVoiceHub(guild);
    case 'log':
      return await setupAuditLogServer(guild);
    case 'hd':
      return await setupHdStudio(guild);
    case 'all':
    default:
      return await setupAll(guild);
  }
}

// Dashboard Tampilan Utama /setup
function getSetupDashboard(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: 'FlyBot • Pusat Setup Otomatis', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle(`Pusat Setup Server  •  ${guild.name}`)
    .setDescription(
      `Pilih setup fitur yang kamu inginkan di bawah ini.\n` +
      `Kamu bisa memilih **Setup 1 per 1** atau langsung **Setup Semua Sekaligus** (All-in-One).\n\n` +
      `**Daftar Fitur Yang Akan Dibuat Otomatis:**\n` +
      `• **Welcome & Leave** — Kategori & 2 channel sambutan/keluar\n` +
      `• **Verifikasi Server** — Kategori, channel verif, role @Member, panel tombol & lockdown\n` +
      `• **Arena Mini Games** — Kategori & 3 channel game (Koin, Angka, Suit)\n` +
      `• **Tiket Support** — Kategori SUPPORT & channel panel tiket bantuan privat\n` +
      `• **Statistik Server** — Kategori & 3 voice channel counter realtime teratas\n` +
      `• **Voice Hub** — Kategori & voice channel Join-to-Create room otomatis\n` +
      `• **Audit Log Server** — Kategori & channel log rahasia admin\n` +
      `• **Studio HD Foto** — Kategori & channel auto upscale gambar ke HD\n\n` +
      `*Pilih tombol hijau untuk langsung membuat semua, atau gunakan dropdown untuk memilih satu per satu:*`
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || guild.client.user.displayAvatarURL())
    .setFooter({ text: `${guild.name} • Pengelola Server FlyBot` })
    .setTimestamp();

  const allBtn = new ButtonBuilder()
    .setCustomId('btn_setup_run_all')
    .setLabel('Setup Semua Sekarang (All-in-One)')
    .setStyle(ButtonStyle.Success);

  const buttonRow = new ActionRowBuilder().addComponents(allBtn);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_setup_select')
    .setPlaceholder('Pilih fitur setup (1 per 1 atau Semua)...')
    .addOptions([
      {
        label: 'Setup Semua Fitur (All-in-One)',
        description: 'Buat seluruh kategori, channel text/voice, role & panel sekaligus',
        value: 'all',
      },
      {
        label: 'Welcome & Leave',
        description: 'Kategori & channel sambutan member baru serta log keluar',
        value: 'welcome',
      },
      {
        label: 'Verifikasi Server',
        description: 'Kategori, channel verifikasi, role @Member & tombol verif',
        value: 'verif',
      },
      {
        label: 'Arena Mini Games',
        description: 'Kategori & 3 channel tebak koin, angka & suit jepang',
        value: 'game',
      },
      {
        label: 'Tiket Support / Bantuan',
        description: 'Kategori SUPPORT & channel panel tombol tiket bantuan privat',
        value: 'ticket',
      },
      {
        label: 'Statistik Server (Voice Counter)',
        description: 'Kategori teratas & 3 voice channel counter realtime',
        value: 'stats',
      },
      {
        label: 'Voice Hub (Join-to-Create)',
        description: 'Kategori & voice channel room mandiri otomatis',
        value: 'voice',
      },
      {
        label: 'Audit Log Server',
        description: 'Kategori & channel rahasia catatan aktivitas server',
        value: 'log',
      },
      {
        label: 'Studio Foto Auto-HD',
        description: 'Kategori & channel auto-HD gambar resolusi tinggi',
        value: 'hd',
      },
    ]);

  const menuRow = new ActionRowBuilder().addComponents(selectMenu);

  return { embeds: [embed], components: [buttonRow, menuRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup otomatis server lengkap (Verifikasi, Welcome, Games, Tiket, Voice Hub, Stats, dll)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('fitur')
        .setDescription('Pilih fitur yang ingin disetup (atau biarkan kosong untuk menu interaktif)')
        .setRequired(false)
        .addChoices(
          { name: '🌟 Setup Semua Fitur (All-in-One Langsung)', value: 'all' },
          { name: '👋 Welcome & Leave (Sambutan & Keluar)', value: 'welcome' },
          { name: '🔐 Verifikasi Server (Panel & Role)', value: 'verif' },
          { name: '🎮 Arena Mini Games (3 Channel Game)', value: 'game' },
          { name: '🎫 Tiket Support / Bantuan Privat', value: 'ticket' },
          { name: '📊 Statistik Server (Voice Counter)', value: 'stats' },
          { name: '🔊 Voice Hub (Join-to-Create Voice Room)', value: 'voice' },
          { name: '🛡️ Audit Log Server (Catatan Admin)', value: 'log' },
          { name: '🎨 Studio Foto Auto-HD', value: 'hd' }
        )
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedFeature = interaction.options.getString('fitur');

    // Jika user langsung memilih opsi dari slash command
    if (selectedFeature) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const result = await executeSetupAction(selectedFeature, interaction.guild);
        const embed = createResultEmbed(selectedFeature, result, interaction.guild);
        return await interaction.editReply({ embeds: [embed], components: [] });
      } catch (err) {
        console.error(`Error saat menjalankan setup ${selectedFeature}:`, err);
        return await interaction.editReply({
          content: `Terjadi kesalahan saat menjalankan setup: ${err.message}`,
        });
      }
    }

    // Jika tidak ada parameter fitur, tampilkan Dashboard Interaktif
    const dashboardData = getSetupDashboard(interaction.guild);
    const replyMessage = await interaction.reply({
      ...dashboardData,
      flags: MessageFlags.Ephemeral,
      fetchReply: true,
    });

    // Pasang Collector untuk merespons tombol dan select menu secara instan
    const collector = replyMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000, // 5 menit
    });

    collector.on('collect', async (i) => {
      let chosen = 'all';
      if (i.customId === 'btn_setup_run_all') {
        chosen = 'all';
      } else if (i.customId === 'menu_setup_select') {
        chosen = i.values[0] || 'all';
      }

      await i.deferUpdate();

      // Berikan indikator sedang memproses
      await interaction.editReply({
        content: `⏳ **Sedang memproses setup [${chosen.toUpperCase()}]...** Mohon tunggu beberapa detik, bot sedang membuat kategori, channel & permission...`,
        components: [],
      });

      try {
        const result = await executeSetupAction(chosen, interaction.guild);
        const embed = createResultEmbed(chosen, result, interaction.guild);
        await interaction.editReply({
          content: null,
          embeds: [embed],
          components: [],
        });
      } catch (err) {
        console.error(`Error saat collector setup ${chosen}:`, err);
        await interaction.editReply({
          content: `❌ Gagal melakukan setup: ${err.message}`,
          components: [],
        });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time') {
        // Biarkan pesan tetap ada
      }
    });
  },

  // Export helper untuk dipakai oleh interaction handler global jika diperlukan
  executeSetupAction,
  createResultEmbed,
  getSetupDashboard,
};
