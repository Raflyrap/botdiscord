const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.join(__dirname, 'botMonitorData.json');

// Default target Official Server & Log Channel ID dari link Discord User
const DEFAULT_OFFICIAL_GUILD_ID = '1563902604394627074';
const DEFAULT_OFFICIAL_LOG_CHANNEL_ID = '1563922512016965764';

function getOfficialGuildId() {
  return process.env.OFFICIAL_GUILD_ID || DEFAULT_OFFICIAL_GUILD_ID;
}

function getOfficialLogChannelId() {
  return process.env.OFFICIAL_LOG_CHANNEL_ID || DEFAULT_OFFICIAL_LOG_CHANNEL_ID;
}

// Membaca file data monitor
function loadMonitorData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const defaultData = {
        dashboardMessageId: null,
        totalCommandsExecuted: 0,
        lastUpdated: null,
      };
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[BOT MONITOR] Error saat membaca botMonitorData.json:', err);
    return {
      dashboardMessageId: null,
      totalCommandsExecuted: 0,
      lastUpdated: null,
    };
  }
}

// Menyimpan data monitor
function saveMonitorData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[BOT MONITOR] Error saat menyimpan botMonitorData.json:', err);
  }
}

// Helper: Format Uptime ke format Bahasa Indonesia
function formatUptime(uptimeSeconds) {
  const sec = Math.floor(uptimeSeconds);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const parts = [];
  if (days > 0) parts.push(`${days} Hari`);
  if (hours > 0) parts.push(`${hours} Jam`);
  if (minutes > 0) parts.push(`${minutes} Menit`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} Detik`);
  return parts.join(' ');
}

// Catat setiap kali ada slash command dieksekusi
function recordCommandExecution() {
  const data = loadMonitorData();
  data.totalCommandsExecuted = (data.totalCommandsExecuted || 0) + 1;
  saveMonitorData(data);
}

// Helper: Mendapatkan channel tracking log di official server
async function getLogChannel(client) {
  const channelId = getOfficialLogChannelId();
  if (!channelId) return null;

  try {
    let ch = client.channels.cache.get(channelId);
    if (!ch) {
      ch = await client.channels.fetch(channelId).catch(() => null);
    }
    return ch;
  } catch (err) {
    console.warn('[BOT MONITOR] Gagal mengambil log channel:', err.message);
    return null;
  }
}

// Event: Ketika BotFly dimasukkan ke server baru (guildCreate)
async function handleGuildCreate(guild, client) {
  try {
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const owner = await guild.fetchOwner().catch(() => null);
    const logChannel = await getLogChannel(client);

    console.log(`[GUILD JOIN] FlyBot dimasukkan ke: ${guild.name} (${guild.id}) - Owner: ${owner?.user?.tag || guild.ownerId}`);

    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287) // Hijau Vibrant
        .setAuthor({
          name: 'FlyBot Network • Server Baru Bergabung',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`BotFly Ditambahkan ke Server: ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
        .setDescription('FlyBot telah berhasil diundang dan resmi bergabung ke dalam server Discord baru.')
        .addFields(
          { name: 'Nama Server', value: `**${guild.name}**`, inline: true },
          { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
          {
            name: 'Pemilik Server',
            value: owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : `<@${guild.ownerId}>`,
            inline: true,
          },
          {
            name: 'Anggota Server Ini',
            value: `**${(guild.memberCount || 0).toLocaleString('id-ID')} Member**`,
            inline: true,
          },
          {
            name: 'Total Server BotFly',
            value: `**${totalServers} Server**`,
            inline: true,
          },
          {
            name: 'Total Jangkauan Pengguna',
            value: `**${totalMembers.toLocaleString('id-ID')} Pengguna**`,
            inline: true,
          }
        )
        .setFooter({ text: 'FlyBot Official Tracking System' })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch((err) => {
        console.warn('[BOT MONITOR] Gagal mengirim pesan log guildCreate:', err.message);
      });
    }

    // Refresh status live dashboard
    await updateLiveDashboard(client).catch(() => {});
  } catch (err) {
    console.error('[BOT MONITOR] Error pada handleGuildCreate:', err);
  }
}

