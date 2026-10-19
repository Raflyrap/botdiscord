const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { formatDuration } = require('../lavalinkHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Mengacak urutan lagu di dalam antrean pemutaran musik'),

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
        content: 'Tidak ada musik yang sedang diputar atau berada di dalam antrean saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (player.queue.tracks.length <= 1) {
      return interaction.reply({
        content:
          player.queue.tracks.length === 0
            ? 'Hanya ada 1 lagu yang sedang diputar dan tidak ada lagu berikutnya di antrean untuk diacak.'
            : 'Hanya ada 1 lagu berikutnya di antrean. Minimal dibutuhkan 2 lagu di antrean untuk mengacak.',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const count = player.queue.tracks.length;
      await player.queue.shuffle();

      const previewTracks = player.queue.tracks.slice(0, 5);
      const previewList = previewTracks
        .map(
          (t, i) =>
            `\`${i + 1}.\` [${t.info.title.length > 55 ? t.info.title.substring(0, 52) + '...' : t.info.title}](${t.info.uri || ''}) • \`${formatDuration(t.info.duration)}\``
        )
        .join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: 'QUEUE SHUFFLED' })
        .setTitle('Urutan Antrean Berhasil Diacak')
        .setDescription(
          `Berhasil mengacak **${count} lagu** di dalam antrean pemutaran.\n\n` +
          `**Pratinjau Urutan Baru Berikutnya:**\n${previewList}` +
          (count > 5 ? `\n*...dan ${count - 5} lagu lainnya di antrean.*` : '')
        )
        .setFooter({ text: 'FlyBot HD Music • Gunakan /queue untuk melihat daftar lengkap' })
        .setTimestamp();

      if (player.queue.current?.info?.artworkUrl) {
        embed.setThumbnail(player.queue.current.info.artworkUrl);
      }

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('[SHUFFLE ERROR]:', error);
      await interaction.reply({
        content: `Gagal mengacak antrean: ${error.message || 'Terjadi kesalahan sistem.'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
