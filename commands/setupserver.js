const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { createSetupWizardPanel } = require('../setupWizardHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupserver')
    .setDescription('Membuka wizard persiapan server interaktif (Pusat Persiapan Server)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    // Validasi izin administrator
    const isAdmin = interaction.member && (
      interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
    );

    if (!isAdmin) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan oleh Administrator server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const panel = createSetupWizardPanel(interaction.user);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(panel);
    } else {
      await interaction.reply(panel);
    }
  },
};
