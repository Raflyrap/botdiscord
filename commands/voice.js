const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  activeTempChannels,
  createControlPanelEmbed,
  createControlPanelComponents,
} = require('../tempVoiceHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('Membuka panel kontrol room suara mandiri kamu (Gembok 🔒 privat, limit, rename, dll)'),

  async execute(interaction) {
    const voiceChannelId = interaction.member?.voice?.channelId;
    let targetChannelId = voiceChannelId;

    if (!targetChannelId && activeTempChannels.has(interaction.channelId)) {
      targetChannelId = interaction.channelId;
    }

    if (!targetChannelId || !activeTempChannels.has(targetChannelId)) {
      return interaction.reply({
        content:
          '❌ Kamu sedang tidak berada di dalam voice room sementara!\n' +
          'Silakan bergabung ke channel **➕︱Buat Room Voice** untuk membuat room mandiri kamu sendiri.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const roomData = activeTempChannels.get(targetChannelId);
    const channel = interaction.guild.channels.cache.get(targetChannelId);

    const embed = createControlPanelEmbed(roomData, interaction.guild);
    const components = createControlPanelComponents(roomData);

    return interaction.reply({
      content: `🎛️ **Panel Kontrol Voice Room** untuk <#${channel.id}>:`,
      embeds: [embed],
      components: components,
      flags: MessageFlags.Ephemeral,
    });
  },
};
