const fs = require('fs');
const path = require('path');

const PATROLI_FILE = path.join(__dirname, 'patroliConfig.json');
let patroliConfig = {};

const DEFAULT_PATROLI_SONG = 'Ariana Grande - bye (Altare Remix)';

function loadPatroliConfig() {
  try {
    if (fs.existsSync(PATROLI_FILE)) {
      patroliConfig = JSON.parse(fs.readFileSync(PATROLI_FILE, 'utf-8') || '{}');
    } else {
      patroliConfig = {};
    }
  } catch (err) {
    console.error('Error saat loadPatroliConfig:', err);
    patroliConfig = {};
  }
}

function savePatroliConfig() {
  try {
    fs.writeFileSync(PATROLI_FILE, JSON.stringify(patroliConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat savePatroliConfig:', err);
  }
}

loadPatroliConfig();

function isPatroliActive(guildId) {
  return !!patroliConfig[guildId];
}

function getPatroliConfig(guildId) {
  return patroliConfig[guildId] || null;
}

function setPatroliActive(guildId, voiceChannelId, textChannelId, songUrl = DEFAULT_PATROLI_SONG) {
  resetPatroliRuntime(guildId);
  patroliConfig[guildId] = {
    voiceChannelId,
    textChannelId,
    songUrl,
    startedAt: Date.now(),
  };
  savePatroliConfig();
  return patroliConfig[guildId];
}

function removePatroliActive(guildId) {
  resetPatroliRuntime(guildId);
  if (patroliConfig[guildId]) {
    delete patroliConfig[guildId];
    savePatroliConfig();
    return true;
  }
  return false;
}

// State runtime (tidak disimpan ke file): anti-spam & deteksi stream yang langsung mati
const patroliRuntime = new Map();

function getPatroliRuntime(guildId) {
  if (!patroliRuntime.has(guildId)) {
    patroliRuntime.set(guildId, { announced: false, starts: [], debug: [] });
  }
  return patroliRuntime.get(guildId);
}

function resetPatroliRuntime(guildId) {
  patroliRuntime.delete(guildId);
}

module.exports = {
  DEFAULT_PATROLI_SONG,
  isPatroliActive,
  getPatroliConfig,
  setPatroliActive,
  removePatroliActive,
  getPatroliRuntime,
  resetPatroliRuntime,
};
