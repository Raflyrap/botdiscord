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
    .setName('setremovebg')
    .setDescription('Setup channel khusus studio otomatis Remove Background foto')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan studio Remove-BG (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Remove-BG)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Remove-BG)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'removebg', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Studio Remove-BG`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus Remove-BG Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai studio auto Remove Background.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Hapus Background Otomatis: **Aktif** (Member cukup upload atau kirim foto langsung di channel ini tanpa perlu mengetik /removebg).\n` +
            `• Output: Gambar transparan murni (PNG HD) siap unduh.`
          )
          .setFooter({ text: 'Gunakan /setremovebg aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setremovebg:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Remove-BG: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'removebg');
        removeModularFeature(interaction.guild.id, 'removebg');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Remove-BG Dihapus')
          .setDescription(
            'Pengaturan channel khusus studio Remove Background telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons penghapusan background otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /setremovebg kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
