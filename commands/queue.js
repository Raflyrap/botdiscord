const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Melihat daftar antrean musik yang sedang diputar'),

  async execute(interaction) {
    const queue = interaction.client.distube.getQueue(interaction.guildId);
    if (!queue || !queue.songs || queue.songs.length === 0) {
      return interaction.reply({
        content: '❌ Tidak ada antrean musik saat ini!',
        ephemeral: true,
      });
    }

    const currentSong = queue.songs[0];
    const nextSongs = queue.songs.slice(1, 11);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🎶 Antrean Musik Server')
      .setDescription(
        `**Sedang Diputar:**\n[${currentSong.name}](${currentSong.url}) - \`${currentSong.formattedDuration}\`\n*Diminta oleh:* ${currentSong.user}\n\n` +
        `**Lagu Berikutnya:**\n` +
        (nextSongs.length > 0
          ? nextSongs
              .map(
                (song, index) =>
                  `**${index + 1}.** [${song.name}](${song.url}) - \`${song.formattedDuration}\``
              )
              .join('\n')
          : '*(Tidak ada antrean lagu selanjutnya)*')
      )
      .setFooter({
        text: `Total Antrean: ${queue.songs.length} lagu | Volume: ${queue.volume}%`,
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