// Event: Ketika BotFly dikeluarkan dari server (guildDelete)
async function handleGuildDelete(guild, client) {
  try {
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const logChannel = await getLogChannel(client);

    console.log(`[GUILD LEAVE] FlyBot dikeluarkan dari: ${guild.name || 'Unknown'} (${guild.id})`);

    if (logChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245) // Merah Vibrant
        .setAuthor({
          name: 'FlyBot Network • Server Ditinggalkan',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`BotFly Dikeluarkan dari: ${guild.name || 'Server'}`)
        .setThumbnail(guild.iconURL?.({ dynamic: true }) || client.user.displayAvatarURL())
        .setDescription('FlyBot telah dikeluarkan dari server atau server tersebut telah dihapus.')
        .addFields(
          { name: 'Nama Server', value: `**${guild.name || 'Tidak Diketahui'}**`, inline: true },
          { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
          {
            name: 'Sisa Total Server',
            value: `**${totalServers} Server**`,
            inline: true,
          },
          {
            name: 'Total Jangkauan Pengguna',
            value: `**${totalMembers.toLocaleString('id-ID')} Pengguna**`,
            inline: true,
          }
        )
        .setFooter({ text: 'FlyBot Official Tracking System' })
        .setTimestamp();

      await logChannel.send({ embeds: [embed] }).catch((err) => {
        console.warn('[BOT MONITOR] Gagal mengirim pesan log guildDelete:', err.message);
      });
    }

    // Refresh status live dashboard
    await updateLiveDashboard(client).catch(() => {});
  } catch (err) {
    console.error('[BOT MONITOR] Error pada handleGuildDelete:', err);
  }
}

// Memperbarui atau membuat Pesan Dashboard Status Real-Time di Official Channel
async function updateLiveDashboard(client) {
  const logChannel = await getLogChannel(client);
  if (!logChannel) return;

  const data = loadMonitorData();
  const totalServers = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
  const uptimeStr = formatUptime(process.uptime());
  const ramUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const wsPing = Math.round(client.ws.ping || 0);

  // Status Lavalink Node
  let lavalinkStatus = 'Offline';
  try {
    if (client.lavalink?.nodeManager?.nodes) {
      const connectedNodes = [...client.lavalink.nodeManager.nodes.values()].filter((n) => n.connected);
      lavalinkStatus = connectedNodes.length > 0 ? `Online (${connectedNodes.length} Node Terhubung)` : 'Offline';
    }
  } catch {}

  const dashboardEmbed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord Blurple
    .setAuthor({
      name: 'FlyBot Official Monitoring Dashboard',
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle('Real-Time Status & Statistik Jaringan FlyBot')
    .setDescription(
      `Selamat datang di saluran pemantauan resmi **FlyBot**.\n` +
      `Dashboard ini diperbarui secara otomatis secara berkala untuk memantau performa dan jangkauan bot.\n`
    )
    .addFields(
      { name: 'Total Server Terlayani', value: `\`${totalServers} Server\``, inline: true },
      { name: 'Total Pengguna Dijangkau', value: `\`${totalMembers.toLocaleString('id-ID')} Anggota\``, inline: true },
      { name: 'Status Layanan', value: '`🟢 Online (Optimal)`', inline: true },
      { name: 'Uptime Host (VPS)', value: `\`${uptimeStr}\``, inline: true },
      { name: 'Latensi Gateway Ping', value: `\`${wsPing} ms\``, inline: true },
      { name: 'Penggunaan RAM Host', value: `\`${ramUsageMb} MB\``, inline: true },
      { name: 'Koneksi Audio Lavalink', value: `\`${lavalinkStatus}\``, inline: true },
      { name: 'Total Perintah Diproses', value: `\`${(data.totalCommandsExecuted || 0).toLocaleString('id-ID')} Perintah\``, inline: true }
    )
    .setFooter({ text: 'Otomatis diperbarui setiap 5 menit • FlyBot Network' })
    .setTimestamp();

  if (data.dashboardMessageId) {
    try {
      const existingMsg = await logChannel.messages.fetch(data.dashboardMessageId).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ embeds: [dashboardEmbed] });
        data.lastUpdated = new Date().toISOString();
        saveMonitorData(data);
        return;
      }
    } catch (err) {
      console.warn('[BOT MONITOR] Gagal mengedit dashboard message lama, akan membuat pesan baru:', err.message);
    }
  }

  // Jika pesan belum ada atau terhapus, kirim pesan baru
  try {
    const newMsg = await logChannel.send({ embeds: [dashboardEmbed] });
    data.dashboardMessageId = newMsg.id;
    data.lastUpdated = new Date().toISOString();
    saveMonitorData(data);
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim pesan dashboard baru:', err.message);
  }
}

// Inisialisasi Monitoring saat bot pertama kali siap (ClientReady)
function initBotMonitoring(client) {
  console.log(`[BOT MONITOR] Memulai sistem monitoring untuk Official Server (${getOfficialGuildId()})...`);

  // Jalankan update dashboard pertama setelah bot ready (tunggu 3 detik agar cache server terisi lengkap)
  setTimeout(() => {
    updateLiveDashboard(client).catch((err) => {
      console.error('[BOT MONITOR] Error updateLiveDashboard awal:', err.message);
    });
  }, 3000);

  // Interval otomatis update dashboard setiap 5 menit
  setInterval(() => {
    updateLiveDashboard(client).catch((err) => {
      console.error('[BOT MONITOR] Error interval updateLiveDashboard:', err.message);
    });
  }, 5 * 60 * 1000);
}

module.exports = {
  getOfficialGuildId,
  getOfficialLogChannelId,
  handleGuildCreate,
  handleGuildDelete,
  updateLiveDashboard,
  initBotMonitoring,
  recordCommandExecution,
  formatUptime,
};
