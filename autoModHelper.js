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
      customBadwords: [],  // kata tambahan khusus dari admin server
      disabledBadwords: [], // kata bawaan (default) yang dinonaktifkan/dihapus oleh admin server
      whitelistRoles: []   // role yang kebal automod (admin/mod)
    };
    saveConfig();
  }
  if (!autoModConfig[guildId].customBadwords) autoModConfig[guildId].customBadwords = [];
  if (!autoModConfig[guildId].disabledBadwords) autoModConfig[guildId].disabledBadwords = [];
  return autoModConfig[guildId];
}

/**
 * Tambah kata toxic baru oleh admin
 */
function addBadword(guildId, word) {
  const cfg = getServerConfig(guildId);
  if (!word || typeof word !== 'string') return false;
  const clean = word.toLowerCase().trim();
  if (!clean) return false;

  let changed = false;

  // Jika kata ini sebelumnya dinonaktifkan dari default, pulihkan kembali
  const disIdx = cfg.disabledBadwords.findIndex(w => w.toLowerCase().trim() === clean);
  if (disIdx !== -1) {
    cfg.disabledBadwords.splice(disIdx, 1);
    changed = true;
  }

  const isDefault = DEFAULT_BADWORDS.some(w => w.toLowerCase().trim() === clean);

  // Jika bukan kata default, masukkan ke customBadwords jika belum ada
  if (!isDefault) {
    const exists = cfg.customBadwords.some(w => w.toLowerCase().trim() === clean);
    if (!exists) {
      cfg.customBadwords.push(clean);
      changed = true;
    }
  }

  if (changed) {
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Hapus kata toxic oleh admin (bisa menghapus custom kata maupun mengecualikan kata bawaan/default)
 */
function removeBadword(guildId, word) {
  const cfg = getServerConfig(guildId);
  if (!word || typeof word !== 'string') return false;
  const clean = word.toLowerCase().trim();
  if (!clean) return false;

  let changed = false;

  // 1. Cek dan hapus dari customBadwords jika ada
  const customIdx = cfg.customBadwords.findIndex(w => w.toLowerCase().trim() === clean);
  if (customIdx !== -1) {
    cfg.customBadwords.splice(customIdx, 1);
    changed = true;
  }

  // 2. Cek apakah ada di DEFAULT_BADWORDS
  const isDefault = DEFAULT_BADWORDS.some(w => w.toLowerCase().trim() === clean);
  if (isDefault) {
    const alreadyDisabled = cfg.disabledBadwords.some(w => w.toLowerCase().trim() === clean);
    if (!alreadyDisabled) {
      cfg.disabledBadwords.push(clean);
      changed = true;
    }
  }

  if (changed) {
    saveConfig();
    return true;
  }
  return false;
}

/**
 * Ambil daftar seluruh kata toxic aktif (default aktif + custom)
 */
function getAllBadwords(guildId) {
  const cfg = getServerConfig(guildId);
  const disabled = (cfg.disabledBadwords || []).map(w => w.toLowerCase().trim());
  const activeDefaults = DEFAULT_BADWORDS.filter(w => !disabled.includes(w.toLowerCase().trim()));
  const customs = (cfg.customBadwords || []).map(w => w.toLowerCase().trim());
  return Array.from(new Set([...activeDefaults, ...customs]));
}

/**
 * Ambil rincian lengkap kata toxic untuk tampilan detail
 */
function getBadwordsBreakdown(guildId) {
  const cfg = getServerConfig(guildId);
  const disabled = (cfg.disabledBadwords || []).map(w => w.toLowerCase().trim());
  const activeDefaults = DEFAULT_BADWORDS.filter(w => !disabled.includes(w.toLowerCase().trim()));
  const customs = (cfg.customBadwords || []).map(w => w.toLowerCase().trim());
  return {
    defaults: activeDefaults,
    customs: customs,
    disabled: disabled,
    all: Array.from(new Set([...activeDefaults, ...customs]))
  };
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
  getBadwordsBreakdown,
  DEFAULT_BADWORDS,
  checkPhishing,
  checkToxic
};
