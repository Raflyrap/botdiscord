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
 * - Channel verifikasi: Dibuka untuk @everyone dan role belum verifikasi (hanya baca).
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
        // Channel verifikasi: buka untuk @everyone dan role belum verif, kunci kirim pesan
        await ch.permissionOverwrites.edit(guild.id, {
          [PermissionFlagsBits.ViewChannel]: true,
          [PermissionFlagsBits.SendMessages]: false,
          [PermissionFlagsBits.ReadMessageHistory]: true,
        });

        if (unverifiedRoleId) {
          await ch.permissionOverwrites.edit(unverifiedRoleId, {
            [PermissionFlagsBits.ViewChannel]: true,
            [PermissionFlagsBits.SendMessages]: false,
            [PermissionFlagsBits.ReadMessageHistory]: true,
          });
        }

        updatedCount++;
      } else {
        // Channel lain: sembunyikan dari @everyone dan role belum verif, buka untuk role yang sudah verifikasi
        await ch.permissionOverwrites.edit(guild.id, {
          [PermissionFlagsBits.ViewChannel]: false,
        });

        if (unverifiedRoleId) {
          await ch.permissionOverwrites.edit(unverifiedRoleId, {
            [PermissionFlagsBits.ViewChannel]: false,
          });
        }

        if (verifiedRoleId) {
          await ch.permissionOverwrites.edit(verifiedRoleId, {
            [PermissionFlagsBits.ViewChannel]: true,
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

module.exports = {
  getVerifConfig,
  setVerifConfig,
  applyChannelLockdown,
};

