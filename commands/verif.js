const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { getVerifConfig, setVerifConfig } = require('../verifHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verif')
    .setDescription('Kelola sistem verifikasi member di server')
    .addSubcommand((sub) =>
      sub
        .setName('panel')
        .setDescription('Kirim panel verifikasi ber-tombol ke channel yang dipilih')
        .addChannelOption((opt) =>
          opt
            .setName('channel')
            .setDescription('Channel tujuan pengiriman panel verifikasi')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role')
            .setDescription('Role yang akan diberikan kepada member setelah verifikasi')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('judul')
            .setDescription('Judul panel verifikasi (opsional)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('deskripsi')
            .setDescription('Deskripsi atau instruksi verifikasi (opsional)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Lihat status dan channel verifikasi saat ini')
    )
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Nonaktifkan pengaturan verifikasi')
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageRoles) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'panel') {
      const targetChannel = interaction.options.getChannel('channel');
      const targetRole = interaction.options.getRole('role');
      const customTitle = interaction.options.getString('judul');
      const customDesc = interaction.options.getString('deskripsi');

      if (targetRole.id === interaction.guildId) {
        return interaction.reply({
          content: 'Role @everyone tidak bisa digunakan sebagai role verifikasi.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const botMember = interaction.guild.members.me;
      if (targetRole.position >= botMember.roles.highest.position) {
        return interaction.reply({
          content: `Posisi role **${targetRole.name}** lebih tinggi atau sama dengan role bot. Pindahkan posisi role bot lebih atas di Pengaturan Server -> Roles.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const guild = interaction.guild;
      const title = customTitle || `Verifikasi Member  •  ${guild.name}`;
      const description =
        customDesc ||
        `Selamat datang di **${guild.name}**!\n\n` +
        `Untuk mendapatkan akses penuh ke seluruh saluran dan fitur server, silakan verifikasi akun kamu dengan menekan tombol di bawah ini.\n\n` +
        `Setelah menekan tombol, kamu akan otomatis mendapatkan role <@&${targetRole.id}>.`;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: guild.name,
          iconURL: guild.iconURL() || undefined,
        })
        .setTitle(title)
        .setDescription(description)
        .addFields(
          { name: 'Role Diberikan', value: `<@&${targetRole.id}>`, inline: true },
          { name: 'Keamanan', value: 'Anti-Bot Protection', inline: true },
        )
        .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
        .setFooter({ text: `${guild.name}  •  Sistem Verifikasi Otomatis` })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('btn_do_verify')
        .setLabel('Verifikasi Sekarang')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder().addComponents(button);

      try {
        const sentMessage = await targetChannel.send({
          embeds: [embed],
          components: [row],
        });

        setVerifConfig(interaction.guildId, {
          channelId: targetChannel.id,
          roleId: targetRole.id,
          messageId: sentMessage.id,
          enabled: true,
        });

        return interaction.reply({
          content: `Panel verifikasi berhasil dikirim ke <#${targetChannel.id}> dengan role <@&${targetRole.id}>.`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        return interaction.reply({
          content: `Gagal mengirim panel ke channel: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    if (sub === 'status') {
      const cfg = getVerifConfig(interaction.guildId);

      if (!cfg.enabled || !cfg.roleId) {
        return interaction.reply({
          content: 'Sistem verifikasi saat ini belum diatur atau dinonaktifkan.\nGunakan `/verif panel` untuk memasang panel verifikasi.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const role = interaction.guild.roles.cache.get(cfg.roleId);
      const ch = interaction.guild.channels.cache.get(cfg.channelId);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Status Verifikasi Server')
        .addFields(
          { name: 'Status', value: 'Aktif', inline: true },
          { name: 'Channel Panel', value: ch ? `<#${ch.id}>` : `ID: ${cfg.channelId} (tidak ditemukan)`, inline: true },
          { name: 'Role Diberikan', value: role ? `<@&${role.id}>` : `ID: ${cfg.roleId} (tidak ditemukan)`, inline: true },
        )
        .setFooter({ text: 'Ketik /verif panel untuk memperbarui panel' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (sub === 'off') {
      setVerifConfig(interaction.guildId, { enabled: false });
      return interaction.reply({
        content: 'Sistem verifikasi telah dinonaktifkan.',
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
