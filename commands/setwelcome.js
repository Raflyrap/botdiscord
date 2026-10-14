const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { setGuildConfig } = require('../welcomeHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Mengatur channel pengiriman pesan selamat datang dan member keluar')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption((option) =>
      option
        .setName('channel_welcome')
        .setDescription('Channel tempat bot menyambut member baru yang bergabung')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('channel_leave')
        .setDescription('Channel tempat bot mengumumkan jika ada member yang keluar')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const welcomeChannel = interaction.options.getChannel('channel_welcome');
    const leaveChannel = interaction.options.getChannel('channel_leave');

    if (!welcomeChannel && !leaveChannel) {
      return interaction.reply({
        content: '⚠️ Silakan pilih minimal salah satu channel (`channel_welcome` atau `channel_leave`)!',
        flags: MessageFlags.Ephemeral,
      });
    }

    const updates = {};
    if (welcomeChannel) updates.welcomeChannel = welcomeChannel.id;
    if (leaveChannel) updates.leaveChannel = leaveChannel.id;

    setGuildConfig(interaction.guildId, updates);

    let replyText = '✅ **Pengaturan Notifikasi Berhasil Disimpan!**\n';
    if (welcomeChannel) replyText += `👋 Channel Welcome: <#${welcomeChannel.id}>\n`;
    if (leaveChannel) replyText += `🚪 Channel Leave: <#${leaveChannel.id}>\n`;

    await interaction.reply({
      content: replyText,
    });
  },
};
