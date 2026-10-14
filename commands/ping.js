const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  // Definisi metadata slash command
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Memeriksa latency bot dan koneksi WebSocket Discord'),

  // Fungsi yang dijalankan ketika user mengetik /ping
  async execute(interaction) {
    // Kirim pesan awal
    await interaction.reply('🏓 Mengukur latency...');
    const sent = await interaction.fetchReply();
    
    // Selisih waktu pesan dikirim dan dibalas
    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    // Latency koneksi WebSocket ke server Discord API
    const wsLatency = interaction.client.ws.ping;

    // Perbarui balasan dengan hasil perhitungan latency
    await interaction.editReply(
      `🏓 **Pong!**\n` +
      `⏱️ Latency Bot: **${roundtripLatency}ms**\n` +
      `📡 WebSocket API: **${wsLatency}ms**`
    );
  },
};
