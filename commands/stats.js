const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  getStatsConfig,
  enableServerStats,
  disableServerStats,
} = require('../serverStatsHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('Kelola channel statistik otomatis server (Server Stats Counter)')
    .addSubcommand((sub) =>
      sub
        .setName('on')
        .setDescription('Aktifkan & buat otomatis kategori dan channel statistik server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Nonaktifkan & hapus seluruh channel statistik server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Lihat status konfigurasi statistik server saat ini')
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

    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (sub === 'on') {
      try {
        const result = await enableServerStats(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name}  •  Server Stats`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Statistik Server Berhasil Diaktifkan')
          .setDescription(
            `Kategori **${result.category.name}** dan 3 channel counter telah dibuat di posisi teratas:\n\n` +
            `• <#${result.memberChannel.id}>\n` +
            `• <#${result.adminChannel.id}>\n` +
            `• <#${result.activeChannel.id}>\n\n` +
            `*Channel terkunci secara otomatis agar tidak bisa dimasuki user, dan angka statistik akan diperbarui otomatis secara realtime.*`
          )
          .setFooter({ text: 'Ketik /stats off kapan saja untuk menonaktifkan & menghapus channel' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat enableServerStats:', err);
        return interaction.editReply({
          content: `Gagal mengaktifkan statistik server: ${err.message}`,
        });
      }
    }

    if (sub === 'off') {
      try {
        const cfg = getStatsConfig(interaction.guildId);
        if (!cfg || !cfg.enabled) {
          return interaction.editReply({
            content: 'Statistik server saat ini memang belum aktif di server ini.',
          });
        }

        await disableServerStats(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Statistik Server Dinonaktifkan')
          .setDescription(
            'Seluruh channel statistik dan kategori **STATISTIK SERVER** telah berhasil dihapus secara bersih.\n\n' +
            'Ketik `/stats on` jika ingin mengaktifkannya kembali sewaktu-waktu.'
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat disableServerStats:', err);
        return interaction.editReply({
          content: `Gagal menonaktifkan statistik server: ${err.message}`,
        });
      }
    }

    if (sub === 'status') {
      const cfg = getStatsConfig(interaction.guildId);
      const isEnabled = cfg && cfg.enabled;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0x5865F2)
        .setTitle('Status Server Stats')
        .setDescription(
          `Status: **${isEnabled ? 'Aktif' : 'Nonaktif'}**\n\n` +
          `• Kategori: ${cfg?.categoryId ? `<#${cfg.categoryId}>` : '*(Tidak ada)*'}\n` +
          `• Total Member: ${cfg?.memberChannelId ? `<#${cfg.memberChannelId}>` : '*(Tidak ada)*'}\n` +
          `• Total Admin: ${cfg?.adminChannelId ? `<#${cfg.adminChannelId}>` : '*(Tidak ada)*'}\n` +
          `• Channel Aktif: ${cfg?.activeChannelId ? `<#${cfg.activeChannelId}>` : '*(Tidak ada)*'}\n\n` +
          `Gunakan: \`/stats on\` untuk mengaktifkan atau \`/stats off\` untuk menonaktifkan.`
        )
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
