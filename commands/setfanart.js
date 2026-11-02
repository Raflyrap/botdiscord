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
    .setName('setfanart')
    .setDescription('Setup channel khusus review konsep visual & fanart anime AI')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan studio fanart (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Fanart AI)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Fanart AI)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'fanart', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setAuthor({
            name: `${interaction.guild.name} • Setup AI Fanart Studio`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus AI Fanart Studio Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai galeri & konsep fanart AI.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Analisis Otomatis: **Aktif** (Kirim nama karakter anime/game atau foto referensi untuk dianalisis konsepnya oleh AI).\n` +
            `• Vision AI: Mampu membaca gambar referensi untuk saran desain ilustrasi.`
          )
          .setFooter({ text: 'Gunakan /setfanart aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setfanart:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel AI Fanart: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'fanart');
        removeModularFeature(interaction.guild.id, 'fanart');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel AI Fanart Dihapus')
          .setDescription(
            'Pengaturan channel khusus AI Fanart telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons review otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /setfanart kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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

