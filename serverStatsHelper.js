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
  if (!cfg) return;

  try {
    const { totalMembers, totalAdmins, totalActiveChannels } = await calculateStats(guild);

    if (cfg.memberChannelId) {
      const ch = guild.channels.cache.get(cfg.memberChannelId) || await guild.channels.fetch(cfg.memberChannelId).catch(() => null);
      if (ch) {
        const expectedName = `👥・Total Member: ${totalMembers}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(console.error);
        }
      }
    }

    if (cfg.adminChannelId) {
      const ch = guild.channels.cache.get(cfg.adminChannelId) || await guild.channels.fetch(cfg.adminChannelId).catch(() => null);
      if (ch) {
        const expectedName = `👑・Total Admin: ${totalAdmins}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(console.error);
        }
      }
    }

    if (cfg.activeChannelId) {
      const ch = guild.channels.cache.get(cfg.activeChannelId) || await guild.channels.fetch(cfg.activeChannelId).catch(() => null);
      if (ch) {
        const expectedName = `💬・Channel Aktif: ${totalActiveChannels}`;
        if (ch.name !== expectedName) {
          await ch.setName(expectedName).catch(console.error);
        }
      }
    }

    console.log(`[STATS] Statistik diupdate untuk ${guild.name}: Member: ${totalMembers}, Admin: ${totalAdmins}, Channel: ${totalActiveChannels}`);
  } catch (error) {
    console.error(`Error saat memperbarui statistik ${guild.name}:`, error);
  }
}

module.exports = {
  getStatsConfig,
  setStatsConfig,
  calculateStats,
  updateServerStats,
};
