const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelType,
} = require('discord.js');
const { getAutoRole } = require('./autoRoleHelper');
const {
  getUserData,
  getUserRank,
  getLeaderboard,
  xpForLevel,
  currentLevelXp,
  createProgressBar,
  getRankTitle,
  ACHIEVEMENTS,
  getAchievementById,
} = require('./levelingHelper');
const { getUserHistoryCount } = require('./aiHelper');

// 1. Tampilan Dashboard Menu Utama (Minimalist Clean Console)
function getMainDashboard(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('FLY CONTROL HUB')
    .setDescription(
      `### **${guild.name}** • Pusat Navigasi\n\n` +
      `╭─── MENU NAVIGASI ────────────────────────╮\n` +
      `│\n` +
      `│  Music Lounge     — Audio player, playlist & antrean\n` +
      `│  Server Builder   — Temp voice, stats counter & layout\n` +
      `│  Embed Studio     — Rules, info direktori & bulletin\n` +
      `│  Role & Members   — Auto-role, welcome & leave card\n` +
      `│  Rank & Leveling  — XP chat, leaderboard & badges\n` +
      `│  Fly AI Lounge    — Ruang chat & asisten privat\n` +
      `│  System Monitor   — Latency ping & performa server\n` +
      `│\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Pilih menu pada dropdown di bawah untuk membuka panel fitur.*`
    )
    .setThumbnail(guild.iconURL({ dynamic: true }) || null)
    .setFooter({ text: 'Fly System • Navigation Console' })
    .setTimestamp();

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_category_select')
    .setPlaceholder('Pilih menu yang ingin dibuka...')
    .addOptions(
      {
        label: 'Music Lounge',
        description: 'Putar lagu, antrean, volume & kontrol player',
        value: 'cat_music',
      },
      {
        label: 'Server Builder',
        description: 'Auto setup, join-to-create temp voice & counter stats',
        value: 'cat_rooms',
      },
      {
        label: 'Embed Studio',
        description: 'Cetak rules server, direktori info & pengumuman',
        value: 'cat_embeds',
      },
      {
        label: 'Role & Members',
        description: 'Auto-role member baru & simulasi welcome/leave',
        value: 'cat_roles',
      },
      {
        label: 'Rank & Leveling',
        description: 'Cek level, XP chat, leaderboard & achievement',
        value: 'cat_leveling',
      },
      {
        label: 'Fly AI Lounge',
        description: 'Ngobrol santai, curhat privat & asisten cerdas',
        value: 'cat_ai',
      },
      {
        label: 'System Monitor',
        description: 'Cek latency ping & performa server bot',
        value: 'cat_info',
      }
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

// 2. Tampilan Sub-Menu Musik
function getMusicMenu(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('MUSIC LOUNGE')
    .setDescription(
      `### Kontrol Audio Player • **${guild.name}**\n\n` +
      `╭─── KONTROL CEPAT ────────────────────────╮\n` +
      `│  Putar    — Judul lagu atau link YT / Spotify\n` +
      `│  Pause    — Jeda pemutaran musik sementara\n` +
      `│  Resume   — Lanjut dengerin musik\n` +
      `│  Skip     — Lewati ke lagu berikutnya\n` +
      `│  Stop     — Hentikan musik & keluar voice\n` +
      `│  Antrean  — Cek daftar lagu yang ngantre\n` +
      `│  Volume   — Setel volume suara (1 - 100%)\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Gunakan tombol di bawah untuk mengontrol player:*`
    )
    .setFooter({ text: 'Fly Music Engine' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_music_play').setLabel('Putar Lagu').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_music_pause').setLabel('Pause').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_music_resume').setLabel('Resume').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_music_skip').setLabel('Skip').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_music_queue').setLabel('Antrean').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_music_volume').setLabel('Volume').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// 3. Tampilan Sub-Menu Ruangan & Server
function getRoomsMenu(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('SERVER ARCHITECT')
    .setDescription(
      `### Tata Ruang & Utilitas • **${guild.name}**\n\n` +
      `╭─── MODUL SERVER ─────────────────────────╮\n` +
      `│  Setup Lengkap   — Kategori info, chat & voice\n` +
      `│  Temp Voice      — Join-to-Create room otomatis\n` +
      `│  Pasang Stats    — Indikator counter member & channel\n` +
      `│  Rapikan Urutan  — Susun rapi semua kategori\n` +
      `│  Buat Kategori   — Buat kategori pembatas baru\n` +
      `│  Buat Channel    — Bikin channel teks / suara\n` +
      `│  Hapus Channel   — Hapus channel ini (Admin)\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Pilih aksi utilitas yang ingin dieksekusi di bawah:*`
    )
    .setFooter({ text: 'Fly Server Architect' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_room_setupserver').setLabel('Setup Lengkap').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_room_tempvoice').setLabel('Temp Voice').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_room_stats').setLabel('Pasang Stats').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_room_rapihkan').setLabel('Rapikan Urutan').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_room_buatkategori').setLabel('Buat Kategori').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_room_buatchannel').setLabel('Buat Channel').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_room_hapuschannel').setLabel('Hapus Channel').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// 4. Tampilan Sub-Menu Embed & Rules
function getEmbedsMenu(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('EMBED STUDIO')
    .setDescription(
      `### Template Desain & Kartu • **${guild.name}**\n\n` +
      `╭─── PRESET TERSEDIA ──────────────────────╮\n` +
      `│  Rules Server    — Tata tertib komunitas resmi\n` +
      `│  Info Server     — Direktori ruangan & deskripsi\n` +
      `│  Pengumuman      — Banner berita penting\n` +
      `│  Panduan Musik   — Panduan dengerin lagu\n` +
      `│  Custom Embed    — Desain embed kreasi sendiri\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Klik salah satu tombol untuk mencetak kartu embed ke channel ini:*`
    )
    .setFooter({ text: 'Fly Embed Studio' });

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_embed_rules').setLabel('Cetak Rules').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_embed_info').setLabel('Info Server').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_embed_announce').setLabel('Pengumuman').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_embed_music').setLabel('Panduan Musik').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_embed_custom').setLabel('Custom Embed').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// 5. Tampilan Sub-Menu Role & Member
function getRolesMenu(guild) {
  const autoRoleId = getAutoRole(guild.id);
  const autoRoleText = autoRoleId ? `<@&${autoRoleId}>` : '`Nonaktif`';

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('ROLES & GREETINGS')
    .setDescription(
      `### Otomatisasi Member & Sambutan • **${guild.name}**\n\n` +
      `╭─── STATUS SISTEM ────────────────────────╮\n` +
      `│  Auto-Role: ${autoRoleText}\n` +
      `│  Welcome Card: Simulasi member masuk\n` +
      `│  Leave Card: Simulasi member keluar\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Gunakan tombol di bawah untuk mencoba simulasi:*`
    )
    .setFooter({ text: 'Fly Roles System' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_test_welcome').setLabel('Tes Sambutan Welcome').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_test_leave').setLabel('Tes Pesan Leave').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// 6. Tampilan Sub-Menu Info & Ping
function getInfoMenu(guild, client) {
  const wsPing = client.ws.ping;
  const totalGuilds = client.guilds.cache.size;
  const memoryUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('SYSTEM MONITOR')
    .setDescription(
      `### Performa Engine FlyBot\n\n` +
      `╭─── DIAGNOSTIK SISTEM ────────────────────╮\n` +
      `│  API Latency: \`${wsPing}ms\`\n` +
      `│  Server Count: \`${totalGuilds} guilds\`\n` +
      `│  Memory Usage: \`${memoryUsed} MB\`\n` +
      `│  Server Time: \`${new Date().toLocaleTimeString('id-ID')}\`\n` +
      `│  Core Status: \`Online & Stabil\`\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Semua sistem berfungsi normal dan responsif.*`
    )
    .setFooter({ text: 'Fly System Monitor' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

// 7. Tampilan Sub-Menu Leveling & Profil
function getLevelingMenu(guild, user) {
  const userData = getUserData(guild.id, user.id);
  const rank = getUserRank(guild.id, user.id);
  const nextLevelXp = xpForLevel(userData.level + 1);
  const currentXp = currentLevelXp(userData.xp, userData.level);
  const progressBar = createProgressBar(currentXp, nextLevelXp);
  const progressPct = Math.round((currentXp / nextLevelXp) * 100);

  const totalAch = ACHIEVEMENTS.length;
  const unlockedAch = userData.achievements.length;

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('RANK & LEVELING')
    .setDescription(
      `### Statistik Keaktifan • **${guild.name}**\n\n` +
      `╭─── KARTU PROFIL ─────────────────────────╮\n` +
      `│\n` +
      `│  Level: \`${userData.level}\`  ・  Rank: \`#${rank}\`\n` +
      `│  Total XP: \`${userData.xp.toLocaleString()}\`\n` +
      `│  Total Pesan: \`${userData.totalMessages.toLocaleString()}\`\n` +
      `│\n` +
      `│  Progres Level ${userData.level + 1}:\n` +
      `│  \`${progressBar}\` \`${progressPct}%\`\n` +
      `│  \`${currentXp.toLocaleString()} / ${nextLevelXp.toLocaleString()} XP\`\n` +
      `│\n` +
      `│  Achievement: \`${unlockedAch}/${totalAch} Terbuka\`\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Semakin sering chatting di server, semakin cepat naik level.*`
    )
    .setFooter({ text: 'XP diberikan otomatis per pesan (cooldown 60s)' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('btn_level_profile').setLabel('Profil Saya').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('btn_level_leaderboard').setLabel('Leaderboard Top 10').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('btn_level_achievements').setLabel('Daftar Achievement').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('btn_back_to_main').setLabel('Menu Utama').setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1] };
}

// 8. Tampilan Sub-Menu AI Chat (Fly Lounge)
function getAIMenu(guild, user) {
  const historyCount = getUserHistoryCount(user.id);
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('FLY CHAT LOUNGE')
    .setDescription(
      `### Ruang Ngobrol & Asisten Pribadi\n\n` +
      `╭─── PILIHAN AKSES CHAT ───────────────────╮\n` +
      `│\n` +
      `│  1. Mode DM Pribadi (100% Rahasia)\n` +
      `│  └ Langsung di DM bot. Admin & member tidak bisa melihat.\n` +
      `│\n` +
      `│  2. Mode Room Server\n` +
      `│  └ Bikin channel teks privat khusus kamu di server.\n` +
      `│\n` +
      `│  3. Mode Form Modal\n` +
      `│  └ Tanya langsung lewat popup rahasia di layar kamu.\n` +
      `│\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Ketik langsung tanpa prefix / atau mention bot.*\n\n` +
      `Sesi Kamu: ${historyCount > 0 ? `\`${historyCount} pesan tersimpan\` (aktif)` : '`Sesi baru siap dimulai`'} ・ Mode: \`100% Privat\``
    )
    .setFooter({ text: 'Fly AI Assistant' })
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_open_dm_ai')
      .setLabel('Chat di DM Pribadi')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_open_private_ai')
      .setLabel('Room di Server')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_ai_ask')
      .setLabel('Form Modal')
      .setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_ai_clear')
      .setLabel('Reset Sesi')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_setup_private_ai_hub')
      .setLabel('Setup Hub AI')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_back_to_main')
      .setLabel('Menu Utama')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

// ==========================================
// FORM MODAL BUILDERS
// ==========================================
function createPlayModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_menu_play')
    .setTitle('Putar Lagu Baru');

  const input = new TextInputBuilder()
    .setCustomId('play_query')
    .setLabel('Judul Lagu atau Link (YT / Spotify / Soundcloud)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: lofi hip hop atau link Spotify')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function createVolumeModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_menu_volume')
    .setTitle('Atur Volume Suara');

  const input = new TextInputBuilder()
    .setCustomId('volume_val')
    .setLabel('Persentase Volume (1 - 100)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: 80')
    .setRequired(true)
    .setMaxLength(3);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function createCategoryModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_menu_buatkategori')
    .setTitle('Buat Kategori Baru');

  const input = new TextInputBuilder()
    .setCustomId('cat_name')
    .setLabel('Nama Kategori / Pembatas')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: Text Lounge atau Voice Rooms')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

function createChannelModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_menu_buatchannel')
    .setTitle('Buat Channel Baru');

  const inputName = new TextInputBuilder()
    .setCustomId('ch_name')
    .setLabel('Nama Channel')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: santai-mabar atau curhat')
    .setRequired(true);

  const inputType = new TextInputBuilder()
    .setCustomId('ch_type')
    .setLabel('Tipe Channel (Ketik: text atau voice)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('text atau voice')
    .setRequired(true)
    .setMaxLength(5);

  modal.addComponents(
    new ActionRowBuilder().addComponents(inputName),
    new ActionRowBuilder().addComponents(inputType)
  );
  return modal;
}

function createAIModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_menu_ai_ask')
    .setTitle('Tanya Fly (AI Chat)');

  const promptInput = new TextInputBuilder()
    .setCustomId('ai_prompt')
    .setLabel('Apa yang mau kamu tanyakan atau curhatkan?')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Tulis pertanyaan, curhatan, atau topik pembahasan di sini...')
    .setMinLength(2)
    .setMaxLength(1000)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(promptInput));
  return modal;
}

module.exports = {
  getMainDashboard,
  getMusicMenu,
  getRoomsMenu,
  getEmbedsMenu,
  getRolesMenu,
  getLevelingMenu,
  getInfoMenu,
  getAIMenu,
  createPlayModal,
  createVolumeModal,
  createCategoryModal,
  createChannelModal,
  createAIModal,
};
