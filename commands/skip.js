const { SlashCommandBuilder, MessageFlags } = require('discord.js');

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
        content: '❌ Kamu harus berada di dalam Voice Channel!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    if (!player || !player.queue.current) {
      return interaction.reply({
        content: '❌ Tidak ada musik yang sedang diputar saat ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const nextSong = player.queue.tracks[0];
      await player.skip();

      if (nextSong) {
        await interaction.reply(`⏭️ Lagu dilewati! Sekarang memutar: **${nextSong.info.title}**`);
      } else {
        await interaction.reply('⏭️ Lagu dilewati. Tidak ada lagi lagu di antrean.');
      }
    } catch (error) {
      console.error('[SKIP ERROR]:', error);
      await interaction.reply({
        content: `❌ Gagal melewati lagu: ${error.message || 'Terjadi kesalahan sistem'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
