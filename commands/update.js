const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { isBotOwner } = require('../ownerHelper');
const { pullLatestCode, reloadModulesAndCommands } = require('../hotReloadHelper');

/**
 * Mengirim notifikasi log pembaruan ke channel server logs (audit-log, update-logs, server-logs)
 */
async function sendServerLogsNotification(interaction, { title, description, color, fields }) {
  const client = interaction.client;
  const targetChannels = new Map();

  // 1. Cek server tempat perintah /update dieksekusi (Current Guild)
  if (interaction.guild) {
    const guild = interaction.guild;
    try {
      const { getLogConfig } = require('../logHelper');
      const cfg = getLogConfig(guild.id);
      if (cfg?.channelId) {
        const ch = guild.channels.cache.get(cfg.channelId) || (await guild.channels.fetch(cfg.channelId).catch(() => null));
        if (ch && ch.isTextBased()) targetChannels.set(ch.id, ch);
      }
    } catch (e) {}

    const guildLogCh = guild.channels.cache.find((c) => {
      if (!c.isTextBased()) return false;
      const cleanName = c.name.toLowerCase().replace(/[^a-z]/g, '');
      return ['serverlogs', 'serverlog', 'updatelogs', 'updatelog', 'botlogs', 'botlog', 'auditlog', 'auditlogs', 'logs'].includes(cleanName);
    });
    if (guildLogCh) {
      targetChannels.set(guildLogCh.id, guildLogCh);
    }
  }

  // 2. Cek Server Official (kategori monitoring & update-logs)
  try {
    const { getOfficialGuildId, ensureMonitoringChannels } = require('../botMonitoringHelper');
    const monChannels = await ensureMonitoringChannels(client).catch(() => null);
    if (monChannels?.updateLogsChannel && monChannels.updateLogsChannel.isTextBased()) {
      targetChannels.set(monChannels.updateLogsChannel.id, monChannels.updateLogsChannel);
    }

    const officialGuildId = getOfficialGuildId();
    const officialGuild = client.guilds.cache.get(officialGuildId) || (await client.guilds.fetch(officialGuildId).catch(() => null));
    if (officialGuild) {
      const offLogCh = officialGuild.channels.cache.find((c) => {
        if (!c.isTextBased()) return false;
        const cleanName = c.name.toLowerCase().replace(/[^a-z]/g, '');
        return ['serverlogs', 'serverlog', 'updatelogs', 'updatelog', 'botlogs', 'botlog', 'auditlog'].includes(cleanName);
      });
      if (offLogCh) {
        targetChannels.set(offLogCh.id, offLogCh);
      }
    }
  } catch (e) {}

  if (targetChannels.size === 0) return [];

  const logEmbed = new EmbedBuilder()
    .setColor(color || 0x57F287)
    .setAuthor({
      name: 'FlyBot Server Logs • Pembaruan Sistem',
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle(title)
    .setDescription(description)
    .addFields(fields || [])
    .setFooter({ text: 'FlyBot System Logs • Continuous Deployment Tracker' })
    .setTimestamp();

  const sentChannelIds = [];
  for (const [chId, channel] of targetChannels.entries()) {
    try {
      await channel.send({ embeds: [logEmbed] });
      sentChannelIds.push(chId);
    } catch (err) {
      console.warn(`[UPDATE LOG] Gagal kirim ke channel ${chId}:`, err.message);
    }
  }

  return sentChannelIds;
}

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

      await sendServerLogsNotification(interaction, {
        title: 'Pembaruan Sistem Bot Mengalami Kendala',
        description: `Terjadi kendala saat melakukan git pull di server Pterodactyl:\n\`\`\`\n${gitResult.details}\n\`\`\``,
        color: 0xED4245,
        fields: [
          { name: 'Pengelola', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
          { name: 'Status', value: 'Gagal Menarik Kode', inline: true },
          { name: 'Waktu Kejadian', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
        ],
      });

      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // 2. Mode Hot-Reload (Tanpa Restart)
    if (mode === 'hotreload') {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

      // KONDISI A: Tidak ada perubahan / sudah versi terbaru
      if (!gitResult.hasUpdates) {
        const sentLogs = await sendServerLogsNotification(interaction, {
          title: 'Pemeriksaan Pembaruan Sistem Bot (Sistem Sudah Terkini)',
          description:
            `Pemeriksaan repositori GitHub telah dijalankan oleh Owner.\n\n` +
            `Kode bot saat ini sudah berada di versi paling baru dan belum ada commit atau perubahan baru di repositori GitHub.\n` +
            `Semua modul, sistem musik, dan fitur bot saat ini berjalan normal dan optimal pada commit terakhir.`,
          color: 0x5865F2,
          fields: [
            { name: 'Pengelola', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
            { name: 'Status Versi', value: 'Up to Date (Versi Terbaru)', inline: true },
            { name: 'Commit Saat Ini', value: `\`${gitResult.latestCommit}\``, inline: true },
            { name: 'Waktu Pengecekan', value: `${elapsed} detik`, inline: true },
            { name: 'Status Musik & Layanan', value: 'Aktif 100% Normal Tanpa Gangguan', inline: false },
          ],
        });

        const upToDateEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setTitle('Sistem Bot Sudah Versi Terbaru (Tidak Ada Update)')
          .setDescription(
            `Pengecekan repositori GitHub selesai.\n\n` +
            `Kode bot saat ini sudah berada di versi paling baru dan belum ada commit atau perubahan baru di repositori GitHub.\n` +
            `Semua modul, sistem musik, dan fitur bot saat ini berjalan normal dan optimal pada commit terakhir.`
          )
          .addFields(
            { name: 'Status Versi', value: 'Up to Date (Versi Terbaru)', inline: true },
            { name: 'Commit Saat Ini', value: `\`${gitResult.latestCommit}\``, inline: true },
            { name: 'Waktu Pengecekan', value: `${elapsed} detik`, inline: true },
            { name: 'Status Musik & Layanan', value: 'Aktif 100% Normal Tanpa Gangguan', inline: false }
          )
          .setFooter({ text: 'FlyBot System Check • Belum Ada Pembaruan Baru' })
          .setTimestamp();

        if (sentLogs.length > 0) {
          upToDateEmbed.addFields({
            name: 'Notifikasi Server Logs',
            value: `Log pengecekan berhasil dikirim ke: ${sentLogs.map((id) => `<#${id}>`).join(', ')}`,
            inline: false,
          });
        }

        return interaction.editReply({ embeds: [upToDateEmbed] });
      }

      // KONDISI B: Ditemukan pembaruan baru dari GitHub
      const reloadResult = await reloadModulesAndCommands(interaction.client);

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

        await sendServerLogsNotification(interaction, {
          title: 'Update Berhasil Ditarik, Reload Memori Mengalami Kendala',
          description: `Kode terbaru dari GitHub sudah berhasil ditarik, tetapi ada kendala saat reload modul:\n\`\`\`\n${reloadResult.error}\n\`\`\``,
          color: 0xFEE75C,
          fields: [
            { name: 'Pengelola', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
            { name: 'Commit Terbaru', value: `\`${gitResult.latestCommit}\``, inline: true },
            { name: 'Waktu Eksekusi', value: `${elapsed} detik`, inline: true },
          ],
        });

        return interaction.editReply({ embeds: [reloadErrEmbed] });
      }

      // Kirim notifikasi lengkap ke server logs
      const sentLogs = await sendServerLogsNotification(interaction, {
        title: 'Pembaruan Sistem Bot Berhasil Diterapkan (Zero Downtime)',
        description:
          `Ditemukan pembaruan baru dari GitHub! Kode bot telah berhasil diunduh dan seluruh modul serta commands langsung di-reload seketika di memori.\n\n` +
          `Server Pterodactyl **tidak perlu direstart**, bot tidak offline, dan lagu/musik yang sedang diputar **tetap berjalan lancar tanpa terputus**!`,
        color: 0x57F287,
        fields: [
          { name: 'Pengelola', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
          { name: 'Metode Update', value: 'Hot-Reload (Tanpa Restart)', inline: true },
          { name: 'Waktu Proses', value: `${elapsed} detik`, inline: true },
          { name: 'Versi Sebelumnya', value: `\`${gitResult.beforeCommit || 'Awal'}\``, inline: true },
          { name: 'Versi Terbaru', value: `\`${gitResult.afterCommit || '-'}\``, inline: true },
          { name: 'Total Command Di-reload', value: `**${reloadResult.loadedCount} Commands** siap digunakan`, inline: true },
          { name: 'Commit Terbaru', value: `\`${gitResult.latestCommit}\``, inline: false },
          {
            name: 'Rincian Pembaruan Git',
            value: `\`\`\`\n${gitResult.details.slice(0, 350)}\n\`\`\``,
            inline: false,
          },
          { name: 'Status Layanan & Musik', value: 'Aktif 100% Normal', inline: false },
        ],
      });

      const successEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Update Bot Berhasil Diterapkan (Zero Downtime)')
        .setDescription(
          `Ditemukan pembaruan baru dari GitHub! Kode bot telah berhasil diunduh dan seluruh modul serta commands langsung di-reload seketika di memori.\n\n` +
          `Server Pterodactyl **tidak perlu direstart**, bot tidak offline, dan lagu/musik yang sedang diputar **tetap berjalan lancar tanpa terputus**!`
        )
        .addFields(
          { name: 'Metode Update', value: 'Hot-Reload (Tanpa Restart)', inline: true },
          { name: 'Status Layanan & Musik', value: 'Aktif 100% Normal', inline: true },
          { name: 'Waktu Proses', value: `${elapsed} detik`, inline: true },
          { name: 'Versi Sebelumnya', value: `\`${gitResult.beforeCommit || '-'}\``, inline: true },
          { name: 'Versi Terbaru', value: `\`${gitResult.afterCommit || '-'}\``, inline: true },
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

      if (sentLogs.length > 0) {
        successEmbed.addFields({
          name: 'Notifikasi Server Logs',
          value: `Log pembaruan berhasil diposting ke: ${sentLogs.map((id) => `<#${id}>`).join(', ')}`,
          inline: false,
        });
      }

      return interaction.editReply({ embeds: [successEmbed] });
    }

    // 3. Mode Graceful Restart
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

    const sentLogs = await sendServerLogsNotification(interaction, {
      title: 'Pembaruan Sistem Bot • Memulai Ulang Bot',
      description:
        `Kode terbaru dari GitHub berhasil diproses (\`${gitResult.latestCommit}\`).\n\n` +
        `Bot akan melakukan restart proses dalam 2 detik. Panel Pterodactyl akan menyalakan bot kembali secara otomatis.`,
      color: 0x5865F2,
      fields: [
        { name: 'Pengelola', value: `<@${interaction.user.id}> (\`${interaction.user.tag || interaction.user.username}\`)`, inline: true },
        { name: 'Metode', value: 'Graceful Process Restart', inline: true },
        { name: 'Status Kode', value: gitResult.hasUpdates ? 'Ada Pembaruan Baru' : 'Sudah Versi Terbaru', inline: true },
        { name: 'Waktu Pengecekan', value: `${elapsed} detik`, inline: true },
      ],
    });

    const restartEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Pembaruan Kode Selesai • Memulai Ulang Bot')
      .setDescription(
        `Kode terbaru dari GitHub berhasil diproses (\`${gitResult.latestCommit}\`).\n\n` +
        `Bot akan melakukan restart proses dalam 2 detik. Panel Pterodactyl akan menyalakan bot kembali secara otomatis.`
      )
      .addFields(
        { name: 'Metode', value: 'Graceful Process Restart', inline: true },
        { name: 'Status Kode', value: gitResult.hasUpdates ? 'Ada Pembaruan Baru' : 'Sudah Versi Terbaru', inline: true },
        { name: 'Waktu Pengecekan', value: `${elapsed} detik`, inline: true }
      )
      .setFooter({ text: 'FlyBot System Restart' })
      .setTimestamp();

    if (sentLogs.length > 0) {
      restartEmbed.addFields({
        name: 'Notifikasi Server Logs',
        value: `Log restart berhasil diposting ke: ${sentLogs.map((id) => `<#${id}>`).join(', ')}`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [restartEmbed] });

    setTimeout(() => {
      process.exit(0);
    }, 2000);
  },
};

