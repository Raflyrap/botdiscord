const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { formatDuration } = require('../lavalinkHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Melihat daftar antrean musik yang sedang diputar'),

  async execute(interaction) {
    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        content: 'Tidak ada antrean musik saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const currentSong = player.queue.current;
    const nextSongs = player.queue.tracks.slice(0, 10);
    const totalTracks = (currentSong ? 1 : 0) + player.queue.tracks.length;
    const totalDurationMs =
      (currentSong?.info?.duration || 0) +
      player.queue.tracks.reduce((acc, t) => acc + (t.info?.duration || 0), 0);

    const requesterStr = currentSong?.requester?.id
      ? `<@${currentSong.requester.id}>`
      : (currentSong?.requester?.tag || currentSong?.requester?.username || 'User');

    const repeatLabel = player.repeatMode === 'track' ? 'Lagu' : player.repeatMode === 'queue' ? 'Antrean' : 'Nonaktif';

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: 'SERVER MUSIC QUEUE' })
      .setTitle('Daftar Antrean Musik')
      .setDescription(
        (currentSong
          ? `**Sedang Diputar:**\n[**${currentSong.info.title}**](${currentSong.info.uri || ''})\n` +
            `Artis: \`${currentSong.info.author || 'Tidak Diketahui'}\` • Durasi: \`${formatDuration(currentSong.info.duration)}\` • Pemohon: ${requesterStr}\n\n`
          : '') +
        `**Lagu Berikutnya:**\n` +
        (nextSongs.length > 0
          ? nextSongs
              .map(
                (song, index) =>
                  `\`${index + 1}.\` [${song.info.title}](${song.info.uri || ''}) • \`${formatDuration(song.info.duration)}\``
              )
              .join('\n')
          : '*(Tidak ada antrean lagu selanjutnya)*')
      )
      .setFooter({
        text: `Total Antrean: ${totalTracks} lagu (${formatDuration(totalDurationMs)}) • Loop: ${repeatLabel} • FlyBot HD Music`,
      })
      .setTimestamp();

    if (currentSong?.info?.artworkUrl) {
      embed.setThumbnail(currentSong.info.artworkUrl);
    }

    const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const components = [];

    if (player.queue.tracks.length > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_music_shuffle')
          .setLabel('Acak Antrean (Shuffle)')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_music_skip')
          .setLabel('Lewati Lagu (Skip)')
          .setStyle(ButtonStyle.Secondary)
      );
      components.push(row);
    }

    await interaction.reply({ embeds: [embed], components });
  },
};
