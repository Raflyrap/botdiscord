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
    .setName('setmeme')
    .setDescription('Setup channel studio otomatis untuk generator Meme & Canvas (/meme)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan studio Meme (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus konfigurasi (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Meme)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Meme)', value: 'hapus' }
        )
    ),

  async execute(interaction) {
    const action = interaction.options.getString('aksi') || 'setup';
    const targetChannel = interaction.options.getChannel('channel');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupModularFeature(interaction.guild, 'meme', targetChannel);
        const embed = new EmbedBuilder()
          .setColor(0x8ACE00)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Studio Meme`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('🎭 Channel Khusus Meme Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai studio Meme & Canvas.\n\n` +
            `• Ketik teks biasa langsung → otomatis jadi gambar **Brat**.\n` +
            `• Ketik \`gif <teks>\` → otomatis jadi **GIF Animasi Brat**.\n` +
            `• Atau gunakan seluruh perintah \`/meme\` (tweet, ship, sertifikat, batslap, kiss, spotify, efek).\n` +
            `• Chat dibersihkan otomatis setiap jam **00:00 WIB**.`
          )
          .setFooter({ text: 'Gunakan /fitur off atau /setmeme aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `Gagal mengatur channel Meme: ${err.message}` });
      }
    }

    if (action === 'hapus') {
      const currentChannel = getActiveFeatureChannel(interaction.guild, 'meme');
      removeModularFeature(interaction.guild.id, 'meme');
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Konfigurasi Channel Meme Dihapus')
        .setDescription(
          'Pengaturan channel khusus Meme telah dinonaktifkan.\n' +
          (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons auto-meme.` : '')
        )
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
  },
};
