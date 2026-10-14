const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Kelola role server (Khusus Admin/Moderator)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    // 1. Subcommand: Beri Role
    .addSubcommand((sub) =>
      sub
        .setName('beri')
        .setDescription('Memberikan role tertentu kepada seorang member')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('Pilih member yang ingin diberikan role')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Pilih role yang ingin diberikan')
            .setRequired(true)
        )
    )
    // 2. Subcommand: Cabut Role
    .addSubcommand((sub) =>
      sub
        .setName('cabut')
        .setDescription('Mencabut role tertentu dari seorang member')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('Pilih member yang ingin dicabut role-nya')
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Pilih role yang ingin dicabut')
            .setRequired(true)
        )
    )
    // 3. Subcommand: Buat Role Baru
    .addSubcommand((sub) =>
      sub
        .setName('buat')
        .setDescription('Membuat role baru dengan warna dan nama estetik')
        .addStringOption((opt) =>
          opt
            .setName('nama')
            .setDescription('Nama role baru (contoh: VIP, Member, Gamers)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('warna')
            .setDescription('Kode warna Hex (contoh: #5865F2, #FF8DA1, #57F287, #FEE75C)')
            .setRequired(false)
        )
        .addBooleanOption((opt) =>
          opt
            .setName('tampilkan_terpisah')
            .setDescription('Tampilkan role ini terpisah di daftar member sebelah kanan (hoist)')
            .setRequired(false)
        )
    )
    // 4. Subcommand: Hapus Role
    .addSubcommand((sub) =>
      sub
        .setName('hapus')
        .setDescription('Menghapus role dari server')
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Pilih role yang ingin dihapus')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const botMember = interaction.guild.members.me;

    // Cek apakah bot punya izin Manage Roles
    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles)) {
      return interaction.reply({
        content: '❌ Bot tidak memiliki izin **Manage Roles** di server ini!',
        flags: MessageFlags.Ephemeral,
      });
    }

    // ==========================================
    // 1. BERI ROLE
    // ==========================================
    if (subcommand === 'beri') {
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: '❌ Member tidak ditemukan di server ini!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Cek hierarki role
      if (targetRole.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `❌ Gagal: Posisi role **${targetRole.name}** sama atau lebih tinggi dari posisi role tertinggi bot! Pindahkan posisi role bot lebih ke atas di Server Settings > Roles.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (member.roles.cache.has(targetRole.id)) {
        return interaction.reply({
          content: `⚠️ Member <@${member.id}> sudah memiliki role **${targetRole.name}**!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await member.roles.add(targetRole);

        const embed = new EmbedBuilder()
          .setColor(targetRole.color || 0x57F287)
          .setTitle('✅ Role Berhasil Diberikan')
          .setDescription(`Role **${targetRole.name}** telah berhasil diberikan kepada <@${member.id}>!`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat memberi role:', err);
        await interaction.reply({
          content: `❌ Gagal memberikan role: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ==========================================
    // 2. CABUT ROLE
    // ==========================================
    else if (subcommand === 'cabut') {
      const targetUser = interaction.options.getUser('user');
      const targetRole = interaction.options.getRole('role');
      const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

      if (!member) {
        return interaction.reply({
          content: '❌ Member tidak ditemukan di server ini!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetRole.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `❌ Gagal: Posisi role **${targetRole.name}** sama atau lebih tinggi dari role bot!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!member.roles.cache.has(targetRole.id)) {
        return interaction.reply({
          content: `⚠️ Member <@${member.id}> memang tidak memiliki role **${targetRole.name}**!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await member.roles.remove(targetRole);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🗑️ Role Berhasil Dicabut')
          .setDescription(`Role **${targetRole.name}** telah dicabut dari <@${member.id}>.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat mencabut role:', err);
        await interaction.reply({
          content: `❌ Gagal mencabut role: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ==========================================
    // 3. BUAT ROLE BARU
    // ==========================================
    else if (subcommand === 'buat') {
      const roleName = interaction.options.getString('nama').trim();
      const warnaHex = interaction.options.getString('warna');
      const hoist = interaction.options.getBoolean('tampilkan_terpisah') ?? false;

      let colorInt = 0x99aab5;
      if (warnaHex) {
        const clean = warnaHex.replace('#', '').trim();
        if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
          colorInt = parseInt(clean, 16);
        }
      }

      try {
        const newRole = await interaction.guild.roles.create({
          name: roleName,
          color: colorInt,
          hoist: hoist,
          reason: `Dibuat oleh ${interaction.user.tag} lewat FlyBot`,
        });

        const embed = new EmbedBuilder()
          .setColor(newRole.color || 0x5865F2)
          .setTitle('✨ Role Baru Berhasil Dibuat')
          .setDescription(`Role **${newRole.name}** telah berhasil ditambahkan ke server!`)
          .addFields(
            { name: 'Nama Role', value: `<@&${newRole.id}>`, inline: true },
            { name: 'ID Role', value: `\`${newRole.id}\``, inline: true },
            { name: 'Tampil Terpisah', value: hoist ? '✅ Ya' : '❌ Tidak', inline: true }
          )
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat membuat role:', err);
        await interaction.reply({
          content: `❌ Gagal membuat role: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // ==========================================
    // 4. HAPUS ROLE
    // ==========================================
    else if (subcommand === 'hapus') {
      const targetRole = interaction.options.getRole('role');

      if (targetRole.id === interaction.guild.id) {
        return interaction.reply({
          content: '❌ Role `@everyone` tidak dapat dihapus!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (targetRole.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `❌ Gagal: Posisi role **${targetRole.name}** sama atau lebih tinggi dari role bot!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const roleName = targetRole.name;

      try {
        await targetRole.delete(`Dihapus oleh ${interaction.user.tag}`);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🗑️ Role Berhasil Dihapus')
          .setDescription(`Role **${roleName}** telah berhasil dihapus dari server.`)
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat menghapus role:', err);
        await interaction.reply({
          content: `❌ Gagal menghapus role: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  },
};
