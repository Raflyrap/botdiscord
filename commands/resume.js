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

    const queue = interaction.client.distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({
        content: '❌ Tidak ada musik yang sedang diputar saat ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!queue.paused) {
      return interaction.reply({
        content: '⚠️ Musik sedang diputar (tidak dalam keadaan dijeda)!',
        flags: MessageFlags.Ephemeral,
      });
    }

    queue.resume();
    await interaction.reply('▶️ Musik dilanjutkan kembali.');
  },
};
