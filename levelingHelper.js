const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'levelingData.json');
const CONFIG_PATH = path.join(__dirname, 'levelingConfig.json');

// ==========================================
// CONFIG CHANNEL NOTIFIKASI (per guild)
// ==========================================
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function getLevelConfig(guildId) {
  return loadConfig()[guildId] || {};
}

function setLevelConfig(guildId, updates) {
  const cfg = loadConfig();
  cfg[guildId] = { ...(cfg[guildId] || {}), ...updates };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
  return cfg[guildId];
}

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
      coins: 0,
      totalMessages: 0,
      gamesWon: 0,
      gamesPlayed: 0,
      dailyLastClaim: null,
      dailyStreak: 0,
      achievements: [],
      lastActive: null,
    };
  } else {
    const u = data[guildId][userId];
    if (u.coins === undefined) u.coins = 0;
    if (u.gamesWon === undefined) u.gamesWon = 0;
    if (u.gamesPlayed === undefined) u.gamesPlayed = 0;
    if (u.dailyLastClaim === undefined) u.dailyLastClaim = null;
    if (u.dailyStreak === undefined) u.dailyStreak = 0;
    if (!u.achievements) u.achievements = [];
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
  { id: 'level_1',   tag: '[LV1]',   name: 'Pemula',         desc: 'Mencapai Level 1',         check: (u) => u.level >= 1 },
  { id: 'level_5',   tag: '[LV5]',   name: 'Aktif Banget',   desc: 'Mencapai Level 5',         check: (u) => u.level >= 5 },
  { id: 'level_10',  tag: '[LV10]',  name: 'On Fire',        desc: 'Mencapai Level 10',        check: (u) => u.level >= 10 },
  { id: 'level_15',  tag: '[LV15]',  name: 'Supercharged',   desc: 'Mencapai Level 15',        check: (u) => u.level >= 15 },
  { id: 'level_20',  tag: '[LV20]',  name: 'Bintang Server', desc: 'Mencapai Level 20',        check: (u) => u.level >= 20 },
  { id: 'level_30',  tag: '[LV30]',  name: 'Legend',          desc: 'Mencapai Level 30',        check: (u) => u.level >= 30 },
  { id: 'level_50',  tag: '[LV50]',  name: 'Diamond',         desc: 'Mencapai Level 50',        check: (u) => u.level >= 50 },
  { id: 'level_100', tag: '[LV100]', name: 'Grandmaster',     desc: 'Mencapai Level 100',       check: (u) => u.level >= 100 },

  // Achievement berdasarkan Total Pesan
  { id: 'msg_100',   tag: '[MSG1]',  name: 'Rajin Ngobrol',  desc: 'Kirim 100 pesan',          check: (u) => u.totalMessages >= 100 },
  { id: 'msg_500',   tag: '[MSG2]',  name: 'Konsisten',      desc: 'Kirim 500 pesan',          check: (u) => u.totalMessages >= 500 },
  { id: 'msg_1000',  tag: '[MSG3]',  name: 'Chat Warrior',   desc: 'Kirim 1.000 pesan',        check: (u) => u.totalMessages >= 1000 },
  { id: 'msg_5000',  tag: '[MSG4]',  name: 'Tukang Ngobrol', desc: 'Kirim 5.000 pesan',        check: (u) => u.totalMessages >= 5000 },
  { id: 'msg_10000', tag: '[MSG5]',  name: 'Novelist',       desc: 'Kirim 10.000 pesan',       check: (u) => u.totalMessages >= 10000 },

  // Achievement berdasarkan XP
  { id: 'xp_1000',   tag: '[XP1]',   name: 'XP Hunter',       desc: 'Kumpulkan 1.000 XP',        check: (u) => u.xp >= 1000 },
  { id: 'xp_10000',  tag: '[XP2]',   name: 'XP Maniac',       desc: 'Kumpulkan 10.000 XP',       check: (u) => u.xp >= 10000 },
  { id: 'xp_50000',  tag: '[XP3]',   name: 'XP Overlord',     desc: 'Kumpulkan 50.000 XP',       check: (u) => u.xp >= 50000 },
  { id: 'xp_100000', tag: '[XP4]',   name: 'XP Transcendent', desc: 'Kumpulkan 100.000 XP',      check: (u) => u.xp >= 100000 },

  // Achievement berdasarkan Koin & Ekonomi
  { id: 'coin_100',   tag: '[COIN1]', name: 'Dompet Pemula',   desc: 'Miliki saldo 100 Koin',        check: (u) => (u.coins || 0) >= 100 },
  { id: 'coin_500',   tag: '[COIN2]', name: 'Mulai Menabung',  desc: 'Miliki saldo 500 Koin',        check: (u) => (u.coins || 0) >= 500 },
  { id: 'coin_1000',  tag: '[COIN3]', name: 'Kaya Raya',       desc: 'Miliki saldo 1.000 Koin',      check: (u) => (u.coins || 0) >= 1000 },
  { id: 'coin_5000',  tag: '[COIN4]', name: 'Sultan Server',   desc: 'Miliki saldo 5.000 Koin',      check: (u) => (u.coins || 0) >= 5000 },

  // Achievement berdasarkan Mini Game
  { id: 'game_win_1',  tag: '[GAME1]', name: 'Gamer Pertama',   desc: 'Menangkan 1 mini game',       check: (u) => (u.gamesWon || 0) >= 1 },
  { id: 'game_win_10', tag: '[GAME2]', name: 'Jawara Game',     desc: 'Menangkan 10 mini game',      check: (u) => (u.gamesWon || 0) >= 10 },
  { id: 'game_win_50', tag: '[GAME3]', name: 'Raja Mini Games', desc: 'Menangkan 50 mini game',      check: (u) => (u.gamesWon || 0) >= 50 },

  // Achievement berdasarkan Daily Streak
  { id: 'daily_3',     tag: '[STRK1]', name: 'Prajurit Harian', desc: 'Klaim harian 3 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 3 },
  { id: 'daily_7',     tag: '[STRK2]', name: 'Disiplin Tinggi', desc: 'Klaim harian 7 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 7 },
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
  if (level >= 100) return 'Grandmaster';
  if (level >= 50) return 'Diamond';
  if (level >= 30) return 'Legend';
  if (level >= 20) return 'Star';
  if (level >= 15) return 'Elite';
  if (level >= 10) return 'Veteran';
  if (level >= 5) return 'Active';
  if (level >= 1) return 'Newbie';
  return 'Unranked';
}

// ==========================================
// REWARD & EKONOMI (KOIN & GAME)
// ==========================================

// Tambahkan reward koin & XP (misal dari menang game atau aktivitas khusus)
function addReward(guildId, userId, { coins = 0, xp = 0, isWin = false }) {
  const userData = getUserData(guildId, userId);
  userData.coins = Math.max(0, (userData.coins || 0) + coins);
  userData.xp = Math.max(0, (userData.xp || 0) + xp);
  userData.gamesPlayed = (userData.gamesPlayed || 0) + 1;
  if (isWin) userData.gamesWon = (userData.gamesWon || 0) + 1;
  userData.lastActive = new Date().toISOString();

  let leveledUp = false;
  let oldLevel = userData.level;
  const newLevel = calculateLevel(userData.xp);
  if (newLevel > userData.level) {
    leveledUp = true;
    oldLevel = userData.level;
    userData.level = newLevel;
  }

  const newAchievements = checkAchievements(userData);
  setUserData(guildId, userId, userData);

  return {
    userData,
    coinsAdded: coins,
    xpAdded: xp,
    leveledUp,
    oldLevel,
    newLevel: userData.level,
    newAchievements,
  };
}

function addCoins(guildId, userId, amount) {
  const userData = getUserData(guildId, userId);
  userData.coins = Math.max(0, (userData.coins || 0) + amount);
  checkAchievements(userData);
  setUserData(guildId, userId, userData);
  return userData.coins;
}

function removeCoins(guildId, userId, amount) {
  const userData = getUserData(guildId, userId);
  if ((userData.coins || 0) < amount) return false;
  userData.coins -= amount;
  setUserData(guildId, userId, userData);
  return true;
}

function transferCoins(guildId, senderId, receiverId, amount) {
  if (amount <= 0) return { success: false, reason: 'INVALID_AMOUNT' };
  const sender = getUserData(guildId, senderId);
  if ((sender.coins || 0) < amount) return { success: false, reason: 'INSUFFICIENT_FUNDS' };

  sender.coins -= amount;
  setUserData(guildId, senderId, sender);

  const receiver = getUserData(guildId, receiverId);
  receiver.coins = (receiver.coins || 0) + amount;
  checkAchievements(receiver);
  setUserData(guildId, receiverId, receiver);

  return {
    success: true,
    senderBalance: sender.coins,
    receiverBalance: receiver.coins,
  };
}

// Klaim Hadiah Harian (/daily)
function claimDaily(guildId, userId) {
  const userData = getUserData(guildId, userId);
  const now = Date.now();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

  if (userData.dailyLastClaim) {
    const elapsed = now - userData.dailyLastClaim;
    if (elapsed < ONE_DAY_MS) {
      const remainingMs = ONE_DAY_MS - elapsed;
      return { success: false, remainingMs };
    }
    if (elapsed <= TWO_DAYS_MS) {
      userData.dailyStreak = (userData.dailyStreak || 0) + 1;
    } else {
      userData.dailyStreak = 1;
    }
  } else {
    userData.dailyStreak = 1;
  }

  userData.dailyLastClaim = now;

  // Hadiah harian: Base 100 koin + (streak * 20), capped streak bonus di 10 (max 300 koin)
  const streakBonus = Math.min(userData.dailyStreak, 10);
  const coinsReward = 100 + (streakBonus * 20);
  const xpReward = 50 + (streakBonus * 10);

  userData.coins = (userData.coins || 0) + coinsReward;
  userData.xp = (userData.xp || 0) + xpReward;

  let leveledUp = false;
  let oldLevel = userData.level;
  const newLevel = calculateLevel(userData.xp);
  if (newLevel > userData.level) {
    leveledUp = true;
    oldLevel = userData.level;
    userData.level = newLevel;
  }

  const newAchievements = checkAchievements(userData);
  setUserData(guildId, userId, userData);

  return {
    success: true,
    coins: coinsReward,
    xp: xpReward,
    streak: userData.dailyStreak,
    leveledUp,
    oldLevel,
    newLevel: userData.level,
    newAchievements,
    totalCoins: userData.coins,
    totalXp: userData.xp,
  };
}

// Papan Peringkat Koin
function getCoinLeaderboard(guildId, limit = 10) {
  const data = loadData();
  const guildData = data[guildId] || {};

  const sorted = Object.entries(guildData)
    .map(([userId, u]) => ({ userId, ...u }))
    .sort((a, b) => (b.coins || 0) - (a.coins || 0))
    .slice(0, limit);

  return sorted;
}

// Ambil ranking koin user di server
function getUserCoinRank(guildId, userId) {
  const data = loadData();
  const guildData = data[guildId] || {};

  const sorted = Object.entries(guildData)
    .map(([uid, u]) => ({ userId: uid, coins: u.coins || 0 }))
    .sort((a, b) => (b.coins || 0) - (a.coins || 0));

  const index = sorted.findIndex((u) => u.userId === userId);
  return index === -1 ? sorted.length + 1 : index + 1;
}

module.exports = {
  processMessage,
  getUserData,
  setUserData,
  getLeaderboard,
  getUserRank,
  getCoinLeaderboard,
  getUserCoinRank,
  addReward,
  addCoins,
  removeCoins,
  transferCoins,
  claimDaily,
  xpForLevel,
  currentLevelXp,
  createProgressBar,
  getRankTitle,
  checkAchievements,
  getAchievementById,
  ACHIEVEMENTS,
  getLevelConfig,
  setLevelConfig,
  totalXpForLevel,
};
