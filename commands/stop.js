const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { removePatroliActive, leavePatroliChannel } = require('../patroliHelper');

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
    const wasPatroli = removePatroliActive(interaction.guildId);
    leavePatroliChannel(interaction.guildId);

    // Hentikan queue musik DisTube jika ada
    const queue = interaction.client.distube?.getQueue(interaction.guildId);
    if (queue) {
      try {
        queue.setRepeatMode(0);
        await queue.stop();
      } catch (e) {
        console.error('Error saat queue.stop:', e);
      }
    }

    // Pastikan bot keluar dari voice channel
    const meVoice = interaction.guild.members.me?.voice;
    if (meVoice?.channel) {
      meVoice.disconnect().catch(() => {});
    }

    if (wasPatroli) {
      return interaction.reply('🛡️ Mode patroli 24 jam telah dinonaktifkan dan bot telah keluar dari voice channel.');
    }

    if (!queue) {
      return interaction.reply({
        content: 'Tidak ada patroli atau musik yang sedang berjalan saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply('Musik telah dihentikan, antrean dibersihkan, dan bot telah keluar dari voice channel.');
  },
};
