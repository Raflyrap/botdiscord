const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getMainDashboard } = require('../menuHandler');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('menu')
    .setDescription('Membuka pusat kontrol interaktif FlyBot (Semua fitur cukup diklik!)'),

  async execute(interaction) {
    const dashboard = getMainDashboard(interaction.guild, interaction.member);
    await interaction.reply({ ...dashboard, flags: MessageFlags.Ephemeral });
  },

};
