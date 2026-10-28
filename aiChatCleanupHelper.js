const { ChannelType } = require('discord.js');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const AI_CHANNEL_KEYWORDS = ['ai-generating', 'ai-prompt', 'ai-promt', 'ai-fanart'];
const SOSMED_CHANNEL_KEYWORDS = ['tiktok-convert', 'instagram-convert', 'facebook-convert', 'youtube-convert'];

/**
 * Cek apakah channel merupakan salah satu dari channel AI Entertainment
 */
function isAiChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return AI_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
}

/**
 * Cek apakah channel merupakan salah satu dari channel Sosmed Converter
 */
function isSosmedChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const isKw = SOSMED_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
  const isCategorySosmed = channel.parent && channel.parent.name.toLowerCase().includes('sosmed');
  return isKw || isCategorySosmed;
}

/**
 * Cek apakah channel memiliki aturan pembersihan otomatis 24 jam (AI Entertainment atau Sosmed Converter)
 */
function isAutoCleanupChannel(channel) {
  return isAiChannel(channel) || isSosmedChannel(channel);
}

/**
 * Hapus pesan yang sudah berumur >= 1 hari (24 jam) di channel target
 */
async function cleanupOldMessagesInChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) return 0;

    const now = Date.now();
    // Abaikan pesan pinned (misal embed panduan / peraturan channel)
    const toDelete = messages.filter((m) => !m.pinned && (now - m.createdTimestamp >= ONE_DAY_MS));
    if (toDelete.size === 0) return 0;

    // Pisahkan pesan yang bisa dibulk-delete (< 14 hari) dan yang individual
    const bulkable = toDelete.filter((m) => (now - m.createdTimestamp) < FOURTEEN_DAYS_MS);
    const individual = toDelete.filter((m) => (now - m.createdTimestamp) >= FOURTEEN_DAYS_MS);

    if (bulkable.size > 0) {
      if (bulkable.size === 1) {
        await bulkable.first().delete().catch(() => {});
      } else {
        await channel.bulkDelete(bulkable, true).catch(() => {});
      }
    }

    for (const [, m] of individual) {
      await m.delete().catch(() => {});
    }

    return toDelete.size;
  } catch (err) {
    console.warn(`[CHAT CLEANUP WARN] Kendala pembersihan chat #${channel.name}:`, err.message);
    return 0;
  }
}

/**
 * Jalankan pembersihan untuk semua server yang memiliki channel AI & Sosmed Converter
 */
async function runAllAutoCleanup(client) {
  for (const [, guild] of client.guilds.cache) {
    try {
      const targetChannels = guild.channels.cache.filter((c) => isAutoCleanupChannel(c));
      for (const [, ch] of targetChannels) {
        const count = await cleanupOldMessagesInChannel(ch);
        if (count > 0) {
          console.log(`[AUTO CLEANUP 24H] Menghapus ${count} pesan chat berusia > 24 jam di #${ch.name} (${guild.name})`);
        }
      }
    } catch (err) {
      // silent
    }
  }
}

/**
 * Inisialisasi timer pembersihan otomatis berkala (AI & Sosmed Converter)
 */
function initAutoChannelCleaner(client, intervalMs = 15 * 60 * 1000) {
  // Jalankan scan pembersihan awal 10 detik setelah bot menyala
  setTimeout(() => {
    runAllAutoCleanup(client).catch(() => {});
  }, 10000);

  // Jalankan periodik setiap 15 menit
  setInterval(() => {
    runAllAutoCleanup(client).catch(() => {});
  }, intervalMs);
}

module.exports = {
  isAiChannel,
  isSosmedChannel,
  isAutoCleanupChannel,
  cleanupOldAiMessagesInChannel: cleanupOldMessagesInChannel,
  cleanupOldMessagesInChannel,
  runAllAiChannelCleanup: runAllAutoCleanup,
  runAllAutoCleanup,
  initAiChannelCleaner: initAutoChannelCleaner,
  initAutoChannelCleaner,
};
