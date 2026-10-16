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
        name: 'Voice',
        value: [
          line('/patroli', 'Jaga voice channel 24 jam nonstop'),
          line('/stop', 'Hentikan patroli & keluar dari voice'),
        ].join('\n'),
      },
      {
        name: 'Anggota & AI',
        value: [
          line('/ai', 'Tanya dan diskusi dengan AI'),
          line('/afk', 'Pasang status sedang tidak di tempat'),
          line('/ping', 'Cek kecepatan respons bot'),
        ].join('\n'),
      },
      isAdmin
        ? {
            name: 'Pengelola Server',
            value: [
              line('/setwelcome', 'Channel sambutan & member keluar'),
              line('/setverif', 'Setup role & kunci channel sebelum verif'),
              line('/setticket', 'Pasang panel tiket bantuan privat'),
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
    { label: 'Patroli Voice', description: 'Jaga voice channel 24 jam nonstop', value: 'cmd_patroli' },
    { label: 'Stop', description: 'Hentikan patroli dan keluar dari voice', value: 'cmd_stop' },
    { label: 'Tanya AI', description: 'Ajukan pertanyaan ke AI', value: 'cmd_ai' },
    { label: 'AFK', description: 'Pasang status sedang tidak di tempat', value: 'cmd_afk' },
    { label: 'Ping', description: 'Cek kecepatan respons bot', value: 'cmd_ping' },
  ];
  if (isAdmin) {
    menuOptions.push(
      { label: 'Setup Kunci Channel & Verif', description: '[Admin] Setup role & sembunyikan channel', value: 'cmd_setverif' },
      { label: 'Panel Verifikasi', description: '[Admin] Status & panduan pasang panel verifikasi', value: 'cmd_verif' },
      { label: 'Panel Tiket Bantuan', description: '[Admin] Status & panduan pasang panel tiket bantuan', value: 'cmd_ticket' },
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
