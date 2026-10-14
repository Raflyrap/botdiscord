const fs = require('fs');
const path = require('path');

const PATROLI_FILE = path.join(__dirname, 'patroliConfig.json');
let patroliConfig = {};

const DEFAULT_PATROLI_SONG = 'https://soundcloud.com/altaremusic/byermx1';
const FALLBACK_PATROLI_QUERY = 'Ariana Grande bye Altare Remix';

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
  if (patroliConfig[guildId]) {
    delete patroliConfig[guildId];
    savePatroliConfig();
    return true;
  }
  return false;
}

module.exports = {
  DEFAULT_PATROLI_SONG,
  FALLBACK_PATROLI_QUERY,
  isPatroliActive,
  getPatroliConfig,
  setPatroliActive,
  removePatroliActive,
};
