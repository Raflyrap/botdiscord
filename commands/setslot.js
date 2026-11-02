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
    .setName('setslot')
    .setDescription('Setup channel arena mesin slot buah 777 berhadiah koin & XP')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription('Pilih channel yang ingin dijadikan arena slot (Kosongkan untuk buat otomatis)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus arena slot (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Aktifkan Channel Slot 777)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Channel Slot)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'slot', targetChannel);

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Mesin Slot 777`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Arena Mesin Slot Berhasil Dikonfigurasi')
          .setDescription(
            `Channel <#${result.channel.id}> telah resmi diaktifkan sebagai arena Mesin Slot 777.\n\n` +
            `• Channel Aktif: <#${result.channel.id}>\n` +
            `• Sistem Game: Tombol taruhan 10, 20, 50, dan 100 koin langsung aktif.\n` +
            `• Hadiah Jackpot: Cocokkan 3x 7️⃣ untuk mendapatkan 15x lipat taruhan dan bonus XP melimpah!`
          )
          .setFooter({ text: 'Gunakan /setslot aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setslot:', err);
        return interaction.editReply({
          content: `Gagal mengatur channel Slot: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentChannel = getActiveFeatureChannel(interaction.guild, 'slot');
        removeModularFeature(interaction.guild.id, 'slot');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Arena Slot Dihapus')
          .setDescription(
            'Pengaturan channel khusus Mesin Slot telah dinonaktifkan.\n\n' +
            (currentChannel ? `Channel <#${currentChannel.id}> tidak lagi merespons game slot otomatis.` : '')
          )
          .setFooter({ text: 'Ketik /setslot kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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

