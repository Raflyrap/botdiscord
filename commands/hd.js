const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { enhanceImage } = require('../imageHdHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hd')
    .setDescription('Tingkatkan kualitas resolusi dan ketajaman gambar secara instan')
    .addAttachmentOption((opt) =>
      opt
        .setName('gambar')
        .setDescription('Upload file gambar yang ingin di-HD-in (JPG, PNG, WebP)')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('skala')
        .setDescription('Pilihan pembesaran (default: 4x Ultra HD)')
        .setRequired(false)
        .addChoices(
          { name: '4x Ultra HD (Paling Tajam & Maksimal)', value: 4 },
          { name: '2x HD (Cepat)', value: 2 }
        )
    ),

  async execute(interaction) {
    const attachment = interaction.options.getAttachment('gambar');
    const scale = interaction.options.getInteger('skala') || 4;

    if (!attachment) {
      return interaction.reply({
        content: 'Silakan upload file gambar yang ingin diproses.',
        ephemeral: true,
      });
    }

    const contentType = attachment.contentType || '';
    const isImage =
      contentType.startsWith('image/') ||
      /\.(png|jpe?g|webp|bmp|tiff)$/i.test(attachment.name || attachment.url);

    if (!isImage) {
      return interaction.reply({
        content: 'File yang diupload bukan format gambar yang valid. Gunakan file JPG, PNG, atau WebP.',
        ephemeral: true,
      });
    }

    await interaction.deferReply();

    const result = await enhanceImage(attachment.url, { scale });

    if (!result.success) {
      return interaction.editReply({
        content: `Gagal memproses gambar: ${result.error}`,
      });
    }

    const file = new AttachmentBuilder(result.buffer, { name: result.fileName });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Peningkatan Kualitas Gambar Selesai')
      .setDescription(
        `Gambar kamu berhasil ditingkatkan dengan AI Super-Resolution.\n\n` +
        `• Resolusi Awal: **${result.originalWidth}x${result.originalHeight}**\n` +
        `• Resolusi Baru: **${result.newWidth}x${result.newHeight}** (${result.scale}x Ultra HD)\n` +
        `• Mesin: **${result.engine || 'Real-ESRGAN AI (4x-UltraSharp GPU)'}**\n` +
        `• Waktu Proses: **${(result.processTimeMs / 1000).toFixed(1)} detik**\n\n` +
        `> **Cara Melihat Kualitas Asli:**\n` +
        `> Discord otomatis mengecilkan preview di chat. **Klik foto di bawah, lalu klik "Buka yang asli" di pojok kiri bawah** untuk melihat gambar penuh tanpa kompresi Discord!`
      )
      .setImage(`attachment://${result.fileName}`)
      .setFooter({
        text: `FlyBot Image Enhancer • Diminta oleh ${interaction.user.username}`,
      })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [file],
    });
  },
};
