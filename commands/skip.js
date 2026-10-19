const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Melewati lagu yang sedang diputar ke lagu berikutnya'),

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
    if (!player || !player.queue.current) {
      return interaction.reply({
        content: 'Tidak ada musik yang sedang diputar saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const skippedTrack = player.queue.current;
      const nextSong = player.queue.tracks[0];
      await player.skip();

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: 'TRACK SKIPPED' })
        .setTitle(skippedTrack?.info?.title || 'Lagu Berhasil Dilewati')
        .setDescription(
          nextSong
            ? `Sekarang memutar: **${nextSong.info.title}**`
            : 'Seluruh antrean lagu telah selesai diputar.'
        )
        .setFooter({ text: 'FlyBot HD Music • Queue Progression' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('[SKIP ERROR]:', error);
      await interaction.reply({
        content: `Gagal melewati lagu: ${error.message || 'Terjadi kesalahan sistem.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
