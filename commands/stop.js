const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { removePatroliActive } = require('../patroliHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Menghentikan musik, patroli 24 jam, mengosongkan antrean, dan keluar dari voice channel'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Cabut status patroli jika aktif
    removePatroliActive(interaction.guildId);

    const queue = interaction.client.distube.getQueue(interaction.guildId);
    if (!queue) {
      // Jika queue tidak ada tapi bot masih nyangkut di voice, disconnect
      const meVoice = interaction.guild.members.me?.voice;
      if (meVoice?.channel) {
        meVoice.disconnect().catch(() => {});
        return interaction.reply('Patroli dihentikan dan bot telah keluar dari voice channel.');
      }

      return interaction.reply({
        content: 'Tidak ada musik atau patroli yang sedang berjalan saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      queue.setRepeatMode(0);
      await queue.stop();
    } catch (e) {
      console.error('Error saat queue.stop:', e);
    }

    const meVoice = interaction.guild.members.me?.voice;
    if (meVoice?.channel) {
      meVoice.disconnect().catch(() => {});
    }

    await interaction.reply('Musik dan mode patroli telah dihentikan, antrean dibersihkan, dan bot telah keluar dari voice channel.');
  },
};
