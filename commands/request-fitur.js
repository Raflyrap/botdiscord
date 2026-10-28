const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const {
  isOfficialGuild,
  createRequestModal,
} = require('../featureRequestHelper');
const { getOfficialInviteUrl } = require('../ownerHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('request-fitur')
    .setDescription('Ajukan ide dan saran fitur baru untuk pengembangan FlyBot (Khusus Server Official)'),

  async execute(interaction) {
    if (!isOfficialGuild(interaction.guildId)) {
      const inviteUrl = getOfficialInviteUrl();
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Join Server Official FlyBot')
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl)
      );

      return interaction.reply({
        content:
          'Fitur request usulan hanya tersedia secara eksklusif di Server Official FlyBot.\n' +
          'Silakan bergabung ke server official kami untuk menyampaikan ide, saran fitur, serta berpartisipasi dalam voting pengembangan bot.',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    const modal = createRequestModal();
    return interaction.showModal(modal);
  },
};
