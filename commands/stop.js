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

    // Hentikan player Lavalink jika ada
    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    let wasMusic = false;
    if (player) {
      wasMusic = true;
      try {
        await player.destroy('UserStop');
      } catch (e) {
        console.error('Error saat player.destroy:', e);
      }
    }

    // Pastikan bot keluar dari voice channel jika masih tersisa
    const meVoice = interaction.guild.members.me?.voice;
    if (meVoice?.channel) {
      meVoice.disconnect().catch(() => {});
    }

    if (wasPatroli && wasMusic) {
      return interaction.reply('🛡️ Mode patroli dan musik telah dihentikan, antrean dibersihkan, dan bot keluar dari voice channel.');
    }

    if (wasPatroli) {
      return interaction.reply('🛡️ Mode patroli 24 jam telah dinonaktifkan dan bot telah keluar dari voice channel.');
    }

    if (!wasMusic) {
      return interaction.reply({
        content: 'Tidak ada patroli atau musik yang sedang berjalan saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.reply('⏹️ Musik telah dihentikan, antrean dibersihkan, dan bot telah keluar dari voice channel.');
  },
};
