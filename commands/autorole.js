const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { getAutoRole, setAutoRole, removeAutoRole } = require('../autoRoleHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('Mengatur pemberian role otomatis kepada setiap member yang baru bergabung')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName('set')
        .setDescription('Mengaktifkan auto-role untuk member baru')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Pilih role yang akan otomatis diberikan saat member baru masuk')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Melihat status auto-role saat ini')
    )
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Menonaktifkan fitur auto-role')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const botMember = interaction.guild.members.me;

    if (sub === 'set') {
      const targetRole = interaction.options.getRole('role');

      if (targetRole.id === interaction.guild.id) {
        return interaction.reply({
          content: '❌ Role `@everyone` tidak bisa dijadikan auto-role!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetRole.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `❌ Posisi role **${targetRole.name}** lebih tinggi atau sama dengan role bot! Pindahkan role bot ke posisi lebih atas di server roles.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      setAutoRole(interaction.guildId, targetRole.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Auto-Role Berhasil Diaktifkan')
        .setDescription(`Setiap ada member baru yang bergabung, bot akan otomatis memberikan role: <@&${targetRole.id}>!`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'status') {
      const currentRoleId = getAutoRole(interaction.guildId);

      if (!currentRoleId) {
        return interaction.reply({
          content: 'ℹ️ Fitur Auto-Role saat ini **belum diatur / nonaktif**.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const role = interaction.guild.roles.cache.get(currentRoleId);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📋 Status Auto-Role Server')
        .setDescription(
          role
            ? `Role aktif saat ini: <@&${role.id}> (\`${role.name}\`)`
            : `⚠️ Role sebelumnya (ID: \`${currentRoleId}\`) sudah tidak ditemukan.`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } else if (sub === 'off') {
      removeAutoRole(interaction.guildId);

      await interaction.reply({
        content: '🛑 Fitur Auto-Role telah berhasil **dinonaktifkan**.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
