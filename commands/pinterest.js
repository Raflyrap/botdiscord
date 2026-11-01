const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { searchPinterest } = require('../pinterestHelper');

// Cache pagination hasil pencarian pinterest sementara (key: searchId)
const pinSearchCache = new Map();

function buildPinRow(searchId, currIdx, totalImgs, directUrl) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_pin_${searchId}_${currIdx - 1}`)
      .setLabel('Sebelumnya')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currIdx <= 0),
    new ButtonBuilder()
      .setCustomId(`btn_pin_${searchId}_${currIdx + 1}`)
      .setLabel('Berikutnya')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(currIdx >= totalImgs - 1),
    new ButtonBuilder()
      .setLabel('Buka Gambar Asli')
      .setStyle(ButtonStyle.Link)
      .setURL(directUrl)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pinterest')
    .setDescription('Cari inspirasi gambar estetik & wallpaper berkualitas tinggi dari Pinterest')
    .addStringOption((opt) =>
      opt
        .setName('query')
        .setDescription('Kata kunci pencarian (contoh: anime aesthetic, cyberpunk car, minimalist wallpaper)')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('jumlah')
        .setDescription('Jumlah foto yang diambil (5 - 15 gambar, default: 5)')
        .setRequired(false)
        .setMinValue(5)
        .setMaxValue(15)
    ),

  pinSearchCache,
  buildPinRow,

  async execute(interaction) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const limit = interaction.options.getInteger('jumlah') || 5;

    try {
      const res = await searchPinterest(query, limit);

      if (!res.success || !res.images || res.images.length === 0) {
        return interaction.editReply({
          content: `Tidak dapat menemukan gambar Pinterest untuk kata kunci **"${query}"**: ${res.error || 'Hasil kosong.'}`,
        });
      }

      const searchId = `${Date.now()}_${interaction.user.id}`;
      pinSearchCache.set(searchId, {
        query,
        images: res.images,
        userId: interaction.user.id,
      });

      // Bersihkan cache setelah 15 menit
      setTimeout(() => pinSearchCache.delete(searchId), 15 * 60 * 1000);

      const firstImage = res.images[0];
      const embed = new EmbedBuilder()
        .setColor(0xE60023) // Pinterest Red
        .setAuthor({
          name: 'FlyBot Search • Pinterest Image Gallery',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Hasil Pinterest: "${query}"`)
        .setDescription(`Menampilkan gambar **1 dari ${res.images.length}** yang ditemukan.`)
        .setImage(firstImage)
        .setFooter({ text: `Halaman 1 / ${res.images.length} • Diminta oleh ${interaction.user.username}` })
        .setTimestamp();

      const row = buildPinRow(searchId, 0, res.images.length, firstImage);

      return interaction.editReply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error('Error saat eksekusi /pinterest:', err);
      return interaction.editReply({
        content: `Terjadi kendala saat mencari di Pinterest: ${err.message}`,
      });
    }
  },
};

