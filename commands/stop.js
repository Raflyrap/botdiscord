const { SlashCommandBuilder, MessageFlags } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Menghentikan musik, mengosongkan antrean, dan keluar dari voice channel'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Bot belum diundang ke server ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const member = interaction.member?.voice
      ? interaction.member
      : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

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

    await queue.stop();
    await interaction.reply('⏹️ Musik telah dihentikan dan antrean dibersihkan.');
  },
};
