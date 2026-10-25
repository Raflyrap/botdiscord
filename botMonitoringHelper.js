const fs = require('fs');
const path = require('path');
const {
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
} = require('discord.js');

const DATA_PATH = path.join(__dirname, 'botMonitorData.json');

// Default ID Server Official FlyBot
const DEFAULT_OFFICIAL_GUILD_ID = '1563902604394627074';
const DEFAULT_LOG_CHANNEL_ID = '1563922512016965764';

function getOfficialGuildId() {
  return process.env.OFFICIAL_GUILD_ID || DEFAULT_OFFICIAL_GUILD_ID;
}

// Membaca file data monitor
function loadMonitorData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const defaultData = {
        categoryId: null,
        dashboardChannelId: null,
        dashboardMessageId: null,
        serverJoinChannelId: null,
        serverLeaveChannelId: null,
        serverListChannelId: null,
        serverListMessageId: null,
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
      categoryId: null,
      dashboardChannelId: null,
      dashboardMessageId: null,
      serverJoinChannelId: null,
      serverLeaveChannelId: null,
      serverListChannelId: null,
      serverListMessageId: null,
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

// Helper: Mengambil atau mencari Server Official
async function getOfficialGuild(client) {
  const guildId = getOfficialGuildId();
  if (!guildId) return null;

  let guild = client.guilds.cache.get(guildId);
  if (!guild) {
    guild = await client.guilds.fetch(guildId).catch(() => null);
  }
  return guild;
}

// Helper: Memastikan Kategori dan Channel-channel Terpisah Khusus Privat Sudah Dibuat
async function ensureMonitoringChannels(client) {
  const officialGuild = await getOfficialGuild(client);
  if (!officialGuild) {
    console.warn(`[BOT MONITOR] Server Official (${getOfficialGuildId()}) belum terdeteksi di cache bot.`);
    return null;
  }

  const data = loadMonitorData();

  // Pastikan info application owner sudah terambil
  if (!client.application?.owner) {
    await client.application?.fetch().catch(() => null);
  }
  const appOwnerId = client.application?.owner?.id || null;

  // Pastikan Owner server ter-fetch dan ter-cache
  const guildOwner = await officialGuild.fetchOwner().catch(() => null);
  const ownerId = guildOwner?.id || officialGuild.ownerId;
  if (ownerId) {
    await client.users.fetch(ownerId).catch(() => null);
  }

  // Konfigurasi Hak Akses Privat:
  // - @everyone: DILARANG melihat, membaca, atau mengetik apapun
  // - Owner Server & Bot Owner: BISA melihat & membaca
  // - Bot: Akses penuh (Kirim pesan, embed, kelola pesan)
  const privateOverwrites = [
    {
      id: officialGuild.roles.everyone.id,
      type: OverwriteType.Role,
      deny: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: client.user.id,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (ownerId) {
    privateOverwrites.push({
      id: ownerId,
      type: OverwriteType.Member,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
      ],
      deny: [
        PermissionFlagsBits.SendMessages,
      ],
    });
  }

  if (appOwnerId && appOwnerId !== ownerId) {
    const appMember = await officialGuild.members.fetch(appOwnerId).catch(() => null);
    if (appMember) {
      privateOverwrites.push({
        id: appOwnerId,
        type: OverwriteType.Member,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ReadMessageHistory,
        ],
        deny: [
          PermissionFlagsBits.SendMessages,
        ],
      });
    }
  }

  // 1. Temukan atau Buat Kategori Induk: 👑︱FLYBOT MONITORING
  let category = null;
  if (data.categoryId) {
    category = officialGuild.channels.cache.get(data.categoryId) || (await officialGuild.channels.fetch(data.categoryId).catch(() => null));
  }
  if (!category) {
    category = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && (c.name.includes('FLYBOT MONITORING') || c.name.includes('BOT MONITORING'))
    );
  }
  if (!category) {
    try {
      category = await officialGuild.channels.create({
        name: '👑︱FLYBOT MONITORING',
        type: ChannelType.GuildCategory,
        permissionOverwrites: privateOverwrites,
      });
      data.categoryId = category.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat kategori privat: ${category.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat kategori privat:', err.message);
    }
  } else {
    // Sinkronkan permission privat ke kategori
    await category.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.categoryId !== category.id) {
      data.categoryId = category.id;
      saveMonitorData(data);
    }
  }

  const categoryId = category ? category.id : undefined;

  // 2. Channel: 📊︱live-dashboard
  let dashboardChannel = null;
  if (data.dashboardChannelId) {
    dashboardChannel = officialGuild.channels.cache.get(data.dashboardChannelId) || (await officialGuild.channels.fetch(data.dashboardChannelId).catch(() => null));
  }
  if (!dashboardChannel && DEFAULT_LOG_CHANNEL_ID) {
    dashboardChannel = officialGuild.channels.cache.get(DEFAULT_LOG_CHANNEL_ID) || (await officialGuild.channels.fetch(DEFAULT_LOG_CHANNEL_ID).catch(() => null));
  }
  if (!dashboardChannel) {
    dashboardChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && (c.name.includes('live-dashboard') || c.name.includes('status-bot'))
    );
  }
  if (!dashboardChannel) {
    try {
      dashboardChannel = await officialGuild.channels.create({
        name: '📊︱live-dashboard',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Dashboard status & statistik jaringan FlyBot realtime privat khusus owner.',
      });
      data.dashboardChannelId = dashboardChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${dashboardChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel dashboard:', err.message);
    }
  } else {
    // Pastikan channel privat dan berada di kategori monitoring
    if (dashboardChannel.parentId !== categoryId && categoryId) {
      await dashboardChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await dashboardChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.dashboardChannelId !== dashboardChannel.id) {
      data.dashboardChannelId = dashboardChannel.id;
      saveMonitorData(data);
    }
  }

  // 3. Channel: 📥︱server-masuk
  let serverJoinChannel = null;
  if (data.serverJoinChannelId) {
    serverJoinChannel = officialGuild.channels.cache.get(data.serverJoinChannelId) || (await officialGuild.channels.fetch(data.serverJoinChannelId).catch(() => null));
  }
  if (!serverJoinChannel) {
    serverJoinChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.includes('server-masuk')
    );
  }
  if (!serverJoinChannel) {
    try {
      serverJoinChannel = await officialGuild.channels.create({
        name: '📥︱server-masuk',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Log realtime server baru yang memasukkan/mengundang FlyBot.',
      });
      data.serverJoinChannelId = serverJoinChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${serverJoinChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel server-masuk:', err.message);
    }
  } else {
    if (serverJoinChannel.parentId !== categoryId && categoryId) {
      await serverJoinChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await serverJoinChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.serverJoinChannelId !== serverJoinChannel.id) {
      data.serverJoinChannelId = serverJoinChannel.id;
      saveMonitorData(data);
    }
  }

  // 4. Channel: 📤︱server-keluar
  let serverLeaveChannel = null;
  if (data.serverLeaveChannelId) {
    serverLeaveChannel = officialGuild.channels.cache.get(data.serverLeaveChannelId) || (await officialGuild.channels.fetch(data.serverLeaveChannelId).catch(() => null));
  }
  if (!serverLeaveChannel) {
    serverLeaveChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.name.includes('server-keluar')
    );
  }
  if (!serverLeaveChannel) {
    try {
      serverLeaveChannel = await officialGuild.channels.create({
        name: '📤︱server-keluar',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Log realtime server yang mengeluarkan FlyBot.',
      });
      data.serverLeaveChannelId = serverLeaveChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${serverLeaveChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel server-keluar:', err.message);
    }
  } else {
    if (serverLeaveChannel.parentId !== categoryId && categoryId) {
      await serverLeaveChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await serverLeaveChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.serverLeaveChannelId !== serverLeaveChannel.id) {
      data.serverLeaveChannelId = serverLeaveChannel.id;
      saveMonitorData(data);
    }
  }

  // 5. Channel: 🌐︱daftar-server
  let serverListChannel = null;
  if (data.serverListChannelId) {
    serverListChannel = officialGuild.channels.cache.get(data.serverListChannelId) || (await officialGuild.channels.fetch(data.serverListChannelId).catch(() => null));
  }
  if (!serverListChannel) {
    serverListChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && (c.name.includes('daftar-server') || c.name.includes('server-list'))
    );
  }
  if (!serverListChannel) {
    try {
      serverListChannel = await officialGuild.channels.create({
        name: '🌐︱daftar-server',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Direktori realtime seluruh server tempat FlyBot beroperasi.',
      });
      data.serverListChannelId = serverListChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${serverListChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel daftar-server:', err.message);
    }
  } else {
    if (serverListChannel.parentId !== categoryId && categoryId) {
      await serverListChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await serverListChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.serverListChannelId !== serverListChannel.id) {
      data.serverListChannelId = serverListChannel.id;
      saveMonitorData(data);
    }
  }

  return {
    category,
    dashboardChannel,
    serverJoinChannel,
    serverLeaveChannel,
    serverListChannel,
  };
}

