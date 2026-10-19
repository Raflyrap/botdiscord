const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Mengatur tingkat volume musik (1 - 100%)')
    .addIntegerOption((option) =>
      option
        .setName('persen')
        .setDescription('Tingkat volume dari 1 sampai 100')
        .setMinValue(1)
        .setMaxValue(100)
        .setRequired(true)
    ),

  async execute(interaction) {
    const member = interaction.member?.voice
      ? interaction.member
      : await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);

    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      return interaction.reply({
        content: 'Kamu harus berada di dalam voice channel untuk mengatur volume.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
      return interaction.reply({
        content: 'Tidak ada musik yang sedang diputar saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const volume = interaction.options.getInteger('persen');
    await player.setVolume(volume);

    const filledBlocks = Math.round(volume / 10);
    const emptyBlocks = 10 - filledBlocks;
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: 'VOLUME ADJUSTED' })
      .setDescription(`Tingkat volume telah diatur ke **${volume}%**\n\`[${bar}]\``)
      .setFooter({ text: 'FlyBot HD Music • Volume Control' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
