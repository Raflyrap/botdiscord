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
const { setGuildTicketConfig, getGuildTicketConfig } = require('../ticketHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setticket')
    .setDescription('Pasang panel sistem tiket bantuan / customer service')
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Channel tempat panel tombol tiket akan dikirim')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addChannelOption((opt) =>
      opt
        .setName('kategori')
        .setDescription('Kategori untuk menampung channel tiket yang dibuat (opsional)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    )
    .addRoleOption((opt) =>
      opt
        .setName('role_staff')
        .setDescription('Role staff/admin yang otomatis bisa melihat dan membalas tiket (opsional)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('judul')
        .setDescription('Judul panel tiket kustom (opsional)')
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('deskripsi')
        .setDescription('Deskripsi atau petunjuk panel tiket kustom (opsional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const targetChannel = interaction.options.getChannel('channel');
    const targetCategory = interaction.options.getChannel('kategori');
    const staffRole = interaction.options.getRole('role_staff');
    const customTitle = interaction.options.getString('judul');
    const customDesc = interaction.options.getString('deskripsi');

    const guild = interaction.guild;
    const title = customTitle || `Pusat Bantuan & Tiket  •  ${guild.name}`;
    const description =
      customDesc ||
      `Butuh bantuan, ingin menyampaikan laporan, atau berdiskusi secara privat dengan tim pengelola?\n\n` +
      `Silakan klik tombol **Buat Tiket** di bawah ini untuk membuka ruang obrolan rahasia yang hanya bisa dilihat oleh kamu dan Admin/Staff.`;

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: guild.name,
        iconURL: guild.iconURL() || undefined,
      })
      .setTitle(title)
      .setDescription(description)
      .addFields(
        { name: 'Privasi', value: 'Khusus Kamu & Admin', inline: true },
        { name: 'Waktu Respons', value: 'Sesuai Ketersediaan Staff', inline: true },
      )
      .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
      .setFooter({ text: `${guild.name}  •  Sistem Tiket Otomatis` })
      .setTimestamp();

    const button = new ButtonBuilder()
      .setCustomId('btn_create_ticket')
      .setLabel('Buat Tiket')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    try {
      const sentMessage = await targetChannel.send({
        embeds: [embed],
        components: [row],
      });

      setGuildTicketConfig(interaction.guildId, {
        panelChannelId: targetChannel.id,
        categoryId: targetCategory ? targetCategory.id : null,
        supportRoleId: staffRole ? staffRole.id : null,
        messageId: sentMessage.id,
        enabled: true,
      });

      return interaction.reply({
        content:
          `Panel tiket bantuan berhasil dipasang di <#${targetChannel.id}>!\n` +
          (targetCategory ? `• Kategori Tiket: **${targetCategory.name}**\n` : '') +
          (staffRole ? `• Role Staff: <@&${staffRole.id}>\n` : ''),
        flags: MessageFlags.Ephemeral,
      });
    } catch (err) {
      return interaction.reply({
        content: `Gagal mengirim panel tiket: ${err.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
