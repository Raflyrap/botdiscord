const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { setPrivateAiConfig, getHubPanel } = require('../privateAiHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupaichat')
    .setDescription('Membuat channel hub Private AI Chat (+ Buka Room Chat AI Privat untuk semua member)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;

    try {
      // 1. Buat kategori jika belum ada
      const category = await guild.channels.create({
        name: '━━━━ PRIVATE AI CHAT ━━━━',
        type: ChannelType.GuildCategory,
      });

      // 2. Buat Hub channel tempat tombol pemicu berada
      const hubChannel = await guild.channels.create({
        name: 'buka-ai-chat',
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
          {
            // Semua member bisa melihat tapi tidak bisa mengetik (khusus klik tombol)
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
            deny: [PermissionFlagsBits.SendMessages],
          },
          {
            // Bot memiliki izin penuh
            id: interaction.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.ManageChannels,
            ],
          },
        ],
      });

      // 3. Kirim panel pemicu dengan tombol Buka Private AI Chat
      const panel = getHubPanel();
      await hubChannel.send(panel);

      // 4. Simpan konfigurasi ke privateAiConfig.json
      setPrivateAiConfig(guild.id, hubChannel.id, category.id);

      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('Sistem Private AI Chat Berhasil Dipasang')
        .setDescription(
          `Channel pemicu dan kategori telah berhasil dibuat:\n\n` +
          `Kategori: **${category.name}**\n` +
          `Channel Hub: <#${hubChannel.id}>\n\n` +
          `**Cara Kerja Sistem:**\n` +
          `1. Member masuk ke <#${hubChannel.id}> lalu klik tombol Buka di DM Pribadi atau Buat Room.\n` +
          `2. Obrolan bersifat privat dan rahasia.\n` +
          `3. Member bisa langsung chatting normal tanpa perlu / atau mention bot.`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat setup private AI chat:', error);
      await interaction.editReply({
        content: `❌ Gagal membuat sistem Private AI Chat: ${error.message}`,
      });
    }
  },
};
