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
  // 1. Prestasi Level (30 Prestasi)
  { id: 'lvl_1', tag: '[LV1]', name: 'Langkah Awal', desc: 'Mencapai Level 1', check: (u) => u.level >= 1 },
  { id: 'lvl_2', tag: '[LV2]', name: 'Mulai Berkembang', desc: 'Mencapai Level 2', check: (u) => u.level >= 2 },
  { id: 'lvl_3', tag: '[LV3]', name: 'Peserta Aktif', desc: 'Mencapai Level 3', check: (u) => u.level >= 3 },
  { id: 'lvl_4', tag: '[LV4]', name: 'Makin Rajin', desc: 'Mencapai Level 4', check: (u) => u.level >= 4 },
  { id: 'lvl_5', tag: '[LV5]', name: 'Bintang Baru', desc: 'Mencapai Level 5', check: (u) => u.level >= 5 },
  { id: 'lvl_6', tag: '[LV6]', name: 'Semangat Tinggi', desc: 'Mencapai Level 6', check: (u) => u.level >= 6 },
  { id: 'lvl_7', tag: '[LV7]', name: 'Eksplorator', desc: 'Mencapai Level 7', check: (u) => u.level >= 7 },
  { id: 'lvl_8', tag: '[LV8]', name: 'Penjelajah Obrolan', desc: 'Mencapai Level 8', check: (u) => u.level >= 8 },
  { id: 'lvl_9', tag: '[LV9]', name: 'Menuju Elit', desc: 'Mencapai Level 9', check: (u) => u.level >= 9 },
  { id: 'lvl_10', tag: '[LV10]', name: 'Veteran Muda', desc: 'Mencapai Level 10', check: (u) => u.level >= 10 },
  { id: 'lvl_12', tag: '[LV12]', name: 'Pilar Komunitas', desc: 'Mencapai Level 12', check: (u) => u.level >= 12 },
  { id: 'lvl_14', tag: '[LV14]', name: 'Penggerak Obrolan', desc: 'Mencapai Level 14', check: (u) => u.level >= 14 },
  { id: 'lvl_16', tag: '[LV16]', name: 'Inspirasi Server', desc: 'Mencapai Level 16', check: (u) => u.level >= 16 },
  { id: 'lvl_18', tag: '[LV18]', name: 'Senior Komunitas', desc: 'Mencapai Level 18', check: (u) => u.level >= 18 },
  { id: 'lvl_20', tag: '[LV20]', name: 'Ikon Server', desc: 'Mencapai Level 20', check: (u) => u.level >= 20 },
  { id: 'lvl_25', tag: '[LV25]', name: 'Ksatria Server', desc: 'Mencapai Level 25', check: (u) => u.level >= 25 },
  { id: 'lvl_30', tag: '[LV30]', name: 'Legenda Berjalan', desc: 'Mencapai Level 30', check: (u) => u.level >= 30 },
  { id: 'lvl_35', tag: '[LV35]', name: 'Warga Kehormatan', desc: 'Mencapai Level 35', check: (u) => u.level >= 35 },
  { id: 'lvl_40', tag: '[LV40]', name: 'Master Komunitas', desc: 'Mencapai Level 40', check: (u) => u.level >= 40 },
  { id: 'lvl_45', tag: '[LV45]', name: 'Panglima Server', desc: 'Mencapai Level 45', check: (u) => u.level >= 45 },
  { id: 'lvl_50', tag: '[LV50]', name: 'Berlian Abadi', desc: 'Mencapai Level 50', check: (u) => u.level >= 50 },
  { id: 'lvl_55', tag: '[LV55]', name: 'Penguasa Obrolan', desc: 'Mencapai Level 55', check: (u) => u.level >= 55 },
  { id: 'lvl_60', tag: '[LV60]', name: 'Tak Tertandingi', desc: 'Mencapai Level 60', check: (u) => u.level >= 60 },
  { id: 'lvl_65', tag: '[LV65]', name: 'Tokoh Utama', desc: 'Mencapai Level 65', check: (u) => u.level >= 65 },
  { id: 'lvl_70', tag: '[LV70]', name: 'Monumen Hidup', desc: 'Mencapai Level 70', check: (u) => u.level >= 70 },
  { id: 'lvl_75', tag: '[LV75]', name: 'Grand Legend', desc: 'Mencapai Level 75', check: (u) => u.level >= 75 },
  { id: 'lvl_80', tag: '[LV80]', name: 'Dewa Obrolan', desc: 'Mencapai Level 80', check: (u) => u.level >= 80 },
  { id: 'lvl_85', tag: '[LV85]', name: 'Puncak Kejayaan', desc: 'Mencapai Level 85', check: (u) => u.level >= 85 },
  { id: 'lvl_90', tag: '[LV90]', name: 'Menjelang Sempurna', desc: 'Mencapai Level 90', check: (u) => u.level >= 90 },
  { id: 'lvl_100', tag: '[LV100]', name: 'Grandmaster Tertinggi', desc: 'Mencapai Level 100', check: (u) => u.level >= 100 },

  // 2. Prestasi Total Pesan (20 Prestasi)
  { id: 'msg_1', tag: '[MSG1]', name: 'Halo Dunia', desc: 'Kirim pesan pertama kamu', check: (u) => u.totalMessages >= 1 },
  { id: 'msg_10', tag: '[MSG2]', name: 'Pemanasan', desc: 'Kirim 10 pesan', check: (u) => u.totalMessages >= 10 },
  { id: 'msg_25', tag: '[MSG3]', name: 'Mulai Terbiasa', desc: 'Kirim 25 pesan', check: (u) => u.totalMessages >= 25 },
  { id: 'msg_50', tag: '[MSG4]', name: 'Obrolan Seru', desc: 'Kirim 50 pesan', check: (u) => u.totalMessages >= 50 },
  { id: 'msg_100', tag: '[MSG5]', name: 'Seratus Kata', desc: 'Kirim 100 pesan', check: (u) => u.totalMessages >= 100 },
  { id: 'msg_200', tag: '[MSG6]', name: 'Komunikator', desc: 'Kirim 200 pesan', check: (u) => u.totalMessages >= 200 },
  { id: 'msg_350', tag: '[MSG7]', name: 'Teman Bicara', desc: 'Kirim 350 pesan', check: (u) => u.totalMessages >= 350 },
  { id: 'msg_500', tag: '[MSG8]', name: 'Penghuni Saluran', desc: 'Kirim 500 pesan', check: (u) => u.totalMessages >= 500 },
  { id: 'msg_750', tag: '[MSG9]', name: 'Sahabat Obrolan', desc: 'Kirim 750 pesan', check: (u) => u.totalMessages >= 750 },
  { id: 'msg_1000', tag: '[MSG10]', name: 'Seribu Pesan', desc: 'Kirim 1.000 pesan', check: (u) => u.totalMessages >= 1000 },
  { id: 'msg_1500', tag: '[MSG11]', name: 'Suara Komunitas', desc: 'Kirim 1.500 pesan', check: (u) => u.totalMessages >= 1500 },
  { id: 'msg_2000', tag: '[MSG12]', name: 'Pengetik Cepat', desc: 'Kirim 2.000 pesan', check: (u) => u.totalMessages >= 2000 },
  { id: 'msg_3000', tag: '[MSG13]', name: 'Pusat Perhatian', desc: 'Kirim 3.000 pesan', check: (u) => u.totalMessages >= 3000 },
  { id: 'msg_4000', tag: '[MSG14]', name: 'Penulis Narasi', desc: 'Kirim 4.000 pesan', check: (u) => u.totalMessages >= 4000 },
  { id: 'msg_5000', tag: '[MSG15]', name: 'Tukang Cerita', desc: 'Kirim 5.000 pesan', check: (u) => u.totalMessages >= 5000 },
  { id: 'msg_7500', tag: '[MSG16]', name: 'Ensiklopedia Chat', desc: 'Kirim 7.500 pesan', check: (u) => u.totalMessages >= 7500 },
  { id: 'msg_10000', tag: '[MSG17]', name: 'Novelis Komunitas', desc: 'Kirim 10.000 pesan', check: (u) => u.totalMessages >= 10000 },
  { id: 'msg_15000', tag: '[MSG18]', name: 'Penulis Epik', desc: 'Kirim 15.000 pesan', check: (u) => u.totalMessages >= 15000 },
  { id: 'msg_20000', tag: '[MSG19]', name: 'Legenda Ketik', desc: 'Kirim 20.000 pesan', check: (u) => u.totalMessages >= 20000 },
  { id: 'msg_25000', tag: '[MSG20]', name: 'Pustakawan Obrolan', desc: 'Kirim 25.000 pesan', check: (u) => u.totalMessages >= 25000 },

  // 3. Prestasi Tabungan Koin (15 Prestasi)
  { id: 'coin_50', tag: '[COIN1]', name: 'Uang Jajan', desc: 'Miliki saldo 50 Koin', check: (u) => (u.coins || 0) >= 50 },
  { id: 'coin_100', tag: '[COIN2]', name: 'Tabungan Pertama', desc: 'Miliki saldo 100 Koin', check: (u) => (u.coins || 0) >= 100 },
  { id: 'coin_250', tag: '[COIN3]', name: 'Celengan Penuh', desc: 'Miliki saldo 250 Koin', check: (u) => (u.coins || 0) >= 250 },
  { id: 'coin_500', tag: '[COIN4]', name: 'Mulai Berada', desc: 'Miliki saldo 500 Koin', check: (u) => (u.coins || 0) >= 500 },
  { id: 'coin_750', tag: '[COIN5]', name: 'Dompet Tebal', desc: 'Miliki saldo 750 Koin', check: (u) => (u.coins || 0) >= 750 },
  { id: 'coin_1000', tag: '[COIN6]', name: 'Kaya Raya', desc: 'Miliki saldo 1.000 Koin', check: (u) => (u.coins || 0) >= 1000 },
  { id: 'coin_2000', tag: '[COIN7]', name: 'Investor Server', desc: 'Miliki saldo 2.000 Koin', check: (u) => (u.coins || 0) >= 2000 },
  { id: 'coin_3500', tag: '[COIN8]', name: 'Bos Finansial', desc: 'Miliki saldo 3.500 Koin', check: (u) => (u.coins || 0) >= 3500 },
  { id: 'coin_5000', tag: '[COIN9]', name: 'Sultan Server', desc: 'Miliki saldo 5.000 Koin', check: (u) => (u.coins || 0) >= 5000 },
  { id: 'coin_7500', tag: '[COIN10]', name: 'Kolektor Emas', desc: 'Miliki saldo 7.500 Koin', check: (u) => (u.coins || 0) >= 7500 },
  { id: 'coin_10000', tag: '[COIN11]', name: 'Baiduri Komunitas', desc: 'Miliki saldo 10.000 Koin', check: (u) => (u.coins || 0) >= 10000 },
  { id: 'coin_15000', tag: '[COIN12]', name: 'Konglomerat', desc: 'Miliki saldo 15.000 Koin', check: (u) => (u.coins || 0) >= 15000 },
  { id: 'coin_20000', tag: '[COIN13]', name: 'Hartawan Besar', desc: 'Miliki saldo 20.000 Koin', check: (u) => (u.coins || 0) >= 20000 },
  { id: 'coin_35000', tag: '[COIN14]', name: 'Gudang Harta', desc: 'Miliki saldo 35.000 Koin', check: (u) => (u.coins || 0) >= 35000 },
  { id: 'coin_50000', tag: '[COIN15]', name: 'Sultan Tertinggi', desc: 'Miliki saldo 50.000 Koin', check: (u) => (u.coins || 0) >= 50000 },

  // 4. Prestasi Kemenangan Mini Game (13 Prestasi)
  { id: 'win_1', tag: '[WIN1]', name: 'Juara Pertama', desc: 'Menangkan 1 mini game', check: (u) => (u.gamesWon || 0) >= 1 },
  { id: 'win_2', tag: '[WIN2]', name: 'Pemenang Ganda', desc: 'Menangkan 2 mini game', check: (u) => (u.gamesWon || 0) >= 2 },
  { id: 'win_3', tag: '[WIN3]', name: 'Hattrick', desc: 'Menangkan 3 mini game', check: (u) => (u.gamesWon || 0) >= 3 },
  { id: 'win_5', tag: '[WIN4]', name: 'Pemberani Game', desc: 'Menangkan 5 mini game', check: (u) => (u.gamesWon || 0) >= 5 },
  { id: 'win_8', tag: '[WIN5]', name: 'Taktik Jitu', desc: 'Menangkan 8 mini game', check: (u) => (u.gamesWon || 0) >= 8 },
  { id: 'win_10', tag: '[WIN6]', name: 'Jawara Arena', desc: 'Menangkan 10 mini game', check: (u) => (u.gamesWon || 0) >= 10 },
  { id: 'win_15', tag: '[WIN7]', name: 'Penakluk Suit & Koin', desc: 'Menangkan 15 mini game', check: (u) => (u.gamesWon || 0) >= 15 },
  { id: 'win_20', tag: '[WIN8]', name: 'Master Taktik', desc: 'Menangkan 20 mini game', check: (u) => (u.gamesWon || 0) >= 20 },
  { id: 'win_25', tag: '[WIN9]', name: 'Kampiun Sejati', desc: 'Menangkan 25 mini game', check: (u) => (u.gamesWon || 0) >= 25 },
  { id: 'win_35', tag: '[WIN10]', name: 'Spesialis Juara', desc: 'Menangkan 35 mini game', check: (u) => (u.gamesWon || 0) >= 35 },
  { id: 'win_50', tag: '[WIN11]', name: 'Raja Mini Games', desc: 'Menangkan 50 mini game', check: (u) => (u.gamesWon || 0) >= 50 },
  { id: 'win_75', tag: '[WIN12]', name: 'Legenda Arena', desc: 'Menangkan 75 mini game', check: (u) => (u.gamesWon || 0) >= 75 },
  { id: 'win_100', tag: '[WIN13]', name: 'Dewa Kemenangan', desc: 'Menangkan 100 mini game', check: (u) => (u.gamesWon || 0) >= 100 },

  // 5. Prestasi Total Game Dimainkan (10 Prestasi)
  { id: 'play_1', tag: '[PLAY1]', name: 'Mencoba Permainan', desc: 'Mainkan 1 mini game', check: (u) => (u.gamesPlayed || 0) >= 1 },
  { id: 'play_5', tag: '[PLAY2]', name: 'Gamer Santai', desc: 'Mainkan 5 mini game', check: (u) => (u.gamesPlayed || 0) >= 5 },
  { id: 'play_10', tag: '[PLAY3]', name: 'Pencari Hiburan', desc: 'Mainkan 10 mini game', check: (u) => (u.gamesPlayed || 0) >= 10 },
  { id: 'play_20', tag: '[PLAY4]', name: 'Penggemar Arcade', desc: 'Mainkan 20 mini game', check: (u) => (u.gamesPlayed || 0) >= 20 },
  { id: 'play_35', tag: '[PLAY5]', name: 'Pecandu Permainan', desc: 'Mainkan 35 mini game', check: (u) => (u.gamesPlayed || 0) >= 35 },
  { id: 'play_50', tag: '[PLAY6]', name: 'Setengah Abad Main', desc: 'Mainkan 50 mini game', check: (u) => (u.gamesPlayed || 0) >= 50 },
  { id: 'play_75', tag: '[PLAY7]', name: 'Prajurit Arcade', desc: 'Mainkan 75 mini game', check: (u) => (u.gamesPlayed || 0) >= 75 },
  { id: 'play_100', tag: '[PLAY8]', name: 'Seratus Ronde', desc: 'Mainkan 100 mini game', check: (u) => (u.gamesPlayed || 0) >= 100 },
  { id: 'play_150', tag: '[PLAY9]', name: 'Veteran Permainan', desc: 'Mainkan 150 mini game', check: (u) => (u.gamesPlayed || 0) >= 150 },
  { id: 'play_200', tag: '[PLAY10]', name: 'Pemberani Tanpa Lelah', desc: 'Mainkan 200 mini game', check: (u) => (u.gamesPlayed || 0) >= 200 },

  // 6. Prestasi Daily Streak (12 Prestasi)
  { id: 'strk_1', tag: '[STRK1]', name: 'Presensi Pertama', desc: 'Klaim hadiah harian 1 hari', check: (u) => (u.dailyStreak || 0) >= 1 },
  { id: 'strk_2', tag: '[STRK2]', name: 'Dua Hari Rutin', desc: 'Klaim harian 2 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 2 },
  { id: 'strk_3', tag: '[STRK3]', name: 'Tiga Hari Berturut', desc: 'Klaim harian 3 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 3 },
  { id: 'strk_4', tag: '[STRK4]', name: 'Empat Hari Disiplin', desc: 'Klaim harian 4 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 4 },
  { id: 'strk_5', tag: '[STRK5]', name: 'Hari Kelima', desc: 'Klaim harian 5 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 5 },
  { id: 'strk_6', tag: '[STRK6]', name: 'Konsistensi Teruji', desc: 'Klaim harian 6 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 6 },
  { id: 'strk_7', tag: '[STRK7]', name: 'Satu Pekan Penuh', desc: 'Klaim harian 7 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 7 },
  { id: 'strk_10', tag: '[STRK8]', name: 'Sepuluh Hari Hebat', desc: 'Klaim harian 10 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 10 },
  { id: 'strk_14', tag: '[STRK9]', name: 'Dua Minggu Setia', desc: 'Klaim harian 14 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 14 },
  { id: 'strk_21', tag: '[STRK10]', name: 'Tiga Minggu Konsisten', desc: 'Klaim harian 21 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 21 },
  { id: 'strk_30', tag: '[STRK11]', name: 'Satu Bulan Penuh', desc: 'Klaim harian 30 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 30 },
  { id: 'strk_60', tag: '[STRK12]', name: 'Legenda Disiplin', desc: 'Klaim harian 60 hari beruntun', check: (u) => (u.dailyStreak || 0) >= 60 },
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
    userData,
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
