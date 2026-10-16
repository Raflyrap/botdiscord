const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { setVerifConfig, getVerifConfig, applyChannelLockdown, syncExistingMembers } = require('../verifHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setverif')
    .setDescription('Atur role verifikasi & sembunyikan channel lain sebelum member terverifikasi')
    .addRoleOption((opt) =>
      opt
        .setName('role_sudah_verif')
        .setDescription('Role untuk member yang SUDAH verifikasi (misal: @Member)')
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('channel_verif')
        .setDescription('Channel tempat verifikasi (satu-satunya channel yang bisa dilihat sebelum verif)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addRoleOption((opt) =>
      opt
        .setName('role_belum_verif')
        .setDescription('Role otomatis untuk member yang BELUM verifikasi (opsional)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('sembunyikan_channel')
        .setDescription('Otomatis sembunyikan semua channel lain dari yang belum verifikasi? (Default: True)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('kirim_panel')
        .setDescription('Otomatis kirim panel verifikasi ke channel verifikasi sekarang? (Default: True)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const verifiedRole = interaction.options.getRole('role_sudah_verif');
    const unverifiedRole = interaction.options.getRole('role_belum_verif');
    const verifChannel = interaction.options.getChannel('channel_verif');
    const doLockdown = interaction.options.getBoolean('sembunyikan_channel') ?? true;
    const sendPanel = interaction.options.getBoolean('kirim_panel') ?? true;

    if (verifiedRole.id === interaction.guildId) {
      return interaction.reply({
        content: 'Role @everyone tidak bisa digunakan sebagai role sudah verifikasi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (unverifiedRole && unverifiedRole.id === interaction.guildId) {
      return interaction.reply({
        content: 'Role @everyone tidak bisa digunakan sebagai role belum verifikasi.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (unverifiedRole && unverifiedRole.id === verifiedRole.id) {
      return interaction.reply({
        content: 'Role sudah verif dan role belum verif tidak boleh sama.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const botMember = interaction.guild.members.me;
    if (verifiedRole.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `Posisi role bot lebih rendah atau sama dengan **${verifiedRole.name}**. Pindahkan role bot ke posisi lebih atas di Server Settings -> Roles agar bot bisa memberikan role tersebut.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (unverifiedRole && unverifiedRole.position >= botMember.roles.highest.position) {
      return interaction.reply({
        content: `Posisi role bot lebih rendah atau sama dengan **${unverifiedRole.name}**. Pindahkan role bot ke posisi lebih atas di Server Settings -> Roles.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Beri tanggapan awal karena penyesuaian permission channel mungkin butuh beberapa detik
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Simpan konfigurasi verifikasi
    setVerifConfig(interaction.guildId, {
      verifiedRoleId: verifiedRole.id,
      unverifiedRoleId: unverifiedRole?.id || null,
      roleId: verifiedRole.id, // Kompatibilitas dengan sistem sebelumnya
      channelId: verifChannel.id,
      enabled: true,
    });

    let channelLockCount = 0;
    if (doLockdown) {
      channelLockCount = await applyChannelLockdown(interaction.guild, {
        verifChannelId: verifChannel.id,
        verifiedRoleId: verifiedRole.id,
        unverifiedRoleId: unverifiedRole?.id || null,
      });
    }

    let syncedMemberCount = 0;
    if (unverifiedRole) {
      syncedMemberCount = await syncExistingMembers(interaction.guild, {
        verifiedRoleId: verifiedRole.id,
        unverifiedRoleId: unverifiedRole.id,
      });
    }

    let panelStatus = 'Tidak dikirim (dilewati)';
    if (sendPanel) {
      try {
        const guild = interaction.guild;
        const panelEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: guild.name,
            iconURL: guild.iconURL() || undefined,
          })
          .setTitle(`Verifikasi Akses Server  •  ${guild.name}`)
          .setDescription(
            `Selamat datang di **${guild.name}**!\n\n` +
            `Seluruh channel di server ini terkunci untuk menjaga keamanan server.\n` +
            `Untuk membuka seluruh channel dan mendapatkan role <@&${verifiedRole.id}>, silakan klik tombol di bawah ini.`
          )
          .addFields(
            { name: 'Role Diterima', value: `<@&${verifiedRole.id}>`, inline: true },
            { name: 'Keamanan', value: 'Perlindungan Anti-Bot', inline: true },
          )
          .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
          .setFooter({ text: `${guild.name}  •  Verifikasi Otomatis` })
          .setTimestamp();

        const btn = new ButtonBuilder()
          .setCustomId('btn_do_verify')
          .setLabel('Verifikasi Sekarang')
          .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(btn);

        await verifChannel.send({ embeds: [panelEmbed], components: [row] });
        panelStatus = `Terkirim ke <#${verifChannel.id}>`;
      } catch (err) {
        panelStatus = `Gagal mengirim panel: ${err.message}`;
      }
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Pengaturan Verifikasi Berhasil Diterapkan')
      .setDescription(
        `Sistem verifikasi server sekarang sudah aktif.\n` +
        `Member yang belum verifikasi hanya dapat melihat channel verifikasi, dan channel lain akan otomatis terbuka setelah mereka menekan tombol verifikasi.`
      )
      .addFields(
        { name: 'Role Sudah Verif', value: `<@&${verifiedRole.id}>`, inline: true },
        { name: 'Role Belum Verif', value: unverifiedRole ? `<@&${unverifiedRole.id}>` : '*Menggunakan @everyone*', inline: true },
        { name: 'Channel Verifikasi', value: `<#${verifChannel.id}>`, inline: true },
        {
          name: 'Penyesuaian Channel',
          value: doLockdown
            ? `${channelLockCount} channel/kategori disesuaikan`
            : 'Dilewati',
          inline: true,
        },
        {
          name: 'Sinkron Member Lama',
          value: unverifiedRole
            ? `${syncedMemberCount} member lama diberikan role belum verif`
            : 'Dilewati (@everyone)',
          inline: true,
        },
        { name: 'Panel Verifikasi', value: panelStatus, inline: true },
      )
      .setFooter({ text: 'Sistem Verifikasi FlyBot' })
      .setTimestamp();

    return interaction.editReply({ embeds: [resultEmbed] });
  },
};
