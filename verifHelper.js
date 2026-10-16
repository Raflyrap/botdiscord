const fs = require('fs');
const path = require('path');
const { PermissionFlagsBits } = require('discord.js');

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

/**
 * Mengatur permission channel di server:
 * - Channel verifikasi: Dibuka untuk @everyone dan role belum verifikasi (hanya baca). Sembunyikan dari yang sudah verif.
 * - Seluruh channel lainnya: Ditutup dari @everyone dan role belum verifikasi, dibuka untuk role sudah verifikasi.
 */
async function applyChannelLockdown(guild, { verifChannelId, verifiedRoleId, unverifiedRoleId }) {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let updatedCount = 0;

  for (const [, ch] of channels) {
    if (!ch || !ch.permissionOverwrites) continue;

    try {
      const isVerifChannel = ch.id === verifChannelId;

      if (isVerifChannel) {
        // Channel verifikasi:
        // 1. @everyone: Bisa melihat & baca history, TIDAK bisa kirim chat (hanya tombol verif)
        await ch.permissionOverwrites.edit(guild.id, {
          ViewChannel: true,
          SendMessages: false,
          ReadMessageHistory: true,
        });

        // 2. Role belum verif: Bisa melihat & baca history, TIDAK bisa kirim chat
        if (unverifiedRoleId) {
          await ch.permissionOverwrites.edit(unverifiedRoleId, {
            ViewChannel: true,
            SendMessages: false,
            ReadMessageHistory: true,
          });
        }

        // 3. Role sudah verif: Sembunyikan channel verifikasi agar tidak mengganggu setelah verifikasi
        if (verifiedRoleId) {
          await ch.permissionOverwrites.edit(verifiedRoleId, {
            ViewChannel: false,
          });
        }

        // 4. Jika channel verifikasi berada di dalam kategori, pastikan kategorinya dapat dilihat
        if (ch.parent) {
          await ch.parent.permissionOverwrites.edit(guild.id, {
            ViewChannel: true,
          }).catch(() => null);

          if (unverifiedRoleId) {
            await ch.parent.permissionOverwrites.edit(unverifiedRoleId, {
              ViewChannel: true,
            }).catch(() => null);
          }
        }

        updatedCount++;
      } else {
        // Channel lain:
        // 1. @everyone: Sembunyikan
        await ch.permissionOverwrites.edit(guild.id, {
          ViewChannel: false,
        });

        // 2. Role belum verif: Sembunyikan
        if (unverifiedRoleId) {
          await ch.permissionOverwrites.edit(unverifiedRoleId, {
            ViewChannel: false,
          });
        }

        // 3. Role sudah verifikasi: Buka channel
        if (verifiedRoleId) {
          await ch.permissionOverwrites.edit(verifiedRoleId, {
            ViewChannel: true,
          });
        }

        updatedCount++;
      }
    } catch (err) {
      console.warn(`[VERIF LOCKDOWN] Gagal menyesuaikan channel ${ch.name}:`, err.message);
    }
  }

  return updatedCount;
}

/**
 * Memberikan role belum verifikasi ke seluruh member lama yang belum verifikasi
 */
async function syncExistingMembers(guild, { verifiedRoleId, unverifiedRoleId }) {
  if (!unverifiedRoleId) return 0;
  try {
    const members = await guild.members.fetch();
    let assignedCount = 0;
    for (const [, member] of members) {
      if (member.user.bot) continue;
      // Jika member belum punya role verified dan belum punya role unverified
      if (!member.roles.cache.has(verifiedRoleId) && !member.roles.cache.has(unverifiedRoleId)) {
        await member.roles.add(unverifiedRoleId).catch(() => null);
        assignedCount++;
      }
    }
    return assignedCount;
  } catch (err) {
    console.warn('[VERIF SYNC MEMBERS] Gagal sinkronisasi member lama:', err.message);
    return 0;
  }
}

module.exports = {
  getVerifConfig,
  setVerifConfig,
  applyChannelLockdown,
  syncExistingMembers,
};

