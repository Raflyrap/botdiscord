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
    .setName('ticket')
    .setDescription('Setup otomatis sistem tiket (Kategori SUPPORT & channel langsung aktif)')
    .addRoleOption((opt) =>
      opt
        .setName('role_staff')
        .setDescription('Role staff/admin yang bisa membalas tiket (opsional)')
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

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;
    const staffRole = interaction.options.getRole('role_staff');

    try {
      // 1. Cari atau buat Kategori SUPPORT
      let category = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === 'SUPPORT'
      );

      if (!category) {
        category = await guild.channels.create({
          name: 'SUPPORT',
          type: ChannelType.GuildCategory,
          reason: 'Auto-setup kategori sistem tiket',
        });
      }

      // 2. Cari atau buat Channel #tiket-bantuan di dalam kategori SUPPORT
      let panelChannel = guild.channels.cache.find(
        (c) =>
          c.parentId === category.id &&
          (c.name === 'tiket-bantuan' || c.name === 'bantuan-tiket' || c.name === 'tiket')
      );

      if (!panelChannel) {
        panelChannel = await guild.channels.create({
          name: 'tiket-bantuan',
          type: ChannelType.GuildText,
          parent: category.id,
          reason: 'Auto-setup channel panel tiket',
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              deny: [PermissionFlagsBits.SendMessages],
            },
            {
              id: guild.members.me.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ],
        });
      }

      // 3. Buat Embed & Tombol Buat Tiket
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: `${guild.name}  •  Pusat Bantuan`,
          iconURL: guild.iconURL() || undefined,
        })
        .setTitle('Customer Service & Tiket Bantuan')
        .setDescription(
          `Butuh bantuan, ada kendala teknis, atau ingin berdiskusi privat dengan tim pengelola?\n\n` +
          `Klik tombol **Buat Tiket** di bawah untuk membuka ruang percakapan privat yang hanya bisa dilihat oleh kamu dan Admin/Staff.`
        )
        .addFields(
          { name: 'Privasi', value: 'Khusus Kamu & Staff', inline: true },
          { name: 'Layanan', value: 'Bantuan Privat', inline: true },
        )
        .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
        .setFooter({ text: `${guild.name}  •  Sistem Tiket Otomatis` })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('btn_create_ticket')
        .setLabel('Buat Tiket')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      const sentMessage = await panelChannel.send({
        embeds: [embed],
        components: [row],
      });

      // 4. Simpan konfigurasi
      const currentCfg = getGuildTicketConfig(guild.id);
      setGuildTicketConfig(guild.id, {
        panelChannelId: panelChannel.id,
        categoryId: category.id,
        supportRoleId: staffRole ? staffRole.id : currentCfg.supportRoleId || null,
        messageId: sentMessage.id,
        enabled: true,
      });

      return interaction.editReply({
        content:
          `**Sistem Tiket Berhasil Diaktifkan!**\n\n` +
          `• Kategori: **${category.name}**\n` +
          `• Channel Panel: <#${panelChannel.id}>\n` +
          (staffRole ? `• Role Staff: <@&${staffRole.id}>\n` : '') +
          `\nKategori dan channel sudah otomatis dibuat dan langsung berfungsi. Member tinggal membuka <#${panelChannel.id}> dan klik tombol **Buat Tiket**!`,
      });
    } catch (err) {
      console.error('Error auto-setup /ticket:', err);
      return interaction.editReply({
        content: `Gagal menyiapkan sistem tiket: ${err.message}`,
      });
    }
  },
};