// Event: Ketika BotFly dimasukkan ke server baru (guildCreate)
async function handleGuildCreate(guild, client) {
  try {
    const channels = await ensureMonitoringChannels(client);
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const owner = await guild.fetchOwner().catch(() => null);

    console.log(`[GUILD JOIN] FlyBot dimasukkan ke: ${guild.name} (${guild.id}) - Owner: ${owner?.user?.tag || guild.ownerId}`);

    if (channels?.serverJoinChannel) {
      const embed = new EmbedBuilder()
        .setColor(0x57F287) // Hijau Vibrant
        .setAuthor({
          name: 'FlyBot Network • Server Baru Bergabung',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`BotFly Ditambahkan ke Server: ${guild.name}`)
        .setThumbnail(guild.iconURL({ dynamic: true }) || client.user.displayAvatarURL())
        .setDescription(
          `FlyBot telah berhasil diundang dan resmi bergabung ke dalam server Discord baru.\n\n` +
          `**Detail Server Baru**\n` +
          `> • Nama Server: **${guild.name}**\n` +
          `> • Server ID: \`${guild.id}\`\n` +
          `> • Pemilik Server: ${owner ? `<@${owner.id}> (\`${owner.user.tag}\`)` : `<@${guild.ownerId}>`}\n` +
          `> • Anggota Server: **${(guild.memberCount || 0).toLocaleString('id-ID')} Member**\n\n` +
          `**Akumulasi Jaringan**\n` +
          `> • Total Server Sekarang: **${totalServers} Server** (+1)\n` +
          `> • Total Pengguna Global: **${totalMembers.toLocaleString('id-ID')} Pengguna**\n`
        )
        .setFooter({ text: 'FlyBot Official Tracking System' })
        .setTimestamp();

      await channels.serverJoinChannel.send({ embeds: [embed] }).catch((err) => {
        console.warn('[BOT MONITOR] Gagal mengirim pesan ke server-masuk:', err.message);
      });
    }

    // Refresh status live dashboard & daftar server secara realtime
    await updateLiveDashboard(client).catch(() => {});
    await updateServerListDashboard(client).catch(() => {});
  } catch (err) {
    console.error('[BOT MONITOR] Error pada handleGuildCreate:', err);
  }
}

// Event: Ketika BotFly dikeluarkan dari server (guildDelete)
async function handleGuildDelete(guild, client) {
  try {
    const channels = await ensureMonitoringChannels(client);
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);

    console.log(`[GUILD LEAVE] FlyBot dikeluarkan dari: ${guild.name || 'Unknown'} (${guild.id})`);

    if (channels?.serverLeaveChannel) {
      const embed = new EmbedBuilder()
        .setColor(0xED4245) // Merah Vibrant
        .setAuthor({
          name: 'FlyBot Network • Server Ditinggalkan',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(`BotFly Dikeluarkan dari: ${guild.name || 'Server'}`)
        .setThumbnail(guild.iconURL?.({ dynamic: true }) || client.user.displayAvatarURL())
        .setDescription(
          `FlyBot telah dikeluarkan dari server atau server tersebut telah dihapus.\n\n` +
          `**Detail Server**\n` +
          `> • Nama Server: **${guild.name || 'Tidak Diketahui'}**\n` +
          `> • Server ID: \`${guild.id}\`\n\n` +
          `**Akumulasi Jaringan**\n` +
          `> • Sisa Server Aktif: **${totalServers} Server** (-1)\n` +
          `> • Total Pengguna Global: **${totalMembers.toLocaleString('id-ID')} Pengguna**\n`
        )
        .setFooter({ text: 'FlyBot Official Tracking System' })
        .setTimestamp();

      await channels.serverLeaveChannel.send({ embeds: [embed] }).catch((err) => {
        console.warn('[BOT MONITOR] Gagal mengirim pesan ke server-keluar:', err.message);
      });
    }

    // Refresh status live dashboard & daftar server secara realtime
    await updateLiveDashboard(client).catch(() => {});
    await updateServerListDashboard(client).catch(() => {});
  } catch (err) {
    console.error('[BOT MONITOR] Error pada handleGuildDelete:', err);
  }
}

// Memperbarui Pesan Dashboard Status Real-Time di Channel 📊︱live-dashboard
async function updateLiveDashboard(client) {
  const channels = await ensureMonitoringChannels(client);
  if (!channels?.dashboardChannel) return;

  const data = loadMonitorData();
  const totalServers = client.guilds.cache.size;
  const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
  const uptimeStr = formatUptime(process.uptime());
  const ramUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const heapUsedMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  const wsPing = Math.round(client.ws.ping || 0);

  // Status Lavalink Audio Node
  let lavalinkStatus = 'Offline';
  try {
    if (client.lavalink?.nodeManager?.nodes) {
      const connectedNodes = [...client.lavalink.nodeManager.nodes.values()].filter((n) => n.connected);
      lavalinkStatus = connectedNodes.length > 0 ? `Online (${connectedNodes.length} Node Aktif)` : 'Offline';
    }
  } catch {}

  const dashboardEmbed = new EmbedBuilder()
    .setColor(0x5865F2) // Discord Blurple
    .setAuthor({
      name: 'FlyBot Network • Real-Time Master Dashboard',
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle('Pusat Kendali & Status Jaringan FlyBot')
    .setDescription(
      `Selamat datang di panel pemantauan privat resmi **FlyBot**.\n` +
      `Dashboard ini otomatis di-*refresh* secara **real-time** tanpa perlu mengetik perintah apa pun.\n\n` +
      `**Statistik Global Jaringan**\n` +
      `> • Total Server Terlayani: **${totalServers} Server**\n` +
      `> • Total Jangkauan Pengguna: **${totalMembers.toLocaleString('id-ID')} Anggota**\n` +
      `> • Total Perintah Diproses: **${(data.totalCommandsExecuted || 0).toLocaleString('id-ID')} Kali**\n\n` +
      `**Kesehatan Server Host (VPS/Pterodactyl)**\n` +
      `> • Status Layanan: **🟢 Online (Optimal)**\n` +
      `> • Uptime Host: **${uptimeStr}**\n` +
      `> • Latensi Gateway Ping: **${wsPing} ms**\n` +
      `> • Penggunaan RAM (RSS): **${ramUsageMb} MB**\n` +
      `> • Penggunaan RAM (Heap): **${heapUsedMb} MB**\n` +
      `> • Audio Lavalink Engine: **${lavalinkStatus}**\n\n` +
      `**Spesifikasi Lingkungan**\n` +
      `> • Node.js Runtime: **${process.version}**\n` +
      `> • Library: **Discord.js v14.18.0**\n` +
      `> • Arsitektur Host: **${process.platform} (${process.arch})**\n`
    )
    .setFooter({ text: 'Pembaruan Real-Time Otomatis • FlyBot Official' })
    .setTimestamp();

  if (data.dashboardMessageId) {
    try {
      const existingMsg = await channels.dashboardChannel.messages.fetch(data.dashboardMessageId).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ embeds: [dashboardEmbed] });
        data.lastUpdated = new Date().toISOString();
        saveMonitorData(data);
        return;
      }
    } catch (err) {
      console.warn('[BOT MONITOR] Gagal mengedit dashboard message lama, membuat baru:', err.message);
    }
  }

  // Jika belum ada pesan dashboard, buat pesan baru
  try {
    const newMsg = await channels.dashboardChannel.send({ embeds: [dashboardEmbed] });
    data.dashboardMessageId = newMsg.id;
    data.lastUpdated = new Date().toISOString();
    saveMonitorData(data);
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim pesan dashboard baru:', err.message);
  }
}

