const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { isBotOwner } = require('../ownerHelper');
const { pullLatestCode, reloadModulesAndCommands } = require('../hotReloadHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('update')
    .setDescription('[Khusus Owner] Update kode bot dari GitHub secara realtime tanpa mematikan bot')
    .addStringOption((opt) =>
      opt
        .setName('mode')
        .setDescription('Pilih metode pembaruan (default: Hot-Reload tanpa restart)')
        .setRequired(false)
        .addChoices(
          {
            name: 'Hot-Reload (Rekomendasi: Tanpa restart, musik & koneksi tetap aktif)',
            value: 'hotreload',
          },
          {
            name: 'Graceful Restart (Tarik kode lalu restart proses bot)',
            value: 'restart',
          }
        )
    ),

  async execute(interaction) {
    const isOwner = await isBotOwner(interaction);
    if (!isOwner) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan oleh Owner Bot.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const mode = interaction.options.getString('mode') || 'hotreload';
    const startTime = Date.now();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // 1. Tarik pembaruan kode dari GitHub
    const gitResult = await pullLatestCode();
    if (!gitResult.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Gagal Menarik Update dari GitHub')
        .setDescription(
          `Terjadi kendala saat melakukan git pull di server Pterodactyl:\n\n` +
          `\`\`\`\n${gitResult.details}\n\`\`\`\n` +
          `Silakan periksa koneksi repository atau restart container jika terdapat konflik file.`
        )
        .setFooter({ text: 'FlyBot System Update • Error' })
        .setTimestamp();

      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // 2. Mode Hot-Reload (Tanpa Restart)
    if (mode === 'hotreload') {
      const reloadResult = await reloadModulesAndCommands(interaction.client);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      if (!reloadResult.success) {
        const reloadErrEmbed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setTitle('Update Berhasil, Namun Reload Memori Mengalami Kendala')
          .setDescription(
            `Kode terbaru dari GitHub sudah berhasil ditarik, tetapi ada kendala saat reload modul:\n` +
            `\`\`\`\n${reloadResult.error}\n\`\`\`\n` +
            `Disarankan untuk mencoba mode \`/update mode:restart\` jika diperlukan.`
          )
          .setFooter({ text: 'FlyBot Hot-Reload • Warning' })
          .setTimestamp();

        return interaction.editReply({ embeds: [reloadErrEmbed] });
      }

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Update Bot Berhasil Diterapkan (Zero Downtime)')
        .setDescription(
          `Kode bot berhasil diperbarui ke versi terbaru dan seluruh modul/commands telah di-reload seketika di memori.\n` +
          `Server Pterodactyl **tidak perlu direstart**, bot tidak offline, dan lagu/musik yang sedang diputar **tetap berjalan lancar tanpa terputus**!`
        )
        .addFields(
          { name: 'Metode Update', value: 'Hot-Reload (Tanpa Restart)', inline: true },
          { name: 'Status Layanan & Musik', value: 'Aktif 100% Normal', inline: true },
          { name: 'Waktu Proses', value: `${elapsed} detik`, inline: true },
          { name: 'Commit Terbaru', value: `\`${gitResult.latestCommit}\``, inline: false },
          { name: 'Total Command Di-reload', value: `**${reloadResult.loadedCount} Commands** siap digunakan`, inline: false },
          {
            name: 'Rincian Pembaruan Git',
            value: `\`\`\`\n${gitResult.details.slice(0, 350)}\n\`\`\``,
            inline: false,
          }
        )
        .setFooter({ text: 'FlyBot Hot-Reload System • Zero Downtime' })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    }

    // 3. Mode Graceful Restart
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const restartEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Pembaruan Kode Selesai • Memulai Ulang Bot')
      .setDescription(
        `Kode terbaru dari GitHub berhasil diunduh (\`${gitResult.latestCommit}\`).\n\n` +
        `Bot akan melakukan restart proses dalam 2 detik. Panel Pterodactyl akan menyalakan bot kembali secara otomatis.`
      )
      .addFields(
        { name: 'Metode', value: 'Graceful Process Restart', inline: true },
        { name: 'Waktu Tarik Kode', value: `${elapsed} detik`, inline: true }
      )
      .setFooter({ text: 'FlyBot System Restart' })
      .setTimestamp();

    await interaction.editReply({ embeds: [restartEmbed] });

    setTimeout(() => {
      process.exit(0);
    }, 2000);
  },
};
