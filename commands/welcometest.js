const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildWelcomePayload, buildLeavePayload, resolveChannel } = require('../welcomeHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Menguji dan melihat preview pesan welcome dan leave dengan banner server di server ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('tipe')
        .setDescription('Pilih tipe tes: welcome atau leave')
        .setRequired(true)
        .addChoices(
          { name: 'Pesan Welcome (Member Baru)', value: 'welcome' },
          { name: 'Pesan Leave (Member Keluar)', value: 'leave' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const tipe = interaction.options.getString('tipe');
    const targetChannel = await resolveChannel(interaction.guild, tipe);

    const payload = tipe === 'welcome'
      ? await buildWelcomePayload(interaction.member)
      : await buildLeavePayload(interaction.member);

    const channelInfo = targetChannel
      ? `Channel Tujuan Aktif: <#${targetChannel.id}>`
      : 'Channel Tujuan: Belum diatur (gunakan `/setwelcome`)';

    await interaction.editReply({
      content: `**Preview Simulasi Pesan ${tipe.toUpperCase()}**\n*(Hanya kamu yang bisa melihat pesan ini agar tidak mengganggu obrolan server)*\n${channelInfo}`,
      embeds: [payload.embed],
      files: payload.files,
    });
  },
};
