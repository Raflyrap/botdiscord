const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const {
  setupGiveawayChannel,
  getGiveaway,
  setGiveaway,
} = require('../giveawayHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setgiveaway')
    .setDescription('Setup channel dan panel giveaway berhadiah interaktif di server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan room giveaway (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Giveaway)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Giveaway)', value: 'hapus' }
        )
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

    const action = interaction.options.getString('aksi') || 'setup';
    const targetChannel = interaction.options.getChannel('channel');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupGiveawayChannel(interaction.guild, targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Giveaway`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel & Panel Giveaway Berhasil Dikonfigurasi')
          .setDescription(
            `Panel giveaway telah aktif di channel <#${result.channel.id}>!\n\n` +
            `• **Untuk Member:** Cukup klik tombol **🎉 Ikut Giveaway** untuk mendaftarkan diri.\n` +
            `• **Untuk Owner & Admin:** Tersedia tombol **Edit Hadiah**, **List Peserta**, **Mulai Gacha**, dan **Reset**.\n` +
            `• **Otomatis DM:** Saat tombol gacha ditekan, pemenang otomatis di-tag di channel dan dikirimkan Direct Message (DM) langsung oleh bot!`
          )
          .setFooter({ text: 'Gunakan /setgiveaway aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setgiveaway:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Giveaway: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentGw = getGiveaway(interaction.guildId);
        if (currentGw) {
          setGiveaway(interaction.guildId, { status: 'ended', channelId: null, messageId: null });
        }

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Giveaway Dihapus')
          .setDescription('Pengaturan channel giveaway telah dinonaktifkan dari konfigurasi FlyBot.')
          .setFooter({ text: 'Ketik /setgiveaway kembali jika ingin mengaktifkannya sewaktu-waktu.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `Gagal menghapus konfigurasi: ${err.message}`,
        });
      }
    }
  },
};
