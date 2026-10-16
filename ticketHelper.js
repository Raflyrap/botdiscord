const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'ticketConfig.json');
const DATA_PATH = path.join(__dirname, 'ticketData.json');

function loadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    return JSON.parse(fs.readFileSync(filePath, 'utf-8') || '{}');
  } catch {
    return {};
  }
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`Error saat menyimpan ${filePath}:`, err.message);
  }
}

function getGuildTicketConfig(guildId) {
  const configs = loadJSON(CONFIG_PATH);
  return configs[guildId] || {};
}

function setGuildTicketConfig(guildId, updates) {
  const configs = loadJSON(CONFIG_PATH);
  configs[guildId] = { ...(configs[guildId] || {}), ...updates };
  saveJSON(CONFIG_PATH, configs);
  return configs[guildId];
}

function getActiveTicket(guildId, userId) {
  const data = loadJSON(DATA_PATH);
  for (const channelId of Object.keys(data)) {
    const t = data[channelId];
    if (t.guildId === guildId && t.userId === userId && !t.closed) {
      return { channelId, ...t };
    }
  }
  return null;
}

function registerTicket(guildId, channelId, userId) {
  const data = loadJSON(DATA_PATH);
  data[channelId] = {
    guildId,
    userId,
    createdAt: Date.now(),
    closed: false,
  };
  saveJSON(DATA_PATH, data);
}

function closeTicket(channelId) {
  const data = loadJSON(DATA_PATH);
  if (data[channelId]) {
    delete data[channelId];
    saveJSON(DATA_PATH, data);
    return true;
  }
  return false;
}

function getNextTicketNumber(guildId) {
  const cfg = getGuildTicketConfig(guildId);
  const nextNum = (cfg.ticketCounter || 0) + 1;
  setGuildTicketConfig(guildId, { ticketCounter: nextNum });
  return String(nextNum).padStart(4, '0');
}

module.exports = {
  getGuildTicketConfig,
  setGuildTicketConfig,
  getActiveTicket,
  registerTicket,
  closeTicket,
  getNextTicketNumber,
};
