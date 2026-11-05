const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require('discord.js');
const { hitamkanImage } = require('../hitamkanHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hitamkan')
    .setDescription('Ubah wajah atau foto menjadi hitam secara otomatis')
    .addAttachmentOption((opt) =>
      opt
        .setName('gambar')
        .setDescription('Upload file foto wajah/orang yang ingin dihitamkan')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Atau masukkan URL link foto yang ingin dihitamkan')
        .setRequired(false)
    ),

  async execute(interaction) {
    const attachment = interaction.options.getAttachment('gambar');
    const urlOption = interaction.options.getString('url');

    let targetUrl = null;
    if (attachment && attachment.contentType?.startsWith('image/')) {
      targetUrl = attachment.url;
    } else if (urlOption && /^https?:\/\//i.test(urlOption.trim())) {
      targetUrl = urlOption.trim();
    }

    if (!targetUrl) {
      return interaction.reply({
        content: 'Silakan upload file gambar atau masukkan URL gambar yang valid.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const result = await hitamkanImage(targetUrl);
    if (!result.success) {
      return interaction.editReply(`Gagal memproses gambar: ${result.error}`);
    }

    const file = new AttachmentBuilder(result.buffer, { name: 'hitamkan.png' });
    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle('Foto Berhasil Dihitamkan')
      .setDescription(
        `Efek transformasi hitamkan berhasil diterapkan pada gambar.\n\n` +
        `• Format: **PNG**\n` +
        `• Ukuran: **${result.size}**\n` +
        `• Engine: **${result.engine || 'AI Neural Engine'}**\n` +
        `• Deteksi Kulit: **${result.skinDetected ? 'Wajah / Kulit Terdeteksi' : 'Filter Gelap Diterapkan'}**`
      )
      .setImage('attachment://hitamkan.png')
      .setFooter({ text: `FlyBot Hitamkan • Diminta oleh ${interaction.user.username}` })
      .setTimestamp();

    return interaction.editReply({
      embeds: [embed],
      files: [file],
    });
  },
};

