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
    .setName('setsambungkata')
    .setDescription('Setup channel arena permainan duel Sambung Kata KBBI berhadiah koin & XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan arena sambung kata (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus arena (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Sambung Kata)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Sambung Kata)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'sambungkata', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Sambung Kata KBBI`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Arena Sambung Kata Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai arena Sambung Kata KBBI.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Aturan Game: Balas kata baku yang diberikan bot menggunakan 2 huruf terakhir kata sebelumnya dalam 30 detik.\n` +
            `• Hadiah: Kemenangan duel memberikan Koin dan XP ke profil pengguna.`
          )
          .setFooter({ text: 'Gunakan /setsambungkata aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setsambungkata:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Sambung Kata: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'sambungkata');
        removeModularFeature(interaction.guild.id, 'sambungkata');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Arena Sambung Kata Dihapus')
          .setDescription(
            'Pengaturan channel khusus Sambung Kata telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons game sambung kata otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /setsambungkata kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
