const { PermissionFlagsBits } = require('discord.js');

/**
 * Format nama role level:
 * Level 1 sampai Level 99, lalu Level MAX untuk level 100+
 */
function getLevelRoleName(level) {
  const lvlNum = parseInt(level, 10) || 0;
  if (lvlNum >= 100) return 'Level MAX';
  return `Level ${lvlNum}`;
}

/**
 * Format nama role achievement:
 * Achievement 1/100 sampai Achievement 99/100, lalu Achievement MAX untuk 100+
 */
function getAchievementRoleName(count) {
  const achNum = parseInt(count, 10) || 0;
  if (achNum >= 100) return 'Achievement MAX';
  return `Achievement ${achNum}/100`;
}

/**
 * Warna bergradasi dinamis untuk role level
 */
function getLevelColor(level) {
  const lvl = parseInt(level, 10) || 0;
  if (lvl >= 100) return 0xFFD700; // Emas murni untuk Level MAX
  if (lvl >= 80) return 0x9B59FF;  // Ungu royal
  if (lvl >= 60) return 0xEB459E;  // Merah muda neon
  if (lvl >= 40) return 0xFF7A00;  // Oranye terang
  if (lvl >= 20) return 0x2ECC71;  // Hijau zamrud
  if (lvl >= 10) return 0x3498DB;  // Biru laut
  if (lvl >= 5) return 0x00D9FF;   // Cyan
  return 0x95A5A6;                 // Abu-abu perak
}

/**
 * Warna bergradasi dinamis untuk role achievement
 */
function getAchievementColor(count) {
  const ach = parseInt(count, 10) || 0;
  if (ach >= 100) return 0xE91E63; // Crimson cerah untuk Achievement MAX
  if (ach >= 80) return 0x00E5FF;  // Aqua diamond
  if (ach >= 60) return 0xF1C40F;  // Emas
  if (ach >= 40) return 0x9B59B6;  // Ungu lavender
  if (ach >= 20) return 0x1ABC9C;  // Pirus
  return 0x5865F2;                 // Biru bot
}

/**
 * Cari atau buat role dengan nama dan warna tertentu
 */
async function getOrCreateProgressionRole(guild, name, color) {
  const roles = await guild.roles.fetch().catch(() => guild.roles.cache);
  let role = roles?.find((r) => r.name.toLowerCase() === name.toLowerCase());

  if (!role) {
    try {
      role = await guild.roles.create({
        name,
        color: color || 0x95A5A6,
        hoist: false,
        mentionable: false,
        reason: `Auto role progression (${name})`,
      });
    } catch (err) {
      console.warn(`[PROGRESSION ROLE WARN] Gagal membuat role ${name}:`, err.message);
    }
  }
  return role;
}

/**
 * Sinkronkan role level member:
 * Cabut role level lama member dan pasang role level baru (Hanya 1 role level aktif)
 */
async function syncMemberLevelRole(guild, member, level) {
  if (!guild || !member || level < 1) return;
  const targetRoleName = getLevelRoleName(level);
  const targetColor = getLevelColor(level);

  const newRole = await getOrCreateProgressionRole(guild, targetRoleName, targetColor);
  if (!newRole) return;

  // Ambil seluruh role level yang sedang terpasang di member
  const oldLevelRoles = member.roles.cache.filter((r) => {
    if (r.id === newRole.id) return false;
    return /^level\s+(\d+|max)$/i.test(r.name);
  });

  // Hapus role level lama
  for (const [, oldRole] of oldLevelRoles) {
    await member.roles.remove(oldRole).catch(() => {});
  }

  // Pasang role level baru jika belum ada
  if (!member.roles.cache.has(newRole.id)) {
    await member.roles.add(newRole).catch(() => {});
  }
}

/**
 * Sinkronkan role achievement member:
 * Cabut role achievement lama member dan pasang role achievement baru (Hanya 1 role achievement aktif)
 */
async function syncMemberAchievementRole(guild, member, count) {
  if (!guild || !member || count < 1) return;
  const targetRoleName = getAchievementRoleName(count);
  const targetColor = getAchievementColor(count);

  const newRole = await getOrCreateProgressionRole(guild, targetRoleName, targetColor);
  if (!newRole) return;

  // Ambil seluruh role achievement yang sedang terpasang di member
  const oldAchRoles = member.roles.cache.filter((r) => {
    if (r.id === newRole.id) return false;
    return /^achievement\s+(\d+\/100|max)$/i.test(r.name);
  });

  // Hapus role achievement lama
  for (const [, oldRole] of oldAchRoles) {
    await member.roles.remove(oldRole).catch(() => {});
  }

  // Pasang role achievement baru jika belum ada
  if (!member.roles.cache.has(newRole.id)) {
    await member.roles.add(newRole).catch(() => {});
  }
}

/**
 * Inisialisasi awal role milestone pada template setup All-in-One
 */
async function setupProgressionRolesTemplate(guild) {
  if (!guild) return;

  // Siapkan role awal untuk Level 1 dan Achievement 1/100
  const starterLevelRole = await getOrCreateProgressionRole(guild, 'Level 1', getLevelColor(1));
  const starterAchRole = await getOrCreateProgressionRole(guild, 'Achievement 1/100', getAchievementColor(1));
  const maxLevelRole = await getOrCreateProgressionRole(guild, 'Level MAX', getLevelColor(100));
  const maxAchRole = await getOrCreateProgressionRole(guild, 'Achievement MAX', getAchievementColor(100));

  return {
    starterLevelRole,
    starterAchRole,
    maxLevelRole,
    maxAchRole,
  };
}

module.exports = {
  getLevelRoleName,
  getAchievementRoleName,
  getLevelColor,
  getAchievementColor,
  getOrCreateProgressionRole,
  syncMemberLevelRole,
  syncMemberAchievementRole,
  setupProgressionRolesTemplate,
};
