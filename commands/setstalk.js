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
    .setName('setstalk')
    .setDescription('Setup channel khusus stalking profil game & sosial media')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan room stalk (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Stalk)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Stalk)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'stalk', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Stalker Profil`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus Stalker Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai ruang kepo profil.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Perintah Stalk: Gunakan \`/stalk\` untuk melihat akun Mobile Legends, Roblox, TikTok, Discord ID, GitHub, dan Twitter.\n` +
            `• Privasi: Seluruh balasan hasil stalk bersifat rahasia (hanya pengguna yang meminta yang bisa melihat).`
          )
          .setFooter({ text: 'Gunakan /setstalk aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setstalk:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Stalker: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'stalk');
        removeModularFeature(interaction.guild.id, 'stalk');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Stalker Dihapus')
          .setDescription(
            'Pengaturan channel khusus Stalker telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi dikhususkan untuk stalk.` : '')
          )
          .setFooter({ text: 'Ketik /setstalk kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
