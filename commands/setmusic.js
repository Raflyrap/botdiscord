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
    .setName('setmusic')
    .setDescription('Setup channel khusus pemutaran musik FlyBot (/play)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan room pemutaran musik (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Musik)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Musik)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'music', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0x1DB954)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Music Studio`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Channel Khusus Musik Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai channel pemutaran musik.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Pemutaran Musik: Gunakan perintah \`/play\` di channel ini untuk memutar lagu berkualitas HD dari Spotify, YouTube, dan SoundCloud.\n` +
            `• Kontrol Musik: Tersedia perintah \`/queue\`, \`/skip\`, \`/volume\`, \`/pause\`, \`/resume\`, dan \`/stop\`.`
          )
          .setFooter({ text: 'Gunakan /setmusic aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setmusic:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel musik: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'music');
        removeModularFeature(interaction.guild.id, 'music');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Channel Musik Dihapus')
          .setDescription(
            'Pengaturan channel khusus musik telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi dikhususkan untuk pemutaran musik.` : '')
          )
          .setFooter({ text: 'Ketik /setmusic kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
