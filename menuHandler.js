const {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');

/**
 * Tampilan Menu Utama FlyBot
 * Bersih, tanpa emoji berlebihan, jelas dan langsung menyajikan aksi
 */
function getMainDashboard(guild, member) {
  const isAdmin = member && (
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild) ||
    member.permissions.has(PermissionFlagsBits.ManageChannels)
  );

  const name = member?.displayName || member?.user?.username || 'kamu';
  const line = (cmd, desc) => `\`${cmd.padEnd(13, ' ')}\` ${desc}`;

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'FlyBot  •  Pusat Perintah', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle(guild.name)
    .setDescription(
      `Halo **${name}**, pilih perintah dari menu di bawah untuk langsung menjalankannya.\n` +
      `Semua respons dari menu ini hanya terlihat oleh kamu.`
    )
    .addFields(
      {
        name: 'FlyBot HD Music',
        value: [
          line('/play', 'Putar lagu satuan atau playlist Spotify/YT'),
          line('/pause', 'Jeda pemutaran musik'),
          line('/resume', 'Lanjutkan pemutaran musik'),
          line('/skip', 'Lewati lagu ke berikutnya'),
          line('/repeat', 'Loop 1 lagu atau seluruh antrean'),
          line('/queue', 'Lihat daftar antrean musik'),
          line('/volume', 'Atur volume musik (1 - 100%)'),
          line('/stop', 'Hentikan musik & keluar voice'),
        ].join('\n'),
      },
      {
        name: 'Voice & Patroli',
        value: [
          line('/patroli', 'Jaga voice channel 24 jam nonstop'),
          line('/stop', 'Hentikan patroli & keluar dari voice'),
        ].join('\n'),
      },
      {
        name: 'Level & Ekonomi',
        value: [
          line('/profile', 'Lihat kartu profil, level, koin & badge'),
          line('/daily', 'Klaim hadiah koin & XP harian gratis'),
          line('/leaderboard', 'Papan peringkat XP & koin tertinggi'),
          line('/pay', 'Transfer koin ke sesama anggota'),
        ].join('\n'),
      },
      {
        name: 'Anggota & AI',
        value: [
          line('/ai', 'Tanya dan diskusi dengan AI'),
          line('/afk', 'Pasang status sedang tidak di tempat'),
          line('/remind', 'Pasang pengingat jadwal otomatis'),
          line('/userinfo', 'Lihat detail teknis akun Discord'),
          line('/serverinfo', 'Lihat statistik & info lengkap server'),
          line('/ping', 'Cek kecepatan respons bot'),
        ].join('\n'),
      },
      isAdmin
        ? {
            name: 'Pengelola Server',
            value: [
              line('/setwelcome', 'Channel sambutan & member keluar'),
              line('/setverif', 'Setup role & kunci channel sebelum verif'),
              line('/log', 'Setup otomatis kategori AUDIT LOG & channel'),
              line('/ticket', 'Setup otomatis kategori SUPPORT & channel'),
              line('/stats', 'Channel statistik realtime (on / off)'),
              line('/game', 'Setup otomatis 3 channel mini games interaktif'),
              line('/setlevel', 'Channel notifikasi level & achievement'),
              line('/verif', 'Pasang panel verifikasi ber-tombol'),
              line('/autorole', 'Role otomatis untuk member baru'),
              line('/antitoxic', 'Kelola kata terlarang'),
              line('/buatembed', 'Buat pesan informasi berbingkai'),
              line('/leveltest', 'Preview tampilan level up'),
            ].join('\n'),
          }
        : {
            name: 'Pengelola Server',
            value: '*Perintah pengaturan server hanya tersedia untuk Admin.*',
          },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || guild.client.user.displayAvatarURL())
    .setFooter({
      text: `${guild.memberCount.toLocaleString()} member  •  Diminta oleh ${name}`,
      iconURL: member?.displayAvatarURL?.() || undefined,
    })
    .setTimestamp();

  const menuOptions = [
    { label: 'Kartu Profil Pengguna', description: 'Lihat level, XP, koin, peringkat & badge', value: 'cmd_profile' },
    { label: 'Klaim Hadiah Harian', description: 'Klaim bonus koin & XP gratis setiap 24 jam', value: 'cmd_daily' },
    { label: 'Papan Peringkat', description: 'Lihat peringkat XP dan koin server', value: 'cmd_leaderboard' },
    { label: 'Putar Musik', description: 'Putar lagu satuan atau playlist', value: 'cmd_play' },
    { label: 'Lewati Lagu', description: 'Melewati lagu ke daftar berikutnya', value: 'cmd_skip' },
    { label: 'Antrean Musik', description: 'Melihat daftar antrean lagu saat ini', value: 'cmd_queue' },
    { label: 'Atur Volume Musik', description: 'Ubah tingkat volume (1 - 100%)', value: 'cmd_volume' },
    { label: 'Stop & Keluar Voice', description: 'Hentikan musik / patroli & keluar voice', value: 'cmd_stop' },
    { label: 'Patroli Voice 24 Jam', description: 'Jaga voice channel 24 jam nonstop', value: 'cmd_patroli' },
    { label: 'Tanya AI', description: 'Ajukan pertanyaan ke AI', value: 'cmd_ai' },
    { label: 'AFK', description: 'Pasang status sedang tidak di tempat', value: 'cmd_afk' },
    { label: 'Info Akun Discord', description: 'Lihat tanggal buat akun & role teknis', value: 'cmd_userinfo' },
    { label: 'Info Server', description: 'Lihat statistik & info lengkap server', value: 'cmd_serverinfo' },
    { label: 'Ping', description: 'Cek kecepatan respons bot', value: 'cmd_ping' },
  ];
  if (isAdmin) {
    menuOptions.push(
      { label: 'Setup Kunci Channel & Verif', description: '[Admin] Setup role & sembunyikan channel', value: 'cmd_setverif' },
      { label: 'Audit Log Server', description: '[Admin] Status & kelola channel audit log', value: 'cmd_log' },
      { label: 'Panel Verifikasi', description: '[Admin] Status & panduan pasang panel verifikasi', value: 'cmd_verif' },
      { label: 'Panel Tiket Bantuan', description: '[Admin] Status & panduan pasang panel tiket bantuan', value: 'cmd_ticket' },
      { label: 'Statistik Server Real-time', description: '[Admin] Aktifkan / matikan counter statistik server', value: 'cmd_stats' },
      { label: 'Arena Mini Games', description: '[Admin] Kategori & 3 channel game interaktif', value: 'cmd_game' },
      { label: 'Test Level Up & Achievement', description: '[Admin] Preview tampilan notifikasi level up', value: 'cmd_leveltest' },
      { label: 'Setting Channel Leveling', description: '[Admin] Status & info channel level up & achievement', value: 'cmd_setlevel' },
      { label: 'Autorole', description: '[Admin] Atur role otomatis member baru', value: 'cmd_autorole' },
      { label: 'Antitoxic', description: '[Admin] Lihat daftar kata terlarang', value: 'cmd_antitoxic' },
    );
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_direct_action')
    .setPlaceholder('Pilih perintah...')
    .addOptions(menuOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);
  return { embeds: [embed], components: [row] };
}

// Modal Form untuk /play
function createPlayModal() {
  const modal = new ModalBuilder().setCustomId('modal_music_play').setTitle('Putar Musik');
  const input = new TextInputBuilder()
    .setCustomId('music_query')
    .setLabel('Judul Lagu atau Link')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: Alan Walker Faded / link Spotify/YT')
    .setRequired(true);
  return modal.addComponents(new ActionRowBuilder().addComponents(input));
}

// Modal Form untuk /volume
function createVolumeModal() {
  const modal = new ModalBuilder().setCustomId('modal_music_volume').setTitle('Pengaturan Volume');
  const input = new TextInputBuilder()
    .setCustomId('volume_level')
    .setLabel('Tingkat Volume (1 - 100)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: 80')
    .setRequired(true);
  return modal.addComponents(new ActionRowBuilder().addComponents(input));
}

// Modal Form untuk /ai
function createAIModal() {
  const modal = new ModalBuilder().setCustomId('modal_ai_prompt').setTitle('Pertanyaan AI');
  const input = new TextInputBuilder()
    .setCustomId('ai_input')
    .setLabel('Tulis pertanyaan atau instruksi kamu')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Tulis pertanyaan apa saja di sini...')
    .setRequired(true);
  return modal.addComponents(new ActionRowBuilder().addComponents(input));
}

// Modal Form untuk /afk
function createAfkModal() {
  const modal = new ModalBuilder().setCustomId('modal_afk_reason').setTitle('Status AFK');
  const input = new TextInputBuilder()
    .setCustomId('afk_reason_input')
    .setLabel('Alasan AFK (opsional)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Contoh: Makan siang / tidur / mandi')
    .setRequired(false);
  return modal.addComponents(new ActionRowBuilder().addComponents(input));
}

module.exports = {
  getMainDashboard,
  createPlayModal,
  createVolumeModal,
  createAIModal,
  createAfkModal
};
