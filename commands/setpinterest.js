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
    .setName('setpinterest')
    .setDescription('Setup channel khusus galeri pencarian otomatis gambar Pinterest')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan galeri Pinterest (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Pinterest)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Pinterest)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'pinterest', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0xE60023)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Galeri Pinterest`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus Pinterest Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai galeri pencarian gambar Pinterest.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Pencarian Otomatis: **Aktif** (Member cukup ketik kata kunci pencarian langsung di channel tersebut tanpa perlu mengetik /pinterest).\n` +
            `• Tombol Navigasi: Terdapat tombol Sebelumnya & Berikutnya untuk melihat banyak variasi gambar.`
          )
          .setFooter({ text: 'Gunakan /setpinterest aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setpinterest:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Pinterest: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'pinterest');
        removeModularFeature(interaction.guild.id, 'pinterest');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Pinterest Dihapus')
          .setDescription(
            'Pengaturan channel khusus galeri Pinterest telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons pencarian otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /setpinterest kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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

