const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { removeBgImage } = require('../removeBgHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('removebg')
    .setDescription('Hapus background / latar belakang gambar secara instan menjadi transparan')
    .addAttachmentOption((opt) =>
      opt
        .setName('gambar')
        .setDescription('Upload file gambar yang ingin dihapus background-nya')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('url')
        .setDescription('Link URL gambar (contoh: https://domain.com/foto.jpg)')
        .setRequired(false)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const attachment = interaction.options.getAttachment('gambar');
    const urlInput = interaction.options.getString('url');

    let imageUrl = attachment?.url || (urlInput ? urlInput.trim() : null);

    if (!imageUrl) {
      return interaction.editReply({
        content: 'Harap upload file gambar atau masukkan link URL gambar yang valid.',
      });
    }

    try {
      const res = await removeBgImage(imageUrl);

      if (!res.success) {
        return interaction.editReply({
          content: `Gagal menghapus background: ${res.error}`,
        });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: 'FlyBot Tools • Remove Background AI',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle('Background Gambar Berhasil Dihapus')
        .setDescription(
          `Background foto berhasil dipisahkan dan diubah menjadi transparan (PNG murni).\n\n` +
          `• Format: **${(res.format || 'png').toUpperCase()}**\n` +
          `• Ukuran File: **${res.size || 'N/A'}**\n` +
          (res.responseTime ? `• Kecepatan Respon: **${res.responseTime}**\n\n` : '\n') +
          `> **Tips:** Klik tombol **"Buka Gambar Transparan"** di bawah atau klik gambar untuk menyimpannya dalam kualitas penuh tanpa kompresi Discord!`
        )
        .setImage(res.resultUrl)
        .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Buka Gambar Transparan')
          .setStyle(ButtonStyle.Link)
          .setURL(res.resultUrl)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('Error saat eksekusi /removebg:', err);
      return interaction.editReply({
        content: `Terjadi kesalahan saat memproses gambar: ${err.message}`,
      });
    }
  },
};
