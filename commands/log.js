const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  getLogConfig,
  setupAuditLog,
  removeAuditLog,
} = require('../logHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('log')
    .setDescription('Kelola sistem catatan audit log server (Otomatis buat kategori & channel)')
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup, Hapus, atau Status (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Kategori AUDIT LOG & Channel)', value: 'setup' },
          { name: 'Hapus (Hapus Kategori & Channel Audit Log)', value: 'hapus' },
          { name: 'Status (Lihat Status Konfigurasi Log)', value: 'status' }
        )
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.options.getString('aksi') || 'setup';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupAuditLog(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name}  •  Audit Log`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Sistem Audit Log Berhasil Diaktifkan')
          .setDescription(
            `Kategori **${result.category.name}** dan channel rahasia <#${result.channel.id}> telah siap.\n\n` +
            `Channel tersebut dikunci otomatis agar **hanya bisa dilihat oleh Administrator**.\n\n` +
            `**Aktivitas Yang Mulai Dicatat:**\n` +
            `• Pesan terhapus (beserta teks & lampiran)\n` +
            `• Pesan diedit (teks sebelum & sesudah)\n` +
            `• Member keluar (riwayat role & waktu join)\n` +
            `• Perubahan role member (pemberian & pencabutan role)`
          )
          .setFooter({ text: 'Ketik /log aksi:Hapus jika ingin menonaktifkan' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setupAuditLog:', err);
        return interaction.editReply({
          content: `Gagal mengaktifkan audit log: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const cfg = getLogConfig(interaction.guildId);
        if (!cfg || !cfg.enabled) {
          return interaction.editReply({
            content: 'Sistem audit log saat ini belum aktif di server ini.',
          });
        }

        await removeAuditLog(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Audit Log Dinonaktifkan')
          .setDescription(
            'Channel audit log dan kategori telah berhasil dihapus secara bersih.\n\n' +
            'Ketik `/log` kembali jika ingin mengaktifkannya sewaktu-waktu.'
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat removeAuditLog:', err);
        return interaction.editReply({
          content: `Gagal menghapus audit log: ${err.message}`,
        });
      }
    }

    if (action === 'status') {
      const cfg = getLogConfig(interaction.guildId);
      const isEnabled = cfg && cfg.enabled;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0x5865F2)
        .setTitle('Status Audit Log')
        .setDescription(
          `Status: **${isEnabled ? 'Aktif' : 'Nonaktif'}**\n\n` +
          `• Kategori: ${cfg?.categoryId ? `<#${cfg.categoryId}>` : '*(Tidak ada)*'}\n` +
          `• Channel Log: ${cfg?.channelId ? `<#${cfg.channelId}>` : '*(Tidak ada)*'}\n\n` +
          `Gunakan \`/log\` untuk mengaktifkan atau \`/log aksi:Hapus\` untuk menonaktifkan.`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
