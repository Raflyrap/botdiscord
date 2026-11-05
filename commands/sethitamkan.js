const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');
const {
  setupModularFeature,
  removeModularFeature,
  getActiveFeatureChannel,
} = require('../modularSetupHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sethitamkan')
    .setDescription('Setup channel studio otomatis untuk mengubah foto/wajah menjadi hitam')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan studio Hitamkan (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Hitamkan)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Hitamkan)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'hitamkan', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x2B2D31)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Studio Hitamkan`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus Hitamkan Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai studio auto Hitamkan Foto.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Hitamkan Otomatis: **Aktif** (Member cukup upload atau kirim foto wajah langsung di channel ini tanpa perlu mengetik /hitamkan).\n` +
            `• Output: Foto dengan wajah/kulit yang dihitamkan secara instan (PNG murni).`
          )
          .setFooter({ text: 'Gunakan /sethitamkan aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /sethitamkan:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Hitamkan: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'hitamkan');
        removeModularFeature(interaction.guild.id, 'hitamkan');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Hitamkan Dihapus')
          .setDescription(
            'Pengaturan channel khusus studio Hitamkan telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons penghitaman foto otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /sethitamkan kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
