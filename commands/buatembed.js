const {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buatembed')
    .setDescription('Membuka formulir pop-up untuk membuat embed estetik kustom sendiri')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    // Membuat Modal interaktif
    const modal = new ModalBuilder()
      .setCustomId('modal_buat_embed')
      .setTitle('🎨 Desain Embed Estetik');

    // Input 1: Judul Embed
    const inputJudul = new TextInputBuilder()
      .setCustomId('embed_judul')
      .setLabel('Judul Embed')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: 📌 PENGUMUMAN PENTING MINGGU INI')
      .setRequired(true)
      .setMaxLength(256);

    // Input 2: Isi Pesan / Deskripsi
    const inputDeskripsi = new TextInputBuilder()
      .setCustomId('embed_deskripsi')
      .setLabel('Isi Pesan / Konten (Support Markdown)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Tuliskan isi pesanmu di sini. Gunakan **tebal**, *miring*, dan emoji untuk tampilan estetik...')
      .setRequired(true);

    // Input 3: Warna Hex
    const inputWarna = new TextInputBuilder()
      .setCustomId('embed_warna')
      .setLabel('Kode Warna Hex (Opsional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: #5865F2, #FF8DA1, #2B2D31, #FEE75C')
      .setRequired(false)
      .setMaxLength(7);

    // Input 4: URL Gambar Banner
    const inputBanner = new TextInputBuilder()
      .setCustomId('embed_banner')
      .setLabel('URL Gambar Banner Bawah (Opsional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('https://i.imgur.com/contoh.png')
      .setRequired(false);

    // Input 5: Footer
    const inputFooter = new TextInputBuilder()
      .setCustomId('embed_footer')
      .setLabel('Teks Footer Bawah (Opsional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Contoh: Powered by FlyBot • Server Official')
      .setRequired(false)
      .setMaxLength(100);

    // Memasukkan setiap input ke dalam ActionRow
    modal.addComponents(
      new ActionRowBuilder().addComponents(inputJudul),
      new ActionRowBuilder().addComponents(inputDeskripsi),
      new ActionRowBuilder().addComponents(inputWarna),
      new ActionRowBuilder().addComponents(inputBanner),
      new ActionRowBuilder().addComponents(inputFooter)
    );

    // Tampilkan modal kepada user
    await interaction.showModal(modal);
  },
};
