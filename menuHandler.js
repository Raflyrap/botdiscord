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

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle(`Pusat Perintah FlyBot - ${guild.name}`)
    .setDescription(
      `Pilih perintah di menu pilihan bawah untuk langsung menjalankannya.\n\n` +
      `**Perintah Musik:**\n` +
      `• /play - Memutar musik dari Spotify, YouTube, atau SoundCloud\n` +
      `• /pause - Menghentikan sementara lagu yang sedang berputar\n` +
      `• /resume - Melanjutkan lagu yang dihentikan sementara\n` +
      `• /skip - Melewati lagu saat ini dan memutar lagu berikutnya\n` +
      `• /stop - Menghentikan musik dan mengeluarkan bot dari voice\n` +
      `• /queue - Melihat urutan antrean lagu\n` +
      `• /volume - Mengatur volume suara musik bot\n\n` +
      `**Perintah Anggota & AI:**\n` +
      `• /ai - Bertanya dan berdiskusi dengan kecerdasan buatan\n` +
      `• /afk - Mengaktifkan status sedang tidak di tempat (AFK)\n` +
      `• /ping - Memeriksa waktu respons dan sinyal bot\n\n` +
      (isAdmin
        ? `**Perintah Pengelola Server (Admin):**\n` +
          `• /setwelcome - Mengatur saluran pesan sambutan anggota baru\n` +
          `• /autorole - Memberikan peran otomatis untuk anggota baru\n` +
          `• /antitoxic - Mengelola kata yang dilarang di server\n` +
          `• /buatembed - Membuat pesan informasi berbingkai\n`
        : `*Catatan: Perintah pengaturan server hanya dapat dijalankan oleh Admin.*`)
    )
    .setFooter({ text: 'FlyBot System' })
    .setTimestamp();

  // Opsi dropdown interaktif langsung ke perintahnya
  const menuOptions = [
    {
      label: '/play',
      description: 'Memutar musik dari judul atau link',
      value: 'cmd_play'
    },
    {
      label: '/pause',
      description: 'Menjeda pemutaran musik sementara',
      value: 'cmd_pause'
    },
    {
      label: '/resume',
      description: 'Melanjutkan kembali lagu yang dijeda',
      value: 'cmd_resume'
    },
    {
      label: '/skip',
      description: 'Melewati lagu ke urutan berikutnya',
      value: 'cmd_skip'
    },
    {
      label: '/stop',
      description: 'Menghentikan musik dan keluar dari voice',
      value: 'cmd_stop'
    },
    {
      label: '/queue',
      description: 'Melihat daftar antrean lagu',
      value: 'cmd_queue'
    },
    {
      label: '/volume',
      description: 'Mengatur tingkat volume musik',
      value: 'cmd_volume'
    },
    {
      label: '/ai',
      description: 'Mengajukan pertanyaan ke kecerdasan buatan AI',
      value: 'cmd_ai'
    },
    {
      label: '/afk',
      description: 'Mengatur status sedang tidak di tempat (AFK)',
      value: 'cmd_afk'
    },
    {
      label: '/ping',
      description: 'Memeriksa kecepatan respons sinyal bot',
      value: 'cmd_ping'
    },
    // Fitur Khusus Admin (Bisa dilihat tapi diverifikasi permission)
    {
      label: '/autorole (Admin)',
      description: 'Mengatur peran otomatis untuk anggota baru',
      value: 'cmd_autorole'
    },
    {
      label: '/antitoxic (Admin)',
      description: 'Melihat daftar kata terlarang di server',
      value: 'cmd_antitoxic'
    }
  ];

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('menu_direct_action')
    .setPlaceholder('Pilih perintah yang ingin langsung dijalankan...')
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
