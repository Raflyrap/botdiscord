const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  OverwriteType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');

const DATA_PATH = path.join(__dirname, 'botMonitorData.json');

// Default ID Server Official FlyBot & Link Server
const DEFAULT_OFFICIAL_GUILD_ID = '1563902604394627074';
const DEFAULT_LOG_CHANNEL_ID = '1563922512016965764';
const DEFAULT_OFFICIAL_INVITE_URL = 'https://discord.com/invite/flybot';
const DEFAULT_OFFICIAL_WEBSITE_URL = 'https://flyneuroai.com/';

function getOfficialGuildId() {
  return process.env.OFFICIAL_GUILD_ID || DEFAULT_OFFICIAL_GUILD_ID;
}

function getOfficialInviteUrl() {
  return process.env.OFFICIAL_INVITE_URL || DEFAULT_OFFICIAL_INVITE_URL;
}

function getOfficialWebsiteUrl() {
  return process.env.OFFICIAL_WEBSITE_URL || DEFAULT_OFFICIAL_WEBSITE_URL;
}

// Membaca file data monitor
function loadMonitorData() {
  const todayStr = new Date().toISOString().slice(0, 10);
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
        updateLogsChannelId: null,
        errorLogsChannelId: null,
        lastReportedCommit: null,
        totalCommandsExecuted: 0,
        commandUsage: {},
        dailyGrowth: { date: todayStr, joined: 0, left: 0 },
        lastUpdated: null,
      };
      fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!('updateLogsChannelId' in parsed)) parsed.updateLogsChannelId = null;
    if (!('errorLogsChannelId' in parsed)) parsed.errorLogsChannelId = null;
    if (!('lastReportedCommit' in parsed)) parsed.lastReportedCommit = null;
    if (!('commandUsage' in parsed) || typeof parsed.commandUsage !== 'object' || parsed.commandUsage === null) {
      parsed.commandUsage = {};
    }
    if (!('dailyGrowth' in parsed) || typeof parsed.dailyGrowth !== 'object' || parsed.dailyGrowth === null) {
      parsed.dailyGrowth = { date: todayStr, joined: 0, left: 0 };
    }
    return parsed;
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
      updateLogsChannelId: null,
      errorLogsChannelId: null,
      lastReportedCommit: null,
      totalCommandsExecuted: 0,
      commandUsage: {},
      dailyGrowth: { date: todayStr, joined: 0, left: 0 },
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
function recordCommandExecution(commandName) {
  const data = loadMonitorData();
  data.totalCommandsExecuted = (data.totalCommandsExecuted || 0) + 1;
  if (commandName && typeof commandName === 'string') {
    if (!data.commandUsage) data.commandUsage = {};
    data.commandUsage[commandName] = (data.commandUsage[commandName] || 0) + 1;
  }
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

  // 1. Temukan atau Buat Kategori Induk: FLYBOT MONITORING
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
        name: 'FLYBOT MONITORING',
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

  // 2. Channel: live-dashboard
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
        name: 'live-dashboard',
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

  // 3. Channel: server-masuk
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
        name: 'server-masuk',
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

  // 4. Channel: server-keluar
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
        name: 'server-keluar',
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

  // 5. Channel: daftar-server
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
        name: 'daftar-server',
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

  // 6. Channel: update-logs
  let updateLogsChannel = null;
  if (data.updateLogsChannelId) {
    updateLogsChannel = officialGuild.channels.cache.get(data.updateLogsChannelId) || (await officialGuild.channels.fetch(data.updateLogsChannelId).catch(() => null));
  }
  if (!updateLogsChannel) {
    updateLogsChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && (c.name.includes('update-logs') || c.name.includes('bot-updates'))
    );
  }
  if (!updateLogsChannel) {
    try {
      updateLogsChannel = await officialGuild.channels.create({
        name: 'update-logs',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Log otomatis rincian pembaruan versi (GitHub commit & deploy log) FlyBot.',
      });
      data.updateLogsChannelId = updateLogsChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${updateLogsChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel update-logs:', err.message);
    }
  } else {
    if (updateLogsChannel.parentId !== categoryId && categoryId) {
      await updateLogsChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await updateLogsChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.updateLogsChannelId !== updateLogsChannel.id) {
      data.updateLogsChannelId = updateLogsChannel.id;
      saveMonitorData(data);
    }
  }

  // 7. Channel: error-logs (Peringatan & kendala teknis privat)
  let errorLogsChannel = null;
  if (data.errorLogsChannelId) {
    errorLogsChannel = officialGuild.channels.cache.get(data.errorLogsChannelId) || (await officialGuild.channels.fetch(data.errorLogsChannelId).catch(() => null));
  }
  if (!errorLogsChannel) {
    errorLogsChannel = officialGuild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && (c.name.includes('error-logs') || c.name.includes('bot-errors'))
    );
  }
  if (!errorLogsChannel) {
    try {
      errorLogsChannel = await officialGuild.channels.create({
        name: 'error-logs',
        type: ChannelType.GuildText,
        parent: categoryId,
        permissionOverwrites: privateOverwrites,
        topic: 'Log realtime error sistem, uncaught exception, dan kendala izin FlyBot privat khusus owner.',
      });
      data.errorLogsChannelId = errorLogsChannel.id;
      saveMonitorData(data);
      console.log(`[BOT MONITOR] Berhasil membuat channel: ${errorLogsChannel.name}`);
    } catch (err) {
      console.error('[BOT MONITOR] Gagal membuat channel error-logs:', err.message);
    }
  } else {
    if (errorLogsChannel.parentId !== categoryId && categoryId) {
      await errorLogsChannel.setParent(categoryId, { lockPermissions: false }).catch(() => {});
    }
    await errorLogsChannel.permissionOverwrites.set(privateOverwrites).catch(() => {});
    if (data.errorLogsChannelId !== errorLogsChannel.id) {
      data.errorLogsChannelId = errorLogsChannel.id;
      saveMonitorData(data);
    }
  }

  return {
    category,
    dashboardChannel,
    serverJoinChannel,
    serverLeaveChannel,
    serverListChannel,
    updateLogsChannel,
    errorLogsChannel,
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

    // 1. Kirim log ke channel server-masuk di server official
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

    // 2. Kirim pesan sambutan & iklan sekilas + tombol join server resmi ke server yang baru memasukkan bot
    try {
      let targetChannel = guild.systemChannel;
      const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));

      // Jika systemChannel tidak bisa dikirim embed, cari channel teks pertama yang memiliki izin
      if (
        !targetChannel ||
        !targetChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
      ) {
        targetChannel = guild.channels.cache.find(
          (c) =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]) &&
            (c.name.includes('general') ||
              c.name.includes('chat') ||
              c.name.includes('utama') ||
              c.name.includes('welcome') ||
              c.name.includes('bot'))
        );
      }

      if (!targetChannel) {
        targetChannel = guild.channels.cache.find(
          (c) =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
        );
      }

      if (targetChannel) {
        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: 'FlyBot Multi-Purpose • Official System',
            iconURL: client.user.displayAvatarURL({ dynamic: true }),
          })
          .setTitle(`Halo ${guild.name}! Terima Kasih Telah Mengundang FlyBot`)
          .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
          .setDescription(
            `Hai semuanya! **FlyBot** kini resmi hadir untuk membantu mengelola dan meramaikan server **${guild.name}**.\n\n` +
            `**Fitur-Fitur Unggulan FlyBot:**\n` +
            `> • **Music Studio**: Suara HQ jernih Lavalink v4, playlist, bassboost, dan autoplay.\n` +
            `> • **AI Assistant & Voice AI**: Asisten obrolan cerdas di teks dan voice room.\n` +
            `> • **Auto Moderation & Anti-Toxic**: Perlindungan otomatis terhadap spam & kata kasar.\n` +
            `> • **Dynamic Temp Voice**: Otomatisasi ruang voice pribadi (Join-to-Create).\n` +
            `> • **Support Ticket**: Sistem tiket komprehensif untuk pengaduan & support member.\n` +
            `> • **Server Stats & Leveling**: Kartu profil XP, leaderboard, dan statistik otomatis.\n\n` +
            `**Mulai Menjelajah:**\n` +
            `> • Gunakan \`/help\` untuk melihat seluruh menu dan tutorial perintah.\n` +
            `> • Gunakan \`/setup\` untuk memasang channel server otomatis sekali klik.\n\n` +
            `**Komunitas Resmi FlyBot:**\n` +
            `Ingin request fitur, lapor kendala, diskusi teknis, atau berdiskusi dengan sesama pengguna? Kunjungi website resmi atau server official kami.`
          )
          .setFooter({ text: 'FlyBot • The All-in-One Discord Experience' })
          .setTimestamp();

        const inviteUrl = getOfficialInviteUrl();
        const websiteUrl = getOfficialWebsiteUrl();
        const actionRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Website Resmi (flyneuroai.com)')
            .setStyle(ButtonStyle.Link)
            .setURL(websiteUrl),
          new ButtonBuilder()
            .setLabel('Gabung Server Resmi FlyBot')
            .setStyle(ButtonStyle.Link)
            .setURL(inviteUrl)
        );

        await targetChannel.send({ embeds: [welcomeEmbed], components: [actionRow] }).catch(() => {});
      }
    } catch (welcomeErr) {
      console.warn('[GUILD JOIN AD] Gagal mengirim pesan sambutan iklan:', welcomeErr.message);
    }

    try {
      const monitorData = loadMonitorData();
      const today = new Date().toISOString().slice(0, 10);
      if (!monitorData.dailyGrowth || monitorData.dailyGrowth.date !== today) {
        monitorData.dailyGrowth = { date: today, joined: 0, left: 0 };
      }
      monitorData.dailyGrowth.joined = (monitorData.dailyGrowth.joined || 0) + 1;
      saveMonitorData(monitorData);
    } catch {}

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

    try {
      const monitorData = loadMonitorData();
      const today = new Date().toISOString().slice(0, 10);
      if (!monitorData.dailyGrowth || monitorData.dailyGrowth.date !== today) {
        monitorData.dailyGrowth = { date: today, joined: 0, left: 0 };
      }
      monitorData.dailyGrowth.left = (monitorData.dailyGrowth.left || 0) + 1;
      saveMonitorData(monitorData);
    } catch {}

    // Refresh status live dashboard & daftar server secara realtime
    await updateLiveDashboard(client).catch(() => {});
    await updateServerListDashboard(client).catch(() => {});
  } catch (err) {
    console.error('[BOT MONITOR] Error pada handleGuildDelete:', err);
  }
}

