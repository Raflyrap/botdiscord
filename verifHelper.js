const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'verifConfig.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saat menyimpan verifConfig.json:', error);
  }
}

function getVerifConfig(guildId) {
  const data = loadConfig();
  return data[guildId] || {};
}

function setVerifConfig(guildId, updates) {
  const data = loadConfig();
  data[guildId] = { ...(data[guildId] || {}), ...updates };
  saveConfig(data);
  return data[guildId];
}

module.exports = {
  getVerifConfig,
  setVerifConfig,
};
