const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('Menjeda musik yang sedang diputar'),

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
        content: 'Tidak ada musik yang sedang diputar saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (player.paused) {
      return interaction.reply({
        content: 'Musik sudah dalam keadaan dijeda. Gunakan `/resume` untuk melanjutkan.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await player.pause();

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setAuthor({ name: 'PLAYBACK PAUSED' })
      .setDescription('Pemutaran musik telah dijeda.')
      .setFooter({ text: 'Ketik /resume untuk melanjutkan pemutaran • Lavalink Audio' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
