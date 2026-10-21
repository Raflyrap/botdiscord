const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const {
  setupAll,
  setupGetStartedCategory,
  setupOfficialCategory,
  setupNotifyCategory,
  setupCommunityCategory,
  setupCinematographyCategory,
  setupEntertainmentCategory,
  setupMiniGamesCategory,
  setupVoiceLoungesCategory,
} = require('../setupHelper');

// Helper untuk membangun Embed hasil setup
function createResultEmbed(featureKey, result, guild) {
  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setAuthor({ name: `${guild.name} • Template Setup Server`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  if (featureKey === 'get_started') {
    embed
      .setTitle('Setup Get Started Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel panduan/verifikasi telah siap:\n\n` +
        `• <#${result.rulesChannel.id}> — Peraturan resmi server (Bahasa Indonesia)\n` +
        `• <#${result.startHereChannel.id}> — Panel tombol verifikasi server\n` +
        `• <#${result.selectRolesChannel.id}> — Panel pemilihan role gender (👦 Laki-laki / 👧 Perempuan)\n\n` +
        `*Member baru hanya bisa melihat kategori ini sampai mereka memverifikasi akun dan memilih role gender!*`
      );
  } else if (featureKey === 'official') {
    embed
      .setTitle('Setup Official Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel resmi telah siap:\n\n` +
        `• <#${result.announcement.id}> — Pengumuman resmi server\n` +
        `• <#${result.officialEvent.id}> — Event dan kegiatan komunitas\n` +
        `• <#${result.socialMedia.id}> — Tautan sosial media server\n` +
        `• <#${result.helpCenter.id}> — Pusat bantuan & tiket support\n\n` +
        `*Channel ini hanya bisa diketik oleh Owner/Bot, member hanya bisa membaca dan memberi reaksi (react).*`
      );
  } else if (featureKey === 'notify') {
    embed
      .setTitle('Setup Notify Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan notifikasi telah aktif:\n\n` +
        `• <#${result.welcome.id}> — Pesan sambutan member baru (terhubung ke Welcome Banner)\n` +
        `• <#${result.leave.id}> — Log riwayat member keluar\n\n` +
        `*Bot akan otomatis mengirimkan kartu visual saat ada member yang bergabung.*`
      );
  } else if (featureKey === 'community') {
    embed
      .setTitle('Setup Community Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel obrolan komunitas telah siap:\n\n` +
        `• <#${result.newcomerChat.id}> — Obrolan khusus member baru\n` +
        `• <#${result.ngobrol.id}> — Ruang obrolan umum 1\n` +
        `• <#${result.ngobrol2.id}> — Ruang obrolan umum 2\n` +
        `• <#${result.media.id}> — Galeri berbagi media\n` +
        `• <#${result.levels.id}> — Notifikasi naik level XP\n` +
        `• <#${result.achievements.id}> — Notifikasi penghargaan & badge prestasi\n` +
        `• <#${result.report.id}> — Ruang pelaporan kendala/pelanggaran`
      );
  } else if (featureKey === 'cinematography') {
    embed
      .setTitle('Setup Cinematography Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.fotografi.id}> — Galeri fotografi karya anggota (Auto-HD support)\n` +
        `• <#${result.videografi.id}> — Berbagi video cinematik & klip seru`
      );
  } else if (featureKey === 'entertainment') {
    embed
      .setTitle('Setup Entertainment Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.meme.id}> — Berbagi meme lucu (Auto-react)\n` +
        `• <#${result.fanart.id}> — Galeri seni & fanart\n` +
        `• <#${result.aiFanart.id}> — Karya seni AI\n` +
        `• <#${result.aiGenerating.id}> — Obrolan cerdas bareng ChatGPT AI\n` +
        `• <#${result.aiPrompt.id}> — Berbagi prompt kreatif AI\n` +
        `• <#${result.gamingSetup.id}> — Pamer setup gaming & battlestation`
      );
  } else if (featureKey === 'games') {
    embed
      .setTitle('Setup Mini Games Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.coinChannel.id}> — Tebak Koin (Gambar / Angka)\n` +
        `• <#${result.numberChannel.id}> — Tebak Angka (1 - 100)\n` +
        `• <#${result.rpsChannel.id}> — Suit (Gunting Batu Kertas)`
      );
  } else if (featureKey === 'voice') {
    embed
      .setTitle('Setup Voice Lounges Selesai (Posisi Terbawah)')
      .setDescription(
        `Kategori **${result.category.name}** telah siap di urutan paling bawah:\n\n` +
        `• <#${result.hubChannel.id}> — Voice trigger (Join-to-Create room mandiri)\n` +
        `• <#${result.productionRoom.id}> — Voice room untuk produksi & stream\n` +
        `• <#${result.generalVoice.id}> — Obrolan suara santai\n` +
        `• <#${result.musicLounge.id}> — Mendengarkan musik HD bareng FlyBot\n` +
        `• <#${result.voiceChat.id}> — Obrolan teks pendamping voice`
      );
  } else if (featureKey === 'all') {
    embed
      .setTitle('🚀 Seluruh Template Server Berhasil Dibuat (All-in-One)')
      .setDescription(
        `Seluruh struktur server sesuai layout profesional telah selesai dibuat dan langsung aktif:\n\n` +
        `**1. Get Started** (Akses Awal Sebelum Verifikasi)\n` +
        `└ <#${result.getStarted.rulesChannel.id}>, <#${result.getStarted.startHereChannel.id}>, <#${result.getStarted.selectRolesChannel.id}>\n\n` +
        `**2. Official** (Hanya Owner & Bot Chat, Member React)\n` +
        `└ <#${result.official.announcement.id}>, <#${result.official.officialEvent.id}>, <#${result.official.socialMedia.id}>, <#${result.official.helpCenter.id}>\n\n` +
        `**3. Notify** (Notifikasi Selamat Datang & Keluar)\n` +
        `└ <#${result.notify.welcome.id}> & <#${result.notify.leave.id}>\n\n` +
        `**4. Community** (Obrolan, Levels & Achievements)\n` +
        `└ <#${result.community.newcomerChat.id}>, <#${result.community.ngobrol.id}>, <#${result.community.ngobrol2.id}>, <#${result.community.media.id}>, <#${result.community.levels.id}>, <#${result.community.achievements.id}>, <#${result.community.report.id}>\n\n` +
        `**5. Cinematography**\n` +
        `└ <#${result.cinematography.fotografi.id}> & <#${result.cinematography.videografi.id}>\n\n` +
        `**6. Entertainment & AI**\n` +
        `└ <#${result.entertainment.meme.id}>, <#${result.entertainment.fanart.id}>, <#${result.entertainment.aiFanart.id}>, <#${result.entertainment.aiGenerating.id}>, <#${result.entertainment.aiPrompt.id}>, <#${result.entertainment.gamingSetup.id}>\n\n` +
        `**7. Mini Games**\n` +
        `└ <#${result.miniGames.coinChannel.id}>, <#${result.miniGames.numberChannel.id}>, <#${result.miniGames.rpsChannel.id}>\n\n` +
        `**8. Voice Lounges (Paling Bawah)**\n` +
        `└ <#${result.voiceLounges.hubChannel.id}>, <#${result.voiceLounges.productionRoom.id}>, <#${result.voiceLounges.generalVoice.id}>, <#${result.voiceLounges.musicLounge.id}>, <#${result.voiceLounges.voiceChat.id}>\n\n` +
        `✅ **Sistem Keamanan Aktif**: Member baru yang bergabung hanya akan melihat kategori **Get Started** sampai mereka menekan tombol verifikasi dan memilih role gender (**👦 Laki-laki** / **👧 Perempuan**). Setelah itu, seluruh server akan otomatis terbuka penuh!`
      );
  }

  return embed;
}

// Fungsi eksekutor setup
async function executeSetupAction(featureKey, guild) {
  switch (featureKey) {
    case 'get_started':
      return await setupGetStartedCategory(guild);
    case 'official':
      return await setupOfficialCategory(guild);
    case 'notify':
      return await setupNotifyCategory(guild);
    case 'community':
      return await setupCommunityCategory(guild);
    case 'cinematography':
      return await setupCinematographyCategory(guild);
    case 'entertainment':
      return await setupEntertainmentCategory(guild);
    case 'games':
      return await setupMiniGamesCategory(guild);
    case 'voice':
      return await setupVoiceLoungesCategory(guild);
    case 'all':
    default:
      return await setupAll(guild);
  }
}

// Dashboard Tampilan Utama /setup
function getSetupDashboard(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: 'FlyBot • Template Server Manager', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle(`Pusat Setup Template Server  •  ${guild.name}`)
    .setDescription(
      `Pilih setup layout server yang kamu inginkan di bawah ini.\n` +
      `Kamu bisa memilih **Setup 1 per 1 per kategori** atau langsung **Setup Semua Sekaligus** (All-in-One).\n\n` +
      `**Struktur Kategori & Channel:**\n` +
      `1. **───────Get Started───────**\n` +
      `   • 📜 rules (Peraturan Bahasa Indonesia, member hanya bisa baca & react)\n` +
      `   • 🌟 start-here (Panel verifikasi akses server)\n` +
      `   • 👑 select-roles (Panel pilihan role gender 👦 Pria / 👧 Wanita)\n` +
      `2. **───────Official───────** (Khusus Owner & Bot, Member React)\n` +
      `   • announcement, official-event, social-media, help-center (tiket)\n` +
      `3. **───────Notify───────**\n` +
      `   • welcome & leave (Notifikasi sambutan & log keluar)\n` +
      `4. **───────Community───────**\n` +
      `   • newcomer-chat, ngobrol, ngobrol-2, media, levels, achievements, report\n` +
      `5. **───────Cinematography───────**\n` +
      `   • fotografi & videografi\n` +
      `6. **───────Entertainment───────**\n` +
      `   • meme, fanart, ai-fanart, ai-generating, ai-prompt, showcase-gaming-setup\n` +
      `7. **───────Mini Games───────**\n` +
      `   • tebak-koin, tebak-angka, suit-jepang\n` +
      `8. **───────Voice Lounges───────** (Paling Bawah)\n` +
      `   • Buat Room Voice (Join-to-Create), Production Room, General Voice, Music Lounge\n\n` +
      `*Pilih tombol hijau untuk membuat semua sekaligus, atau gunakan dropdown untuk memilih satu per satu:*`
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || guild.client.user.displayAvatarURL())
    .setFooter({ text: `${guild.name} • Pengelola Server FlyBot` })
    .setTimestamp();

  const allBtn = new ButtonBuilder()
    .setCustomId('btn_setup_run_all')
    .setLabel('🚀 Setup Semua Sekarang (All-in-One)')
    .setStyle(ButtonStyle.Success);

  const buttonRow = new ActionRowBuilder().addComponents(allBtn);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_setup_select')
    .setPlaceholder('Pilih kategori setup (1 per 1 atau Semua)...')
    .addOptions([
      {
        label: '🌟 Setup Semua Template (All-in-One)',
        description: 'Buat seluruh 8 kategori & channel teks/suara secara instan',
        value: 'all',
      },
      {
        label: 'Get Started (Rules, Verif, Gender Role)',
        description: 'Rules Bahasa Indonesia, start-here verif, select-roles gender',
        value: 'get_started',
      },
      {
        label: 'Official (Pengumuman, Event, Help Center)',
        description: 'Channel resmi hanya chat Owner & Bot, member hanya react',
        value: 'official',
      },
      {
        label: 'Notify (Welcome & Leave)',
        description: 'Kategori terpisah untuk notifikasi selamat datang & keluar',
        value: 'notify',
      },
      {
        label: 'Community (Ngobrol, Levels & Achievements)',
        description: 'Newcomer, obrolan, media, level up, achievement, report',
        value: 'community',
      },
      {
        label: 'Cinematography (Fotografi & Videografi)',
        description: 'Galeri karya foto dan video',
        value: 'cinematography',
      },
      {
        label: 'Entertainment & AI (Meme, Fanart, AI Rooms)',
        description: 'Meme, fanart, ai-fanart, ai-generating, ai-prompt, gaming-setup',
        value: 'entertainment',
      },
      {
        label: 'Mini Games (Koin, Angka, Suit)',
        description: '3 channel permainan interaktif berhadiah koin & XP',
        value: 'games',
      },
      {
        label: 'Voice Lounges (Paling Bawah - Room Suara)',
        description: 'Kategori suara di posisi terbawah: Hub mandiri, Production, Musik',
        value: 'voice',
      },
    ]);

  const menuRow = new ActionRowBuilder().addComponents(selectMenu);

  return { embeds: [embed], components: [buttonRow, menuRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup otomatis template server (Rules, Verif, Role Gender, Community, Voice di bawah)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('fitur')
        .setDescription('Pilih kategori yang ingin disetup (atau biarkan kosong untuk menu interaktif)')
        .setRequired(false)
        .addChoices(
          { name: '🌟 Setup Semua Template (All-in-One)', value: 'all' },
          { name: '🚪 Get Started (Rules, Verif, Gender Role)', value: 'get_started' },
          { name: '📢 Official (Pengumuman, Event, Tiket)', value: 'official' },
          { name: '👋 Notify (Welcome & Leave)', value: 'notify' },
          { name: '💬 Community (Ngobrol, Levels, Achievements)', value: 'community' },
          { name: '📷 Cinematography (Fotografi & Videografi)', value: 'cinematography' },
          { name: '🎨 Entertainment & AI (Meme, Fanart, AI Rooms)', value: 'entertainment' },
          { name: '🎮 Mini Games (Koin, Angka, Suit)', value: 'games' },
          { name: '🔊 Voice Lounges (Paling Bawah - Room Mandiri)', value: 'voice' }
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
        content: `⏳ **Sedang memproses setup [${chosen.toUpperCase()}]...** Mohon tunggu beberapa detik, bot sedang menyusun kategori, channel teks & suara, permission, dan panel otomatis...`,
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
  },

  executeSetupAction,
  createResultEmbed,
  getSetupDashboard,
};
