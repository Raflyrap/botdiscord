const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  setupModularFeature,
  removeModularFeature,
} = require('../modularSetupHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setvoicehub')
    .setDescription('Setup sistem Voice Hub otomatis mandiri (Join-to-Create room pribadi)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus sistem Voice Hub (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Voice Hub & Kategori)', value: 'setup' },
          { name: 'Hapus (Nonaktifkan Voice Hub)', value: 'hapus' }
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
        const result = await setupModularFeature(interaction.guild, 'voicehub');

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Voice Hub`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Sistem Voice Hub (Join-to-Create) Berhasil Dibuat')
          .setDescription(
            `Channel voice <#${result.channel.id}> telah siap digunakan.\n\n` +
            `• Channel Trigger: <#${result.channel.id}>\n` +
            `• Cara Kerja: Setiap member yang bergabung ke channel trigger ini otomatis dibuatkan room voice pribadi.\n` +
            `• Panel Kontrol Interaktif: Pemilik room mendapatkan kontrol penuh (kunci room privat/publik, ubah nama room, batas member, serta kick & whitelist).`
          )
          .setFooter({ text: 'Gunakan /setvoicehub aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setvoicehub:', err);
        return interaction.editReply({
          content: `Gagal mengatur Voice Hub: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        removeModularFeature(interaction.guild.id, 'voicehub');

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Voice Hub Dihapus')
          .setDescription('Pengaturan sistem otomatisasi Voice Hub telah dinonaktifkan.')
          .setFooter({ text: 'Ketik /setvoicehub kembali jika ingin mengaktifkannya sewaktu-waktu.' })
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
