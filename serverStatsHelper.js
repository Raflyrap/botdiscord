const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const configPath = path.join(__dirname, 'serverStatsConfig.json');

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error membaca serverStatsConfig.json:', error);
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan serverStatsConfig.json:', error);
  }
}

function getStatsConfig(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

function setStatsConfig(guildId, data) {
  const config = loadConfig();
  config[guildId] = { ...(config[guildId] || {}), ...data };
  saveConfig(config);
  return config[guildId];
}

// Menghitung statistik server
async function calculateStats(guild) {
  const totalMembers = guild.memberCount;

  // Hitung admin (member non-bot yang memiliki izin Administrator)
  let totalAdmins = 0;
  try {
    const members = await guild.members.fetch().catch(() => guild.members.cache);
    totalAdmins = members.filter(
      (m) => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator)
    ).size;
  } catch (err) {
    totalAdmins = guild.members.cache.filter(
      (m) => !m.user.bot && m.permissions.has(PermissionFlagsBits.Administrator)
    ).size;
  }

  // Hitung seluruh channel aktif (Text & Voice, tidak termasuk Kategori)
  const totalActiveChannels = guild.channels.cache.filter(
    (c) => c.type !== ChannelType.GuildCategory
  ).size;

  return { totalMembers, totalAdmins, totalActiveChannels };
}

// Memperbarui nama channel statistik di server
async function updateServerStats(guild) {
  const cfg = getStatsConfig(guild.id);
  if (!cfg || !cfg.enabled) return;

  try {
    const { totalMembers, totalAdmins, totalActiveChannels } = await calculateStats(guild);

    if (cfg.memberChannelId) {
      const ch = guild.channels.cache.get(cfg.memberChannelId) || await guild.channels.fetch(cfg.memberChannelId).catch(() => null);
      if (ch) {
        const expectedName = `👥・Total Member: ${totalMembers}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }

    if (cfg.adminChannelId) {
      const ch = guild.channels.cache.get(cfg.adminChannelId) || await guild.channels.fetch(cfg.adminChannelId).catch(() => null);
      if (ch) {
        const expectedName = `👑・Total Admin: ${totalAdmins}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }

    if (cfg.activeChannelId) {
      const ch = guild.channels.cache.get(cfg.activeChannelId) || await guild.channels.fetch(cfg.activeChannelId).catch(() => null);
      if (ch) {
        const expectedName = `💬・Channel Aktif: ${totalActiveChannels}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(() => {});
        }
      }
    }
  } catch (error) {
    console.error(`Error saat memperbarui statistik ${guild.name}:`, error);
  }
}

// Mengaktifkan dan membuat channel statistik otomatis
async function enableServerStats(guild) {
  const cfg = getStatsConfig(guild.id) || {};
  const { totalMembers, totalAdmins, totalActiveChannels } = await calculateStats(guild);

  // 1. Cari atau buat Kategori
  let category = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && (c.name.includes('STATISTIK') || c.name.includes('STATS'))
    );
  }

  const categoryOverwrites = [
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel],
      deny: [PermissionFlagsBits.Connect],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (!category) {
    category = await guild.channels.create({
      name: '📊 STATISTIK SERVER',
      type: ChannelType.GuildCategory,
      position: 0,
      permissionOverwrites: categoryOverwrites,
      reason: 'Auto-setup Kategori Server Stats',
    });
  } else {
    await category.setPosition(0).catch(() => {});
  }

  // 2. Buat atau update Channel Member
  let memberChannel = cfg.memberChannelId ? guild.channels.cache.get(cfg.memberChannelId) : null;
  const memberName = `👥・Total Member: ${totalMembers}`;
  if (!memberChannel) {
    memberChannel = await guild.channels.create({
      name: memberName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: categoryOverwrites,
      reason: 'Server stats - Member Counter',
    });
  } else {
    if (memberChannel.name !== memberName) await memberChannel.setName(memberName).catch(() => {});
    if (memberChannel.parentId !== category.id) await memberChannel.setParent(category.id).catch(() => {});
  }

  // 3. Buat atau update Channel Admin
  let adminChannel = cfg.adminChannelId ? guild.channels.cache.get(cfg.adminChannelId) : null;
  const adminName = `👑・Total Admin: ${totalAdmins}`;
  if (!adminChannel) {
    adminChannel = await guild.channels.create({
      name: adminName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: categoryOverwrites,
      reason: 'Server stats - Admin Counter',
    });
  } else {
    if (adminChannel.name !== adminName) await adminChannel.setName(adminName).catch(() => {});
    if (adminChannel.parentId !== category.id) await adminChannel.setParent(category.id).catch(() => {});
  }

  // 4. Buat atau update Channel Aktif
  let activeChannel = cfg.activeChannelId ? guild.channels.cache.get(cfg.activeChannelId) : null;
  const activeName = `💬・Channel Aktif: ${totalActiveChannels}`;
  if (!activeChannel) {
    activeChannel = await guild.channels.create({
      name: activeName,
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: categoryOverwrites,
      reason: 'Server stats - Channel Counter',
    });
  } else {
    if (activeChannel.name !== activeName) await activeChannel.setName(activeName).catch(() => {});
    if (activeChannel.parentId !== category.id) await activeChannel.setParent(category.id).catch(() => {});
  }

  // 5. Simpan konfigurasi
  setStatsConfig(guild.id, {
    categoryId: category.id,
    memberChannelId: memberChannel.id,
    adminChannelId: adminChannel.id,
    activeChannelId: activeChannel.id,
    enabled: true,
  });

  return {
    category,
    memberChannel,
    adminChannel,
    activeChannel,
    stats: { totalMembers, totalAdmins, totalActiveChannels },
  };
}

// Menonaktifkan dan menghapus channel statistik
async function disableServerStats(guild) {
  const cfg = getStatsConfig(guild.id);
  if (!cfg) return false;

  const channelIds = [cfg.memberChannelId, cfg.adminChannelId, cfg.activeChannelId];
  for (const id of channelIds) {
    if (id) {
      const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
      if (ch) {
        await ch.delete('Server stats dinonaktifkan').catch(() => {});
      }
    }
  }

  if (cfg.categoryId) {
    const cat = guild.channels.cache.get(cfg.categoryId) || await guild.channels.fetch(cfg.categoryId).catch(() => null);
    if (cat) {
      await cat.delete('Server stats category dinonaktifkan').catch(() => {});
    }
  }

  setStatsConfig(guild.id, {
    categoryId: null,
    memberChannelId: null,
    adminChannelId: null,
    activeChannelId: null,
    enabled: false,
  });

  return true;
}

module.exports = {
  getStatsConfig,
  setStatsConfig,
  calculateStats,
  updateServerStats,
  enableServerStats,
  disableServerStats,
};
