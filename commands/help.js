const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  // Definisi metadata slash command
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan daftar semua perintah yang tersedia'),

  // Fungsi yang dijalankan ketika user mengetik /help
  async execute(interaction) {
    // Ambil koleksi command dari client bot
    const commands = interaction.client.commands;

    // Buat embed Discord yang rapi dan menarik
    const embed = new EmbedBuilder()
      .setColor(0x5865F2) // Warna Blurple khas Discord
      .setTitle('📚 Daftar Perintah Bot')
      .setDescription('Berikut daftar slash command yang tersedia di server ini:')
      .setFooter({ text: `Diminta oleh ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    // Masukkan setiap command ke dalam field embed secara dinamis
    commands.forEach((command) => {
      embed.addFields({
        name: `/${command.data.name}`,
        value: command.data.description || 'Tidak ada deskripsi.',
        inline: false,
      });
    });

    // Balas interaksi dengan embed yang sudah dibuat
    await interaction.reply({ embeds: [embed] });
  },
};