// Anti-flood cache untuk error logger
const recentErrors = new Map();

// Helper: Mengirim Log Peringatan Error Realtime ke Channel error-logs
async function sendErrorLog(client, { title = 'System Error', error, guild, user, commandName } = {}) {
  try {
    if (!client) return;
    const channels = await ensureMonitoringChannels(client).catch(() => null);
    if (!channels?.errorLogsChannel) return;

    const errMsg = error?.stack || error?.message || String(error) || 'Unknown Error';
    const errSummary = error?.message || String(error);

    // Throttle error identik dalam 30 detik agar tidak spam channel
    const errorKey = `${title}_${errSummary}`;
    const now = Date.now();
    const lastSent = recentErrors.get(errorKey);
    if (lastSent && now - lastSent < 30000) {
      return;
    }
    recentErrors.set(errorKey, now);

    if (recentErrors.size > 100) {
      recentErrors.clear();
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Merah Error
      .setAuthor({
        name: 'FlyBot System • Peringatan Error Realtime',
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTitle(`🚨 ${title}`)
      .setDescription(
        `Terdeteksi masalah teknis pada sistem bot:\n\n` +
        `**Rincian Error:**\n` +
        `\`\`\`js\n${errMsg.slice(0, 1500)}\n\`\`\``
      )
      .addFields(
        {
          name: 'Server / Lokasi',
          value: guild ? `**${guild.name}** (\`${guild.id}\`)` : '`Internal / Global Host`',
          inline: true,
        },
        {
          name: 'Pengguna / Trigger',
          value: user ? `<@${user.id}> (\`${user.tag || user.username}\`)` : '`System Process`',
          inline: true,
        },
        {
          name: 'Perintah',
          value: commandName ? `\`/${commandName}\`` : '`Non-Command`',
          inline: true,
        }
      )
      .setFooter({ text: 'FlyBot Error Sentinel • Privat Owner' })
      .setTimestamp();

    await channels.errorLogsChannel.send({ embeds: [embed] }).catch(() => {});
  } catch (logErr) {
    console.error('[SEND ERROR LOG FAILED]:', logErr.message);
  }
}

// Memperbarui Pesan Dashboard Status Real-Time di Channel live-dashboard
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
  let activePlayers = 0;
  try {
    if (client.lavalink?.nodeManager?.nodes) {
      const connectedNodes = [...client.lavalink.nodeManager.nodes.values()].filter((n) => n.connected);
      lavalinkStatus = connectedNodes.length > 0 ? `Online (${connectedNodes.length} Node Aktif)` : 'Offline';
    }
    if (client.lavalink?.players) {
      activePlayers = [...client.lavalink.players.values()].filter((p) => p.playing).length;
    }
  } catch {}

  // Hitung jumlah room patroli 24/7 aktif
  let activePatroli = 0;
  try {
    const { getAllPatroliConfigs } = require('./patroliHelper');
    activePatroli = Object.keys(getAllPatroliConfigs() || {}).length;
  } catch {}

  // Hitung Top 5 Perintah Terpopuler
  const sortedCmds = Object.entries(data.commandUsage || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let topCmdsText = '> • *Belum ada data perintah tercatat.*';
  if (sortedCmds.length > 0) {
    topCmdsText = sortedCmds
      .map(([cmd, count], idx) => `> • **${idx + 1}.** \`/${cmd}\`: **${count.toLocaleString('id-ID')}x dipanggil**`)
      .join('\n');
  }

  // Hitung Pertumbuhan Hari Ini
  const today = new Date().toISOString().slice(0, 10);
  const growth = data.dailyGrowth && data.dailyGrowth.date === today ? data.dailyGrowth : { joined: 0, left: 0 };
  const netGrowth = (growth.joined || 0) - (growth.left || 0);
  const netSign = netGrowth >= 0 ? `+${netGrowth}` : `${netGrowth}`;

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
      `**Statistik Jaringan Global**\n` +
      `> • Total Server Terlayani: **${totalServers} Server**\n` +
      `> • Total Jangkauan Pengguna: **${totalMembers.toLocaleString('id-ID')} Anggota**\n` +
      `> • Total Perintah Diproses: **${(data.totalCommandsExecuted || 0).toLocaleString('id-ID')} Kali**\n` +
      `> • Pertumbuhan Hari Ini: **${netSign} Server** (+${growth.joined || 0} Masuk / -${growth.left || 0} Keluar)\n\n` +
      `**🏆 Top 5 Perintah Terpopuler**\n` +
      `${topCmdsText}\n\n` +
      `**🎵 Aktivitas Audio & Voice**\n` +
      `> • Pemutar Musik Aktif: **${activePlayers} Server Sedang Memutar Musik**\n` +
      `> • Patroli 24/7 Aktif: **${activePatroli} Voice Channel**\n` +
      `> • Engine Lavalink: **${lavalinkStatus}**\n\n` +
      `**Kesehatan Server Host (VPS/Pterodactyl)**\n` +
      `> • Status Layanan: **Online (Optimal)**\n` +
      `> • Uptime Host: **${uptimeStr}**\n` +
      `> • Latensi Gateway Ping: **${wsPing} ms**\n` +
      `> • Penggunaan RAM (RSS): **${ramUsageMb} MB**\n` +
      `> • Penggunaan RAM (Heap): **${heapUsedMb} MB**\n\n` +
      `**Spesifikasi Lingkungan**\n` +
      `> • Node.js Runtime: **${process.version}**\n` +
      `> • Library: **Discord.js v14.18.0**\n` +
      `> • Arsitektur Host: **${process.platform} (${process.arch})**\n`
    )
    .setFooter({ text: 'Pembaruan Real-Time Otomatis • FlyBot Official' })
    .setTimestamp();

  // Tombol Aksi Cepat Dashboard
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_monitor_refresh')
      .setLabel('🔄 Refresh Sekarang')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_monitor_toggle_maint')
      .setLabel('🛠️ Mode Maintenance')
      .setStyle(ButtonStyle.Secondary)
  );

  if (data.dashboardMessageId) {
    try {
      const existingMsg = await channels.dashboardChannel.messages.fetch(data.dashboardMessageId).catch(() => null);
      if (existingMsg) {
        await existingMsg.edit({ embeds: [dashboardEmbed], components: [actionRow] });
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
    const newMsg = await channels.dashboardChannel.send({ embeds: [dashboardEmbed], components: [actionRow] });
    data.dashboardMessageId = newMsg.id;
    data.lastUpdated = new Date().toISOString();
    saveMonitorData(data);
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim pesan dashboard baru:', err.message);
  }
}

// Memperbarui Direktori Server Real-Time di Channel daftar-server
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

// Helper: Mendapatkan rincian commit terbaru dari Git lokal atau GitHub API
async function getLatestCommitDetails() {
  // 1. Coba dari git lokal
  try {
    const gitLog = execSync('git log -1 --pretty=format:"%H|%h|%an|%s|%cd"', {
      cwd: path.join(__dirname),
      timeout: 3000,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (gitLog) {
      const [fullHash, shortHash, author, subject, date] = gitLog.split('|');
      return {
        fullHash,
        shortHash: shortHash || fullHash.substring(0, 7),
        author: author || 'Developer',
        message: subject || 'Update pembaruan FlyBot',
        date: date || new Date().toLocaleString('id-ID'),
      };
    }
  } catch {}

  // 2. Cek file .current_commit
  const commitFile = path.join(__dirname, '.current_commit');
  let fileSha = null;
  if (fs.existsSync(commitFile)) {
    try {
      fileSha = fs.readFileSync(commitFile, 'utf8').trim();
    } catch {}
  }

  // 3. Cek GitHub API
  try {
    const https = require('https');
    const commitDataRaw = await new Promise((resolve, reject) => {
      https.get('https://api.github.com/repos/Raflyrap/botdiscord/commits/main', {
        headers: { 'User-Agent': 'Node-Commit-Checker' },
        timeout: 4000,
      }, (res) => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
    const parsed = JSON.parse(commitDataRaw.toString());
    return {
      fullHash: parsed.sha,
      shortHash: parsed.sha.substring(0, 7),
      author: parsed.commit?.author?.name || 'Raflyrap',
      message: parsed.commit?.message || 'Update pembaruan FlyBot',
      date: parsed.commit?.author?.date || new Date().toLocaleString('id-ID'),
    };
  } catch {}

  if (fileSha) {
    return {
      fullHash: fileSha,
      shortHash: fileSha.substring(0, 7),
      author: 'Raflyrap',
      message: 'Pembaruan sistem FlyBot via repository GitHub',
      date: new Date().toLocaleString('id-ID'),
    };
  }

  return null;
}

// Mengirim Embed Log Rincian Pembaruan ke Channel update-logs
async function sendUpdateLog(client, logData) {
  try {
    const channels = await ensureMonitoringChannels(client);
    if (!channels?.updateLogsChannel) {
      console.warn('[BOT MONITOR] Channel update-logs tidak ditemukan untuk mengirim log update.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0x00D26A) // Emerald Green
      .setAuthor({
        name: 'FlyBot System • Auto Update & Deploy Tracker',
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTitle(logData.title || 'Pembaruan Sistem FlyBot Berhasil Diterapkan')
      .setDescription(logData.description || 'Kode bot telah diperbarui ke commit terbaru dan seluruh layanan aktif optimal.')
      .addFields(
        { name: 'Commit SHA', value: `\`${logData.commitSha || 'Unknown'}\``, inline: true },
        { name: 'Pengembang', value: `\`${logData.author || 'Raflyrap'}\``, inline: true },
        { name: 'Waktu Deploy', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      );

    if (logData.commitMessage) {
      embed.addFields({
        name: 'Catatan Pembaruan (Changelog)',
        value: `\`\`\`git\n${logData.commitMessage.substring(0, 1000)}\n\`\`\``,
        inline: false,
      });
    }

    embed.addFields({
      name: 'Status Jaringan Saat Ini',
      value: `> Server Aktif: **${client.guilds.cache.size} Server**\n> Uptime Host: **${formatUptime(process.uptime())}**`,
      inline: false,
    });

    embed
      .setFooter({ text: 'FlyBot Continuous Deployment Tracker • Official' })
      .setTimestamp();

    await channels.updateLogsChannel.send({ embeds: [embed] });
    console.log('[BOT MONITOR] Berhasil memposting update log ke channel update-logs.');
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim update log:', err);
  }
}

// Cek dan laporkan jika commit saat ini baru
async function checkAndPostUpdateLog(client) {
  try {
    const data = loadMonitorData();
    const commitDetails = await getLatestCommitDetails();
    if (!commitDetails || !commitDetails.fullHash) return;

    // Jika commit belum pernah dilaporkan
    if (data.lastReportedCommit !== commitDetails.fullHash) {
      console.log(`[BOT MONITOR] Mendeteksi commit baru (${commitDetails.shortHash}). Mengirim update log ke server official...`);
      await sendUpdateLog(client, {
        commitSha: commitDetails.shortHash,
        author: commitDetails.author,
        commitMessage: commitDetails.message,
      });
      data.lastReportedCommit = commitDetails.fullHash;
      saveMonitorData(data);
    }
  } catch (err) {
    console.error('[BOT MONITOR] Error pada checkAndPostUpdateLog:', err);
  }
}

// Mengirim notifikasi otomatis setiap kali bot selesai booting/restart di Pterodactyl
async function sendRestartNotification(client) {
  try {
    const channels = await ensureMonitoringChannels(client);
    let targetChannel = channels?.updateLogsChannel;
    if (!targetChannel) {
      targetChannel =
        client.channels.cache.get(DEFAULT_LOG_CHANNEL_ID) ||
        (await client.channels.fetch(DEFAULT_LOG_CHANNEL_ID).catch(() => null));
    }
    if (!targetChannel) return;

    const commitDetails = await getLatestCommitDetails().catch(() => null);
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
    const wsPing = Math.round(client.ws.ping || 0);

    const embed = new EmbedBuilder()
      .setColor(0x57F287) // Hijau Online
      .setAuthor({
        name: 'FlyBot System • Status Restart & Booting',
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTitle('FlyBot Berhasil Online & Siap Melayani')
      .setDescription(
        `Bot telah selesai di-restart di Pterodactyl dan seluruh modul sistem berhasil dimuat.\n\n` +
        `**Status Layanan:**\n` +
        `> • Status: **Online (Optimal)**\n` +
        `> • Server Aktif: **${totalServers} Server**\n` +
        `> • Total Pengguna: **${totalMembers.toLocaleString('id-ID')} Anggota**\n` +
        `> • Latensi Gateway: **${wsPing} ms**\n` +
        `> • Commit Terakhir: \`${commitDetails?.shortHash || 'Production'}\` — *${commitDetails?.message?.slice(0, 50) || 'Versi Terbaru'}*\n` +
        `> • Waktu Boot: <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
      )
      .setFooter({ text: 'FlyBot Monitoring System • Pterodactyl Host' })
      .setTimestamp();

    await targetChannel.send({ embeds: [embed] });
    console.log(`[BOT MONITOR] Berhasil mengirim notifikasi online/restart ke #${targetChannel.name || targetChannel.id}`);
  } catch (err) {
    console.error('[BOT MONITOR] Gagal mengirim notifikasi restart:', err.message);
  }
}

// Inisialisasi Monitoring saat bot pertama kali siap (ClientReady)
function initBotMonitoring(client) {
  console.log(`[BOT MONITOR] Memulai inisialisasi monitoring privat di Official Server (${getOfficialGuildId()})...`);

  // Jalankan setup channel, dashboard, dan update log pertama
  setTimeout(async () => {
    try {
      await ensureMonitoringChannels(client);
      await updateLiveDashboard(client);
      await updateServerListDashboard(client);
      await sendRestartNotification(client);
      await checkAndPostUpdateLog(client);
      console.log('[BOT MONITOR] Semua channel privat monitoring, update logs, dan live dashboard siap!');
    } catch (err) {
      console.error('[BOT MONITOR] Error inisialisasi awal:', err.message);
    }
  }, 4000);

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
  getOfficialInviteUrl,
  getOfficialWebsiteUrl,
  ensureMonitoringChannels,
  handleGuildCreate,
  handleGuildDelete,
  updateLiveDashboard,
  updateServerListDashboard,
  initBotMonitoring,
  recordCommandExecution,
  formatUptime,
  sendUpdateLog,
  checkAndPostUpdateLog,
  sendErrorLog,
};
