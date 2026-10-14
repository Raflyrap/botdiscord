const fs = require('fs');
const path = require('path');

const AUTOMOD_FILE = path.join(__dirname, 'autoModConfig.json');
let autoModConfig = {};

// Default kata-kata toxic umum bahasa Indonesia & inggris
const DEFAULT_BADWORDS = [
  'anjing', 'babi', 'bangsat', 'kontol', 'memek', 'jembut', 'pantek',
  'bajingan', 'tolol', 'goblok', 'idiot', 'puki', 'pepek', 'ngentot', 'itil',
  'kampret', 'bego', 'lonte', 'sange', 'fuck', 'bitch', 'asshole'
];

// Phishing & scam links umum
const DEFAULT_PHISHING_DOMAINS = [
  'discord-nitro', 'discorcl', 'dlscord', 'nitro-gift', 'free-nitro',
  'steam-nitro', 'discordgift', 'discordapp.click', 'discord-app.me',
  'steamcommunitu', 'steamcomminuty', 'steamconmunity', 'trade-steam'
];

function loadConfig() {
  try {
    if (fs.existsSync(AUTOMOD_FILE)) {
      const raw = fs.readFileSync(AUTOMOD_FILE, 'utf-8');
      autoModConfig = JSON.parse(raw);
    } else {
      autoModConfig = {};
      saveConfig();
    }
  } catch (err) {
    console.error('Error saat membaca autoModConfig.json:', err);
    autoModConfig = {};
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(AUTOMOD_FILE, JSON.stringify(autoModConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat menyimpan autoModConfig.json:', err);
  }
}

loadConfig();

function getServerConfig(guildId) {
  if (!autoModConfig[guildId]) {
    autoModConfig[guildId] = {
      antiPhishing: true,
      antiToxic: true,
      customBadwords: [], // kata tambahan khusus dari admin server
      whitelistRoles: []  // role yang kebal automod (admin/mod)
    };
    saveConfig();
  }
  return autoModConfig[guildId];
}

/**
 * Tambah kata toxic baru oleh admin
 */
function addBadword(guildId, word) {
  const cfg = getServerConfig(guildId);
  const clean = word.toLowerCase().trim();
  if (!clean) return false;
  if (!cfg.customBadwords.includes(clean)) {
    cfg.customBadwords.push(clean);
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Hapus kata toxic oleh admin
 */
function removeBadword(guildId, word) {
  const cfg = getServerConfig(guildId);
  const clean = word.toLowerCase().trim();
  const idx = cfg.customBadwords.indexOf(clean);
  if (idx !== -1) {
    cfg.customBadwords.splice(idx, 1);
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Ambil daftar kata toxic (custom + default)
 */
function getAllBadwords(guildId) {
  const cfg = getServerConfig(guildId);
  return Array.from(new Set([...DEFAULT_BADWORDS, ...cfg.customBadwords]));
}

/**
 * Cek apakah pesan mengandung link phishing / scam
 */
function checkPhishing(content) {
  const text = content.toLowerCase();
  
  // Deteksi domain phishing spesifik
  for (const phish of DEFAULT_PHISHING_DOMAINS) {
    if (text.includes(phish)) {
      return { isPhishing: true, matched: phish };
    }
  }

  // Deteksi tautan fake discord nitro yang umum
  const fakeNitroRegex = /(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.(?:gifts?|gives?|get|vip|codes?|nitro|gift-free)|discorcl\.|dlscord\.)[^\s]+/i;
  if (fakeNitroRegex.test(text)) {
    return { isPhishing: true, matched: 'Fake Discord Link' };
  }

  return { isPhishing: false };
}

/**
 * Cek apakah pesan mengandung kata toxic
 */
function checkToxic(guildId, content) {
  const cfg = getServerConfig(guildId);
  if (!cfg.antiToxic) return { isToxic: false };

  // Bersihkan teks dari spasi/karakter acak untuk deteksi (misal k.o.n.t.o.l)
  const normalized = content.toLowerCase();
  const badwords = getAllBadwords(guildId);

  for (const word of badwords) {
    // Regex pencocokan kata (word boundary atau di dalam kalimat)
    const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}($|\\s|[^a-zA-Z0-9])`, 'i');
    if (regex.test(normalized) || normalized.includes(word)) {
      return { isToxic: true, word };
    }
  }

  return { isToxic: false };
}

module.exports = {
  getServerConfig,
  addBadword,
  removeBadword,
  getAllBadwords,
  checkPhishing,
  checkToxic
};
