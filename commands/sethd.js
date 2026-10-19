const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  getHdConfig,
  setupHdChannel,
  removeHdChannel,
} = require('../imageHdHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sethd')
    .setDescription('Setup otomatis kategori dan channel khusus Auto-HD Foto')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Kategori & Channel HD Foto)', value: 'setup' },
          { name: 'Hapus (Hapus Kategori & Channel HD Foto)', value: 'hapus' }
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
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupHdChannel(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0x57f287)
          .setAuthor({
            name: `${interaction.guild.name}  •  Studio HD Foto`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus HD Foto Berhasil Dibuat')
          .setDescription(
            `Kategori **${result.category.name}** dan channel <#${result.hdChannel.id}> telah siap digunakan.\n\n` +
            `• Channel Khusus: <#${result.hdChannel.id}>\n` +
            `• Sistem Auto-HD: **Aktif Otomatis**\n` +
            `• Siapa pun yang mengirim gambar ke channel tersebut akan otomatis langsung ditingkatkan kualitasnya oleh bot tanpa perlu mengetik /hd lagi.`
          )
          .setFooter({ text: 'Ketik /sethd aksi:Hapus jika ingin menghapus channel ini' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setupHdChannel:', err);
        return interaction.editReply({
          content: `Gagal membuat channel khusus HD foto: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const cfg = getHdConfig(interaction.guildId);
        if (!cfg || !cfg.enabled) {
          return interaction.editReply({
            content: 'Channel khusus HD foto saat ini belum ada atau belum diaktifkan.',
          });
        }

        await removeHdChannel(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Channel Khusus HD Foto Dihapus')
          .setDescription(
            'Channel khusus HD foto dan kategorinya telah berhasil dihapus secara bersih.\n\n' +
            'Ketik `/sethd` kembali jika ingin mengaktifkannya lagi sewaktu-waktu.'
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat removeHdChannel:', err);
        return interaction.editReply({
          content: `Gagal menghapus channel khusus HD foto: ${err.message}`,
        });
      }
    }
  },
};
