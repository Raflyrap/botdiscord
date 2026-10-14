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

    const queue = interaction.client.distube.getQueue(interaction.guildId);
    if (!queue) {
      return interaction.reply({
        content: '❌ Tidak ada musik yang sedang diputar saat ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const song = await queue.skip();
      await interaction.reply(`⏭️ Lagu dilewati! Sekarang memutar: **${song.name}**`);
    } catch (error) {
      // Jika tidak ada lagu lagi di antrean
      await queue.stop();
      await interaction.reply('⏭️ Tidak ada lagu lagi di antrean. Musik dihentikan.');
    }
  },
};
