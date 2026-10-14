const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createWelcomeEmbed, createLeaveEmbed, resolveChannel } = require('../welcomeHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Menguji dan melihat preview pesan welcome dan leave di server ini')
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
    const tipe = interaction.options.getString('tipe');
    const targetChannel = await resolveChannel(interaction.guild, tipe);

    if (!targetChannel) {
      return interaction.reply({
        content: '❌ Tidak dapat menemukan channel tujuan! Gunakan `/setwelcome` terlebih dahulu.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = tipe === 'welcome' 
      ? createWelcomeEmbed(interaction.member)
      : createLeaveEmbed(interaction.member);

    // Kirim pesan tes ke channel tujuan
    await targetChannel.send({
      content: `🧪 *[Pesan Simulasi/Tes oleh <@${interaction.user.id}>]*`,
      embeds: [embed],
    });

    await interaction.reply({
      content: `✅ Tes berhasil dikirim ke channel <#${targetChannel.id}>!`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
