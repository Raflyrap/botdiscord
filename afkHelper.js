const fs = require('fs');
const path = require('path');

const AFK_FILE = path.join(__dirname, 'afkData.json');
let afkData = {};

function loadAfkData() {
  try {
    if (fs.existsSync(AFK_FILE)) {
      const raw = fs.readFileSync(AFK_FILE, 'utf-8');
      afkData = JSON.parse(raw);
    } else {
      afkData = {};
      saveAfkData();
    }
  } catch (err) {
    console.error('Error saat membaca afkData.json:', err);
    afkData = {};
  }
}

function saveAfkData() {
  try {
    fs.writeFileSync(AFK_FILE, JSON.stringify(afkData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat menyimpan afkData.json:', err);
  }
}

// Inisialisasi awal
loadAfkData();

/**
 * Set status AFK untuk user di suatu server
 */
function setAfk(guildId, userId, reason = 'AFK') {
  if (!afkData[guildId]) afkData[guildId] = {};
  afkData[guildId][userId] = {
    reason: reason || 'AFK',
    timestamp: Date.now()
  };
  saveAfkData();
}

/**
 * Ambil status AFK user
 */
function getAfk(guildId, userId) {
  if (afkData[guildId] && afkData[guildId][userId]) {
    return afkData[guildId][userId];
  }
  return null;
}

/**
 * Hapus status AFK user
 */
function removeAfk(guildId, userId) {
  if (afkData[guildId] && afkData[guildId][userId]) {
    const data = afkData[guildId][userId];
    delete afkData[guildId][userId];
    saveAfkData();
    return data;
  }
  return null;
}

module.exports = {
  setAfk,
  getAfk,
  removeAfk
};
