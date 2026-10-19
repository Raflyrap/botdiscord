const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

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
        content: 'Kamu harus berada di dalam voice channel untuk menggunakan perintah ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        content: 'Tidak ada musik yang sedang diputar atau dijeda saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!player.paused) {
      return interaction.reply({
        content: 'Musik sedang diputar aktif (tidak dalam keadaan dijeda).',
        flags: MessageFlags.Ephemeral,
      });
    }

    await player.resume();

    const currentTitle = player.queue.current?.info?.title;
    const embed = new EmbedBuilder()
      .setColor(0x1DB954)
      .setAuthor({ name: 'PLAYBACK RESUMED' })
      .setDescription(currentTitle ? `Melanjutkan pemutaran: **${currentTitle}**` : 'Pemutaran musik telah dilanjutkan kembali.')
      .setFooter({ text: 'Lavalink Audio System • High Fidelity' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
