const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('Mengatur mode pengulangan musik (loop 1 lagu atau loop antrean)')
    .addStringOption((option) =>
      option
        .setName('mode')
        .setDescription('Pilih mode pengulangan (default: toggle loop 1 lagu)')
        .setRequired(false)
        .addChoices(
          { name: 'Loop 1 Lagu yang Sedang Diputar', value: 'track' },
          { name: 'Loop Seluruh Antrean', value: 'queue' },
          { name: 'Matikan Loop', value: 'off' }
        )
    ),

  async execute(interaction) {
    const member = interaction.member?.voice
      ? interaction.member
      : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'Kamu harus berada di dalam voice channel untuk mengatur mode repeat.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.reply({
        content: 'Tidak ada lagu yang sedang diputar saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const selectedMode = interaction.options.getString('mode');
    let targetMode = selectedMode;

    // Jika user tidak memilih opsi, toggle loop lagu saat ini (track <-> off)
    if (!targetMode) {
      targetMode = player.repeatMode === 'track' ? 'off' : 'track';
    }

    await player.setRepeatMode(targetMode);

    const currentSong = player.queue.current;
    let title = '';
    let description = '';
    let color = 0x5865F2;

    if (targetMode === 'track') {
      title = 'Loop 1 Lagu Diaktifkan';
      description = `Lagu **${currentSong.info.title}** akan diputar berulang terus-menerus. Ketik \`/repeat\` lagi untuk mematikan.`;
      color = 0x1DB954;
    } else if (targetMode === 'queue') {
      title = 'Loop Antrean Diaktifkan';
      description = 'Seluruh daftar antrean lagu akan diputar berulang terus-menerus.';
      color = 0x5865F2;
    } else {
      title = 'Loop Dinonaktifkan';
      description = 'Pemutaran musik kembali ke mode normal (lanjut ke antrean berikutnya).';
      color = 0x72767D;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({ name: 'REPEAT MODE UPDATED' })
      .setTitle(title)
      .setDescription(`> ${description}`)
      .setFooter({ text: 'FlyBot HD Music • Repeat Control' })
      .setTimestamp();

    if (currentSong?.info?.artworkUrl) {
      embed.setThumbnail(currentSong.info.artworkUrl);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
