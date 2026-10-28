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
  setupMusicCategory,
  setupEntertainmentCategory,
  setupSosmedConverterCategory,
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
        `• <#${result.selectRolesChannel.id}> — Panel pemilihan role gender (Laki-laki / Perempuan)\n\n` +
        `*Member baru hanya bisa melihat kategori ini sampai mereka memverifikasi akun dan memilih role gender!*`
      );
  } else if (featureKey === 'official') {
    embed
      .setTitle('Setup Official Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel resmi telah siap:\n\n` +
        `• <#${result.announcement.id}> — Pengumuman resmi server\n` +
        `• <#${result.officialEvent.id}> — Event dan kegiatan komunitas\n` +
        `• <#${result.helpCenter.id}> — Pusat bantuan & tiket support\n\n` +
        `*Channel ini hanya bisa diketik oleh Owner/Bot, member hanya bisa membaca dan memberi reaksi.*`
      );
  } else if (featureKey === 'notify') {
    embed
      .setTitle('Setup Notify Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan notifikasi telah aktif:\n\n` +
        `• <#${result.welcome.id}> — Pesan sambutan member baru (terhubung ke Welcome Banner)\n` +
        `• <#${result.leave.id}> — Log riwayat member keluar\n` +
        `• <#${result.levels.id}> — Notifikasi resmi naik level XP\n` +
        `• <#${result.achievements.id}> — Notifikasi resmi pembukaan badge prestasi\n\n` +
        `*Seluruh notifikasi otomatis tersinkronisasi di kategori Notify ini.*`
      );
  } else if (featureKey === 'community') {
    embed
      .setTitle('Setup Community Selesai')
      .setDescription(
        `Kategori **${result.category.name}** dan channel obrolan komunitas telah siap:\n\n` +
        `• <#${result.ngobrol.id}> — Ruang obrolan umum utama\n` +
        `• <#${result.stalk.id}> — Ruang khusus perintah /stalk profil`
      );
  } else if (featureKey === 'cinematography') {
    embed
      .setTitle('Setup Cinematography Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.fotografi.id}> — Galeri fotografi karya anggota\n` +
        `• <#${result.videografi.id}> — Berbagi video cinematik & klip seru\n` +
        `• <#${result.hdFoto.id}> — Studio Auto-HD foto (AI 2x/4x Super-Resolution)`
      );
  } else if (featureKey === 'music') {
    embed
      .setTitle('Setup Music Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.playMusic.id}> — Channel khusus memutar musik (/play wajib di sini)\n` +
        `• <#${result.sharelinkMusic.id}> — Ruang berbagi link playlist & lagu favorit`
      );
  } else if (featureKey === 'entertainment') {
    embed
      .setTitle('Setup Entertainment Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.aiFanart.id}> — Review seni & konsep fanart (Dibalas AI privat + Vision)\n` +
        `• <#${result.aiGenerating.id}> — Obrolan cerdas & generator teks BotFly AI\n` +
        `• <#${result.aiPrompt.id}> — Studio racik prompt AI (Visual & Generative)`
      );
  } else if (featureKey === 'sosmed') {
    embed
      .setTitle('Setup Sosmed Converter Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap:\n\n` +
        `• <#${result.tiktokConvert.id}> — TikTok Converter (Video no-watermark & foto slideshow)\n` +
        `• <#${result.instagramConvert.id}> — Instagram Converter (Reels, Feed & Carousel)\n` +
        `• <#${result.facebookConvert.id}> — Facebook Converter (Video & Reels HD)\n` +
        `• <#${result.youtubeConvert.id}> — YouTube Converter (Shorts & Video)\n\n` +
        `*Member cukup kirim link sosmed dari PC/Mobile, bot otomatis konversi langsung ke chat!*`
      );
  } else if (featureKey === 'games') {
    embed
      .setTitle('Setup Mini Games Selesai')
      .setDescription(
        `Kategori **${result.category.name}** telah siap (Tombol & Chat Langsung Aktif):\n\n` +
        `• <#${result.coinChannel.id}> — Tebak Koin (Gambar / Angka)\n` +
        `• <#${result.numberChannel.id}> — Tebak Angka (1 - 100)\n` +
        `• <#${result.rpsChannel.id}> — Suit (Gunting Batu Kertas)`
      );
  } else if (featureKey === 'voice') {
    embed
      .setTitle('Setup Voice Lounges Selesai (Posisi Terbawah)')
      .setDescription(
        `Kategori **${result.category.name}** telah siap di urutan paling bawah:\n\n` +
        `• <#${result.hubChannel.id}> — Buat Room Voice (Join-to-Create room mandiri)\n` +
        `  *(Saat member masuk, bot otomatis membuat room pribadi dengan Panel Kontrol Privat/Public, batasi member, ganti nama, whitelist & kick!)*`
      );
  } else if (featureKey === 'all') {
    embed
      .setTitle('Seluruh Template Server Berhasil Dibuat (All-in-One)')
      .setDescription(
        `Seluruh struktur server sesuai layout profesional telah selesai dibuat dan langsung aktif:\n\n` +
        `**1. Get Started** (Akses Awal Sebelum Verifikasi)\n` +
        `└ <#${result.getStarted.rulesChannel.id}>, <#${result.getStarted.startHereChannel.id}>, <#${result.getStarted.selectRolesChannel.id}>\n\n` +
        `**2. Official** (Hanya Owner & Bot Chat, Member React)\n` +
        `└ <#${result.official.announcement.id}>, <#${result.official.officialEvent.id}>, <#${result.official.helpCenter.id}>\n\n` +
        `**3. Notify** (Notifikasi Welcome, Leave, Levels & Achievements)\n` +
        `└ <#${result.notify.welcome.id}>, <#${result.notify.leave.id}>, <#${result.notify.levels.id}>, <#${result.notify.achievements.id}>\n\n` +
        `**4. Community** (Obrolan & Stalk Profil)\n` +
        `└ <#${result.community.ngobrol.id}>, <#${result.community.stalk.id}>\n\n` +
        `**5. Cinematography** (Foto, Video & Auto-HD)\n` +
        `└ <#${result.cinematography.fotografi.id}>, <#${result.cinematography.videografi.id}>, <#${result.cinematography.hdFoto.id}>\n\n` +
        `**6. Music** (Wajib /play di sini & Sharelink Musik)\n` +
        `└ <#${result.music.playMusic.id}>, <#${result.music.sharelinkMusic.id}>\n\n` +
        `**7. Entertainment** (3 Ruang AI: Fanart Review, Generator & Prompt Studio)\n` +
        `└ <#${result.entertainment.aiFanart.id}>, <#${result.entertainment.aiGenerating.id}>, <#${result.entertainment.aiPrompt.id}>\n\n` +
        `**8. Sosmed Converter** (Auto-Download TikTok, Instagram, Facebook, YouTube)\n` +
        `└ <#${result.sosmedConverter.tiktokConvert.id}>, <#${result.sosmedConverter.instagramConvert.id}>, <#${result.sosmedConverter.facebookConvert.id}>, <#${result.sosmedConverter.youtubeConvert.id}>\n\n` +
        `**9. Mini Games** (Tombol & Chat Interaktif Langsung Berfungsi)\n` +
        `└ <#${result.miniGames.coinChannel.id}>, <#${result.miniGames.numberChannel.id}>, <#${result.miniGames.rpsChannel.id}>\n\n` +
        `**10. Voice Lounges (Paling Bawah)**\n` +
        `└ <#${result.voiceLounges.hubChannel.id}> (Room Suara Mandiri & Panel Kontrol Privat/Public)\n\n` +
        `**Sistem Keamanan & Auto-Update Aktif**: Member baru yang bergabung hanya akan melihat kategori **Get Started** sampai mereka memverifikasi akun & memilih role gender (**Laki-laki** / **Perempuan**).\n` +
        `**Auto-Update On**: Jika ada pembaruan template di masa mendatang, server ini akan otomatis tersinkronisasi saat bot restart tanpa perlu delete-all!`
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
    case 'music':
      return await setupMusicCategory(guild);
    case 'entertainment':
      return await setupEntertainmentCategory(guild);
    case 'sosmed':
      return await setupSosmedConverterCategory(guild);
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
      `   • rules (Peraturan Bahasa Indonesia, member hanya bisa baca & react)\n` +
      `   • start-here (Panel verifikasi akses server)\n` +
      `   • select-roles (Panel pilihan role gender Pria / Wanita)\n` +
      `2. **───────Official───────** (Khusus Owner & Bot, Member React)\n` +
      `   • announcement, official-event, help-center (tiket bantuan)\n` +
      `3. **───────Notify───────**\n` +
      `   • welcome, leave, levels, achievements\n` +
      `4. **───────Community───────**\n` +
      `   • ngobrol, stalk profil akun\n` +
      `5. **───────Cinematography───────**\n` +
      `   • fotografi, videografi, hd-foto (Auto-HD AI 2x/4x Super-Resolution)\n` +
      `6. **───────Music───────**\n` +
      `   • play-music (wajib /play di sini), sharelink-music (berbagi playlist & link lagu)\n` +
      `7. **───────Entertainment───────**\n` +
      `   • ai-fanart, ai-generating, ai-prompt (3 Studio AI BotFly)\n` +
      `8. **───────Sosmed Converter───────**\n` +
      `   • tiktok-convert, instagram-convert, facebook-convert, youtube-convert (Auto-download video & foto)\n` +
      `9. **───────Mini Games───────**\n` +
      `   • tebak-koin, tebak-angka, suit-jepang (Tombol & Chat langsung berfungsi)\n` +
      `10. **───────Voice Lounges───────** (Paling Bawah)\n` +
      `   • Buat Room Voice (Join-to-Create room mandiri + panel kontrol privat/public & kontrol lengkap)\n\n` +
      `*Pilih tombol hijau untuk membuat semua sekaligus, atau gunakan dropdown untuk memilih satu per satu:*`
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
    .setPlaceholder('Pilih kategori setup (1 per 1 atau Semua)...')
    .addOptions([
      {
        label: 'Setup Semua Template (All-in-One)',
        description: 'Buat seluruh kategori & channel teks/suara secara instan',
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
        label: 'Notify (Welcome, Leave, Levels, Achievements)',
        description: 'Kategori terpisah untuk notifikasi selamat datang, keluar & level',
        value: 'notify',
      },
      {
        label: 'Community (Ngobrol, Stalk)',
        description: 'Obrolan santai dan stalk profil akun sosial',
        value: 'community',
      },
      {
        label: 'Cinematography (Fotografi, Video, Auto-HD)',
        description: 'Galeri karya foto, video, dan studio Auto-HD foto',
        value: 'cinematography',
      },
      {
        label: 'Music (Play Music & Sharelink Music)',
        description: 'Channel pemutar musik dan ruang berbagi playlist lagu',
        value: 'music',
      },
      {
        label: 'Entertainment & AI (3 AI Rooms)',
        description: 'ai-fanart review, ai-generating teks, dan ai-prompt studio',
        value: 'entertainment',
      },
      {
        label: 'Sosmed Converter (TikTok, IG, FB, YouTube)',
        description: 'Channel auto-download video & foto sosmed dari link PC/Mobile',
        value: 'sosmed',
      },
      {
        label: 'Mini Games (Koin, Angka, Suit)',
        description: '3 channel permainan interaktif berhadiah koin & XP',
        value: 'games',
      },
      {
        label: 'Voice Lounges (Paling Bawah - Room Suara)',
        description: 'Kategori suara di posisi terbawah: Buat Room Voice mandiri & panel kontrol',
        value: 'voice',
      },
    ]);

  const menuRow = new ActionRowBuilder().addComponents(selectMenu);

  return { embeds: [embed], components: [buttonRow, menuRow] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Setup otomatis template server (Rules, Verif, Role Gender, Community, Music, Voice)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt
        .setName('fitur')
        .setDescription('Pilih kategori yang ingin disetup (atau biarkan kosong untuk menu interaktif)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup Semua Template (All-in-One)', value: 'all' },
          { name: 'Get Started (Rules, Verif, Gender Role)', value: 'get_started' },
          { name: 'Official (Pengumuman, Event, Tiket)', value: 'official' },
          { name: 'Notify (Welcome & Leave)', value: 'notify' },
          { name: 'Community (Ngobrol & Stalk)', value: 'community' },
          { name: 'Cinematography (Fotografi & Videografi)', value: 'cinematography' },
          { name: 'Music (Play Music & Sharelink Music)', value: 'music' },
          { name: 'Entertainment & AI (3 AI Rooms)', value: 'entertainment' },
          { name: 'Sosmed Converter (TikTok, IG, FB, YouTube)', value: 'sosmed' },
          { name: 'Mini Games (Koin, Angka, Suit)', value: 'games' },
          { name: 'Voice Lounges (Paling Bawah - Room Mandiri)', value: 'voice' }
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
    const response = await interaction.reply({
      ...dashboardData,
      flags: MessageFlags.Ephemeral,
      withResponse: true,
    });
    const replyMessage = response.resource?.message || (await interaction.fetchReply().catch(() => null));
    if (!replyMessage) return;

    // Pasang Collector untuk merespons tombol dan select menu secara instan
    const collector = replyMessage.createMessageComponentCollector({
      filter: (i) => i.user.id === interaction.user.id,
      time: 300000, // 5 menit
    });

    collector.on('collect', async (i) => {
      if (i.deferred || i.replied) return;
      let chosen = 'all';
      if (i.customId === 'btn_setup_run_all') {
        chosen = 'all';
      } else if (i.customId === 'menu_setup_select') {
        chosen = i.values[0] || 'all';
      }

      await i.deferUpdate().catch(() => {});

      // Berikan indikator sedang memproses
      await interaction.editReply({
        content: `**Sedang memproses setup [${chosen.toUpperCase()}]...** Mohon tunggu beberapa detik, bot sedang menyusun kategori, channel teks & suara, permission, dan panel otomatis...`,
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
          content: `Gagal melakukan setup: ${err.message}`,
          components: [],
        });
      }
    });
  },

  executeSetupAction,
  createResultEmbed,
  getSetupDashboard,
};
