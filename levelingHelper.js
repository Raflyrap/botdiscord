const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'levelingData.json');

// Cooldown map (guild:user -> timestamp terakhir dapat XP)
const cooldowns = new Map();
const COOLDOWN_MS = 60 * 1000; // 60 detik cooldown
const XP_MIN = 15;
const XP_MAX = 25;

// ==========================================
// DATA MANAGEMENT
// ==========================================
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function getUserData(guildId, userId) {
  const data = loadData();
  if (!data[guildId]) data[guildId] = {};
  if (!data[guildId][userId]) {
    data[guildId][userId] = {
      xp: 0,
      level: 0,
      totalMessages: 0,
      achievements: [],
      lastActive: null,
    };
  }
  return data[guildId][userId];
}

function setUserData(guildId, userId, userData) {
  const data = loadData();
  if (!data[guildId]) data[guildId] = {};
  data[guildId][userId] = userData;
  saveData(data);
}

// ==========================================
// LEVEL FORMULA
// ==========================================
// XP yang dibutuhkan untuk naik ke level tertentu
// Level 1 = 100, Level 2 = 400, Level 3 = 900, Level 10 = 10000, dst
function xpForLevel(level) {
  return level * level * 100;
}

// Total XP kumulatif yang dibutuhkan untuk mencapai level tertentu
function totalXpForLevel(level) {
  let total = 0;
  for (let i = 1; i <= level; i++) {
    total += xpForLevel(i);
  }
  return total;
}

// Hitung level dari total XP
function calculateLevel(totalXp) {
  let level = 0;
  let xpNeeded = 0;
  while (true) {
    const nextLevelXp = xpForLevel(level + 1);
    if (totalXp < xpNeeded + nextLevelXp) break;
    xpNeeded += nextLevelXp;
    level++;
  }
  return level;
}

// XP yang sudah dikumpulkan di level saat ini
function currentLevelXp(totalXp, level) {
  let xpUsed = 0;
  for (let i = 1; i <= level; i++) {
    xpUsed += xpForLevel(i);
  }
  return totalXp - xpUsed;
}

// ==========================================
// DAFTAR ACHIEVEMENT
// ==========================================
const ACHIEVEMENTS = [
  // Achievement berdasarkan Level
  { id: 'level_1',   emoji: '🌱', name: 'Pemula',         desc: 'Mencapai Level 1',         check: (u) => u.level >= 1 },
  { id: 'level_5',   emoji: '💬', name: 'Aktif Banget',   desc: 'Mencapai Level 5',         check: (u) => u.level >= 5 },
  { id: 'level_10',  emoji: '🔥', name: 'On Fire',        desc: 'Mencapai Level 10',        check: (u) => u.level >= 10 },
  { id: 'level_15',  emoji: '⚡', name: 'Supercharged',   desc: 'Mencapai Level 15',        check: (u) => u.level >= 15 },
  { id: 'level_20',  emoji: '⭐', name: 'Bintang Server', desc: 'Mencapai Level 20',        check: (u) => u.level >= 20 },
  { id: 'level_30',  emoji: '👑', name: 'Legend',          desc: 'Mencapai Level 30',        check: (u) => u.level >= 30 },
  { id: 'level_50',  emoji: '💎', name: 'Diamond',         desc: 'Mencapai Level 50',        check: (u) => u.level >= 50 },
  { id: 'level_100', emoji: '🏆', name: 'Grandmaster',     desc: 'Mencapai Level 100',       check: (u) => u.level >= 100 },

  // Achievement berdasarkan Total Pesan
  { id: 'msg_100',   emoji: '📝', name: 'Rajin Ngobrol',  desc: 'Kirim 100 pesan',          check: (u) => u.totalMessages >= 100 },
  { id: 'msg_500',   emoji: '🎯', name: 'Konsisten',      desc: 'Kirim 500 pesan',          check: (u) => u.totalMessages >= 500 },
  { id: 'msg_1000',  emoji: '💪', name: 'Chat Warrior',   desc: 'Kirim 1.000 pesan',        check: (u) => u.totalMessages >= 1000 },
  { id: 'msg_5000',  emoji: '🗣️', name: 'Tukang Ngobrol', desc: 'Kirim 5.000 pesan',        check: (u) => u.totalMessages >= 5000 },
  { id: 'msg_10000', emoji: '📖', name: 'Novelist',       desc: 'Kirim 10.000 pesan',       check: (u) => u.totalMessages >= 10000 },

  // Achievement berdasarkan XP
  { id: 'xp_1000',   emoji: '✨', name: 'XP Hunter',      desc: 'Kumpulkan 1.000 XP',       check: (u) => u.xp >= 1000 },
  { id: 'xp_10000',  emoji: '🌟', name: 'XP Maniac',      desc: 'Kumpulkan 10.000 XP',      check: (u) => u.xp >= 10000 },
  { id: 'xp_50000',  emoji: '💫', name: 'XP Overlord',    desc: 'Kumpulkan 50.000 XP',      check: (u) => u.xp >= 50000 },
  { id: 'xp_100000', emoji: '🔮', name: 'XP Transcendent',desc: 'Kumpulkan 100.000 XP',     check: (u) => u.xp >= 100000 },
];

