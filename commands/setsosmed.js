const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  setupModularFeature,
  removeModularFeature,
} = require('../modularSetupHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setsosmed')
    .setDescription('Setup kategori & channel otomatis Downloader Sosmed (TikTok, IG, FB, YT no watermark)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus channel downloader (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Kategori & Channel Sosmed Converter)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Sosmed Converter)', value: 'hapus' }
        )
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.options.getString('aksi') || 'setup';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupModularFeature(interaction.guild, 'sosmed');

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Sosmed Downloader`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Converter Sosmed Berhasil Dibuat')
          .setDescription(
            'Kategori dan 4 channel auto-converter siap digunakan:\n\n' +
            '• **TikTok Converter**: Download video no-watermark & foto slideshow\n' +
            '• **Instagram Converter**: Download Reels, Post Feed & Carousel\n' +
            '• **Facebook Converter**: Download Video & Reels Facebook HD\n' +
            '• **YouTube Converter**: Download Shorts & Video YouTube\n\n' +
            '*Member cukup kirim link sosmed ke channel masing-masing. Chat otomatis dibersihkan setiap 24 jam!*'
          )
          .setFooter({ text: 'Gunakan /setsosmed aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setsosmed:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Sosmed Downloader: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        removeModularFeature(interaction.guild.id, 'sosmed');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Sosmed Converter Dihapus')
          .setDescription('Pengaturan channel converter sosial media telah dinonaktifkan.')
          .setFooter({ text: 'Ketik /setsosmed kembali jika ingin mengaktifkannya sewaktu-waktu.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `Gagal menghapus konfigurasi: ${err.message}`,
        });
      }
    }
  },
};
