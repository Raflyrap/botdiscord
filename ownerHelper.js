const fs = require('fs');
const path = require('path');
const { ActivityType } = require('discord.js');

const MAINTENANCE_FILE = path.join(__dirname, 'maintenanceConfig.json');
const PRESENCE_FILE = path.join(__dirname, 'botPresenceConfig.json');
const DEFAULT_OFFICIAL_INVITE_URL = 'https://discord.com/invite/flybot';
const DEFAULT_OFFICIAL_WEBSITE_URL = 'https://flyneuroai.com/';

function getOfficialInviteUrl() {
  return process.env.OFFICIAL_INVITE_URL || DEFAULT_OFFICIAL_INVITE_URL;
}

function getOfficialWebsiteUrl() {
  return process.env.OFFICIAL_WEBSITE_URL || DEFAULT_OFFICIAL_WEBSITE_URL;
}

// Cek apakah user adalah Owner Bot
async function isBotOwner(userOrInteraction, clientInstance = null) {
  try {
    const user = userOrInteraction.user || userOrInteraction;
    const client = clientInstance || userOrInteraction.client;
    const userId = user?.id;

    if (!userId) return false;

    // 1. Cek OWNER_ID di .env
    const envOwnerId = process.env.OWNER_ID?.trim();
    if (envOwnerId && userId === envOwnerId) return true;

    // 2. Cek Hardcoded ID pemilik utama
    if (userId === '701497444806033441') return true;

    // 3. Cek Application Owner dari Discord API
    if (client) {
      if (!client.application?.owner) {
        await client.application?.fetch().catch(() => null);
      }
      const appOwner = client.application?.owner;
      if (appOwner) {
        if (appOwner.id && userId === appOwner.id) return true;
        if (appOwner.members && appOwner.members.has(userId)) return true;
      }

      // 4. Cek Owner dari Server Official FlyBot
      const officialGuildId = process.env.OFFICIAL_GUILD_ID || '1563902604394627074';
      const officialGuild = client.guilds.cache.get(officialGuildId);
      if (officialGuild && officialGuild.ownerId === userId) return true;
    }
  } catch (err) {
    console.error('[OWNER HELPER] Error checking bot owner:', err);
  }
  return false;
}

// Konfigurasi Maintenance
function getMaintenanceConfig() {
  try {
    if (!fs.existsSync(MAINTENANCE_FILE)) {
      const defaultData = {
        enabled: false,
        reason: 'FlyBot sedang dalam pemeliharaan rutin oleh Developer.',
        updatedAt: null,
        updatedBy: null,
      };
      fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
  } catch (err) {
    console.error('[OWNER HELPER] Error reading maintenanceConfig.json:', err);
    return {
      enabled: false,
      reason: 'FlyBot sedang dalam pemeliharaan rutin oleh Developer.',
      updatedAt: null,
      updatedBy: null,
    };
  }
}

function setMaintenanceConfig(config) {
  try {
    fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('[OWNER HELPER] Error writing maintenanceConfig.json:', err);
    return false;
  }
}

// Konfigurasi Presence / Status Bot
function getPresenceConfig() {
  try {
    if (!fs.existsSync(PRESENCE_FILE)) {
      const defaultData = {
        type: 'Playing',
        status: 'online',
        text: '/help | FlyBot Multi-Purpose',
        url: null,
      };
      fs.writeFileSync(PRESENCE_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    return JSON.parse(fs.readFileSync(PRESENCE_FILE, 'utf8'));
  } catch (err) {
    console.error('[OWNER HELPER] Error reading botPresenceConfig.json:', err);
    return {
      type: 'Playing',
      status: 'online',
      text: '/help | FlyBot Multi-Purpose',
      url: null,
    };
  }
}

function setPresenceConfig(config) {
  try {
    fs.writeFileSync(PRESENCE_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (err) {
    console.error('[OWNER HELPER] Error writing botPresenceConfig.json:', err);
    return false;
  }
}

// Terapkan Presence ke Discord Client
function applyBotPresence(client) {
  try {
    if (!client?.user) return;
    const cfg = getPresenceConfig();

    let activityType = ActivityType.Playing;
    const typeUpper = (cfg.type || 'Playing').toUpperCase();
    if (typeUpper === 'WATCHING') activityType = ActivityType.Watching;
    else if (typeUpper === 'LISTENING') activityType = ActivityType.Listening;
    else if (typeUpper === 'COMPETING') activityType = ActivityType.Competing;
    else if (typeUpper === 'STREAMING') activityType = ActivityType.Streaming;
    else if (typeUpper === 'CUSTOM') activityType = ActivityType.Custom;

    const activityOptions = {
      name: cfg.text || 'FlyBot',
      type: activityType,
    };
    if (activityType === ActivityType.Streaming && cfg.url) {
      activityOptions.url = cfg.url;
    }

    client.user.setPresence({
      status: cfg.status || 'online',
      activities: [activityOptions],
    });

    console.log(`[BOT PRESENCE] Status aktif: [${cfg.status || 'online'}] ${cfg.type} "${cfg.text}"`);
  } catch (err) {
    console.error('[BOT PRESENCE] Gagal menerapkan presence:', err);
  }
}

module.exports = {
  isBotOwner,
  getMaintenanceConfig,
  setMaintenanceConfig,
  getPresenceConfig,
  setPresenceConfig,
  applyBotPresence,
  getOfficialInviteUrl,
  getOfficialWebsiteUrl,
};
