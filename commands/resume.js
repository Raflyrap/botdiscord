const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resume')
    .setDescription('Melanjutkan pemutaran musik yang sedang dijeda'),

  async execute(interaction) {
    const member = interaction.member?.voice
      ? interaction.member
      : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: '❌ Kamu harus berada di dalam Voice Channel!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        content: '❌ Tidak ada musik yang sedang diputar atau dijeda saat ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!player.paused) {
      return interaction.reply({
        content: '⚠️ Musik sedang diputar (tidak dalam keadaan dijeda)!',
        flags: MessageFlags.Ephemeral,
      });
    }

    await player.resume();
    await interaction.reply('▶️ Musik dilanjutkan kembali.');
  },
};
