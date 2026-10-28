const { SlashCommandBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const { removePatroliActive, leavePatroliChannel, cancelPatroliReconnect } = require('../patroliHelper');

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

    await interaction.deferReply();

    // Batalkan segala antrean reconnect patroli dan cabut status aktif
    cancelPatroliReconnect(interaction.guildId);
    const wasPatroli = removePatroliActive(interaction.guildId);
    leavePatroliChannel(interaction.guildId);

    // Hentikan Voice AI jika aktif (beserta salam pamit suara)
    const { stopVoiceAiSession, getVoiceAiSession } = require('../voiceAiHelper');
    const wasVoiceAi = !!getVoiceAiSession(interaction.guildId);
    if (wasVoiceAi) {
      await stopVoiceAiSession(interaction.guildId, true);
    }

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

    if (!wasPatroli && !wasMusic && !wasVoiceAi) {
      return interaction.editReply({
        content: 'Tidak ada musik, sesi patroli, atau Voice AI yang sedang aktif saat ini.',
      });
    }

    let descriptionText = '';
    if (wasVoiceAi) {
      descriptionText = 'Sesi Voice AI telah dihentikan dan bot telah keluar dari voice channel.';
    } else if (wasPatroli && wasMusic) {
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
      .setFooter({ text: 'Sesi dihentikan • FlyBot HD Music' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
