const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { calculateStats, setStatsConfig } = require('../serverStatsHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupstats')
    .setDescription('Membuat channel indikator statistik server (Total Member, Admin, Channel Aktif)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;

    try {
      // 1. Hitung statistik awal
      const { totalMembers, totalAdmins, totalActiveChannels } = await calculateStats(guild);

      // 2. Buat Kategori Statistik di bagian paling atas
      const category = await guild.channels.create({
        name: '📊 ━━━━━ STATISTIK SERVER ━━━━━',
        type: ChannelType.GuildCategory,
        position: 0,
      });

      // Permission overwrite agar channel terkunci (hanya bisa dilihat, tidak bisa dimasuki)
      const lockedPermissions = [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel],
          deny: [PermissionFlagsBits.Connect], // Terkunci gembok estetik
        },
      ];

      // 3. Buat Channel Total Member
      const memberChannel = await guild.channels.create({
        name: `👥・Total Member: ${totalMembers}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: lockedPermissions,
      });

      // 4. Buat Channel Total Admin
      const adminChannel = await guild.channels.create({
        name: `👑・Total Admin: ${totalAdmins}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: lockedPermissions,
      });

      // 5. Buat Channel Total Channel Aktif
      const activeChannel = await guild.channels.create({
        name: `💬・Channel Aktif: ${totalActiveChannels}`,
        type: ChannelType.GuildVoice,
        parent: category.id,
        permissionOverwrites: lockedPermissions,
      });

      // 6. Simpan konfigurasi
      setStatsConfig(guild.id, {
        categoryId: category.id,
        memberChannelId: memberChannel.id,
        adminChannelId: adminChannel.id,
        activeChannelId: activeChannel.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📊 Statistik Server Berhasil Diaktifkan!')
        .setDescription(
          `Channel indikator statistik real-time telah dibuat di bagian paling atas server:\n\n` +
          `📁 Kategori: **${category.name}**\n` +
          `👥 **Total Member**: \`${totalMembers} orang\`\n` +
          `👑 **Total Admin**: \`${totalAdmins} orang\`\n` +
          `💬 **Channel Aktif**: \`${totalActiveChannels} channel\`\n\n` +
          `*Semua channel sengaja dikunci agar berfungsi sebagai badge/indikator estetik dan akan otomatis terupdate setiap ada perubahan member!*`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat setup server stats:', error);
      await interaction.editReply({
        content: `❌ Gagal membuat channel statistik: ${error.message}`,
      });
    }
  },
};