// Memperbarui Direktori Server Real-Time di Channel 🌐︱daftar-server
async function updateServerListDashboard(client) {
  const channels = await ensureMonitoringChannels(client);
  if (!channels?.serverListChannel) return;

  const data = loadMonitorData();
  const totalServers = client.guilds.cache.size;

  const sortedGuilds = [...client.guilds.cache.values()]
    .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));

  const maxDisplay = 25;
  const topGuilds = sortedGuilds.slice(0, maxDisplay);

  const listItems = topGuilds.map((g, idx) => {
    return (
      `**${idx + 1}. ${g.name}**\n` +
      `> ID: \`${g.id}\` • Anggota: **${(g.memberCount || 0).toLocaleString('id-ID')}** • Owner: <@${g.ownerId}>`
    );
  }).join('\n\n');

  const serverListEmbed = new EmbedBuilder()
    .setColor(0x2B2D31) // Sleek Dark Discord
    .setAuthor({
      name: 'FlyBot Network • Direktori Server Aktif',
      iconURL: client.user.displayAvatarURL({ dynamic: true }),
    })
    .setTitle(`Daftar Seluruh Server Terhubung (${totalServers} Server)`)
    .setDescription(
      `Daftar server tempat FlyBot beroperasi, diurutkan berdasarkan jumlah anggota:\n\n` +
      (listItems || 'Belum ada server yang terdaftar.') +
      (sortedGuilds.length > maxDisplay ? `\n\n*...dan ${sortedGuilds.length - maxDisplay} server lainnya.*` : '')
    )
    .setFooter({ text: 'Diperbarui otomatis secara real-time • FlyBot Network' })
    .setTimestamp();

  if (data.serverListMessageId) {
    try {
      const existingMsg = await channels.serverListChannel.messages.fetch(data.serverListMessageId).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ embeds: [serverListEmbed] });
        return;
      }
    } catch (err) {
      console.warn('[BOT MONITOR] Gagal mengedit pesan daftar server lama, membuat baru:', err.message);
    }
  }

  try {
    const newMsg = await channels.serverListChannel.send({ embeds: [serverListEmbed] });
    data.serverListMessageId = newMsg.id;
    saveMonitorData(data);
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim pesan daftar server baru:', err.message);
  }
}

