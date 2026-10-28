const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { buildWelcomePayload, buildLeavePayload, resolveChannel } = require('../welcomeHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Menguji dan melihat preview pesan welcome dan leave ber-banner kustom di server ini')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addStringOption((option) =>
      option
        .setName('tipe')
        .setDescription('Pilih tipe tes: welcome atau leave')
        .setRequired(true)
        .addChoices(
          { name: 'Pesan Welcome (Member Baru + Banner Kustom)', value: 'welcome' },
          { name: 'Pesan Leave (Member Keluar + Banner Kustom)', value: 'leave' }
        )
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const tipe = interaction.options.getString('tipe');
    const targetChannel = await resolveChannel(interaction.guild, tipe);

    if (!targetChannel) {
      return interaction.editReply({
        content: 'Tidak dapat menemukan channel tujuan! Gunakan `/setwelcome` terlebih dahulu.',
      });
    }

    const payload = tipe === 'welcome'
      ? await buildWelcomePayload(interaction.member)
      : await buildLeavePayload(interaction.member);

    // Kirim pesan tes ke channel tujuan
    await targetChannel.send({
      content: `*[Pesan Simulasi/Tes oleh <@${interaction.user.id}>]*`,
      embeds: [payload.embed],
      files: payload.files,
    });

    await interaction.editReply({
      content: `Tes banner ${tipe} berhasil dikirim ke channel <#${targetChannel.id}>!`,
    });
  },
};
