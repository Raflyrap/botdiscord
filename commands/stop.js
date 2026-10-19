const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { removePatroliActive, leavePatroliChannel } = require('../patroliHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Menghentikan musik, patroli 24 jam, mengosongkan antrean, dan keluar dari voice channel'),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Cabut status patroli jika aktif
    const wasPatroli = removePatroliActive(interaction.guildId);
    leavePatroliChannel(interaction.guildId);

    // Hentikan player Lavalink jika ada
    const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
    let wasMusic = false;
    if (player) {
      wasMusic = true;
      try {
        await player.destroy('UserStop');
      } catch (e) {
        console.error('Error saat player.destroy:', e);
      }
    }

    // Pastikan bot keluar dari voice channel jika masih tersisa
    const meVoice = interaction.guild.members.me?.voice;
    if (meVoice?.channel) {
      meVoice.disconnect().catch(() => {});
    }

    if (!wasPatroli && !wasMusic) {
      return interaction.reply({
        content: 'Tidak ada musik atau sesi patroli yang sedang aktif saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let descriptionText = '';
    if (wasPatroli && wasMusic) {
      descriptionText = 'Mode patroli dan pemutaran musik telah dihentikan. Seluruh antrean dibersihkan dan bot telah keluar dari voice channel.';
    } else if (wasPatroli) {
      descriptionText = 'Mode patroli 24 jam telah dinonaktifkan dan bot telah keluar dari voice channel.';
    } else {
      descriptionText = 'Pemutaran musik telah dihentikan, seluruh antrean dibersihkan, dan bot telah keluar dari voice channel.';
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setAuthor({ name: 'PLAYBACK STOPPED' })
      .setDescription(descriptionText)
      .setFooter({ text: 'Sesi dihentikan • Lavalink Audio System' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