// Inisialisasi Monitoring saat bot pertama kali siap (ClientReady)
function initBotMonitoring(client) {
  console.log(`[BOT MONITOR] Memulai inisialisasi monitoring privat di Official Server (${getOfficialGuildId()})...`);

  // Jalankan setup channel dan update dashboard pertama
  setTimeout(async () => {
    try {
      await ensureMonitoringChannels(client);
      await updateLiveDashboard(client);
      await updateServerListDashboard(client);
      console.log('[BOT MONITOR] Semua channel privat monitoring dan live dashboard siap!');
    } catch (err) {
      console.error('[BOT MONITOR] Error inisialisasi awal:', err.message);
    }
  }, 3000);

  // Interval otomatis update realtime setiap 60 detik (1 menit)
  setInterval(async () => {
    try {
      await updateLiveDashboard(client);
      await updateServerListDashboard(client);
    } catch (err) {
      console.error('[BOT MONITOR] Error interval auto-update:', err.message);
    }
  }, 60 * 1000);
}

module.exports = {
  getOfficialGuildId,
  ensureMonitoringChannels,
  handleGuildCreate,
  handleGuildDelete,
  updateLiveDashboard,
  updateServerListDashboard,
  initBotMonitoring,
  recordCommandExecution,
  formatUptime,
};