// Cek dan unlock achievement baru
function checkAchievements(userData) {
  const newlyUnlocked = [];
  for (const ach of ACHIEVEMENTS) {
    if (!userData.achievements.includes(ach.id) && ach.check(userData)) {
      userData.achievements.push(ach.id);
      newlyUnlocked.push(ach);
    }
  }
  return newlyUnlocked;
}

// Ambil detail achievement berdasarkan ID
function getAchievementById(id) {
  return ACHIEVEMENTS.find((a) => a.id === id) || null;
}

// ==========================================
// XP PROCESSING (dipanggil saat ada pesan)
// ==========================================
function processMessage(guildId, userId) {
  const key = `${guildId}:${userId}`;
  const now = Date.now();

  // Cek cooldown
  const lastTime = cooldowns.get(key) || 0;
  const onCooldown = (now - lastTime) < COOLDOWN_MS;

  // Load user data
  const userData = getUserData(guildId, userId);
  userData.totalMessages += 1;
  userData.lastActive = new Date().toISOString();

  let leveledUp = false;
  let oldLevel = userData.level;
  let xpGained = 0;

  // Hanya beri XP jika tidak sedang cooldown
  if (!onCooldown) {
    xpGained = Math.floor(Math.random() * (XP_MAX - XP_MIN + 1)) + XP_MIN;
    userData.xp += xpGained;
    cooldowns.set(key, now);

    // Hitung level baru
    const newLevel = calculateLevel(userData.xp);
    if (newLevel > userData.level) {
      leveledUp = true;
      oldLevel = userData.level;
      userData.level = newLevel;
    }
  }

  // Cek achievement baru
  const newAchievements = checkAchievements(userData);

  // Simpan
  setUserData(guildId, userId, userData);

  return {
    userData,
    xpGained,
    leveledUp,
    oldLevel,
    newLevel: userData.level,
    newAchievements,
  };
}

// ==========================================
// LEADERBOARD
// ==========================================
function getLeaderboard(guildId, limit = 10) {
  const data = loadData();
  const guildData = data[guildId] || {};

  const sorted = Object.entries(guildData)
    .map(([userId, u]) => ({ userId, ...u }))
    .sort((a, b) => b.xp - a.xp)
    .slice(0, limit);

  return sorted;
}

// Ambil rank user di server
function getUserRank(guildId, userId) {
  const data = loadData();
  const guildData = data[guildId] || {};

  const sorted = Object.entries(guildData)
    .map(([uid, u]) => ({ userId: uid, xp: u.xp }))
    .sort((a, b) => b.xp - a.xp);

  const index = sorted.findIndex((u) => u.userId === userId);
  return index === -1 ? sorted.length + 1 : index + 1;
}

// ==========================================
// PROGRESS BAR VISUAL
// ==========================================
function createProgressBar(current, max, length = 14) {
  const filled = Math.round((current / max) * length);
  const empty = length - filled;
  const filledChar = '█';
  const emptyChar = '░';
  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

// ==========================================
// RANK TITLE berdasarkan level
// ==========================================
function getRankTitle(level) {
  if (level >= 100) return '🏆 Grandmaster';
  if (level >= 50) return '💎 Diamond';
  if (level >= 30) return '👑 Legend';
  if (level >= 20) return '⭐ Star';
  if (level >= 15) return '⚡ Elite';
  if (level >= 10) return '🔥 Veteran';
  if (level >= 5) return '💬 Active';
  if (level >= 1) return '🌱 Newbie';
  return '🥚 Unranked';
}

module.exports = {
  processMessage,
  getUserData,
  getLeaderboard,
  getUserRank,
  xpForLevel,
  currentLevelXp,
  createProgressBar,
  getRankTitle,
  checkAchievements,
  getAchievementById,
  ACHIEVEMENTS,
};
