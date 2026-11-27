const { ChannelType } = require('discord.js');

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 (Waktu Indonesia Barat)

const AI_CHANNEL_KEYWORDS = ['ai-generating', 'ai-prompt', 'ai-promt', 'ai-fanart'];
const SOSMED_CHANNEL_KEYWORDS = ['tiktok-convert', 'instagram-convert', 'facebook-convert', 'youtube-convert'];
const MINIGAME_CHANNEL_KEYWORDS = [
  'tebak-koin', 'tebak-angka', 'suit-jepang', 'gacha-slot', 'sambung-kata',
  'lengkapi-kalimat', 'tebak-karakter-ff', 'kuis-matematika', 'siapakah-aku',
  'susun-kata', 'tebak-gambar', 'tebak-game', 'tebak-logo',
];
const HD_CHANNEL_KEYWORDS = ['hd-foto', 'hdfoto', 'hd-photo', 'meme', 'remove-bg', 'removebg', 'pinterest', 'hitamkan'];
const STALK_CHANNEL_KEYWORDS = ['stalk'];

function isAiChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const isKw = AI_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
  const isCat = channel.parent && channel.parent.name.toLowerCase().includes('entertainment');
  return isKw || isCat;
}

function isSosmedChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const isKw = SOSMED_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
  const isCat = channel.parent && (channel.parent.name.toLowerCase().includes('sosmed') || channel.parent.name.toLowerCase().includes('converter'));
  return isKw || isCat;
}

function isMiniGameChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const isKw = MINIGAME_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
  const isCat = channel.parent && channel.parent.name.toLowerCase().includes('mini game');
  return isKw || isCat;
}

function isHdChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const isKw = HD_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
  const isCat = channel.parent && channel.parent.name.toLowerCase().includes('cinematography');
  return isKw || isCat;
}

function isStalkChannel(channel) {
  if (!channel || channel.type !== ChannelType.GuildText) return false;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return STALK_CHANNEL_KEYWORDS.some((kw) => clean.includes(kw));
}

function isAutoCleanupChannel(channel) {
  return (
    isAiChannel(channel) ||
    isSosmedChannel(channel) ||
    isMiniGameChannel(channel) ||
    isHdChannel(channel) ||
    isStalkChannel(channel)
  );
}

/**
 * Hitung milidetik menuju jam 00:00:00 WIB (UTC+7) berikutnya
 */
function getMsUntilNextMidnightWIB() {
  const nowUtc = Date.now();
  const nowWib = new Date(nowUtc + WIB_OFFSET_MS);
  const nextMidnightWib = Date.UTC(
    nowWib.getUTCFullYear(),
    nowWib.getUTCMonth(),
    nowWib.getUTCDate() + 1,
    0, 0, 5, 0 // 00:00:05 WIB
  );
  const targetUtc = nextMidnightWib - WIB_OFFSET_MS;
  return Math.max(1000, targetUtc - nowUtc);
}

/**
 * Bersihkan semua pesan chat (kecuali pesan pinned & panel tombol permanen bot) pada jam 00:00 WIB
 */
async function cleanupOldMessagesInChannel(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) return 0;

    const now = Date.now();
    const botId = channel.client?.user?.id;

    // Abaikan pesan pinned & embed panel interaktif ber-tombol milik bot
    const toDelete = messages.filter((m) => {
      if (m.pinned) return false;
      if (botId && m.author?.id === botId && m.components && m.components.length > 0 && m.embeds && m.embeds.length > 0) {
        return false;
      }
      return true;
    });

    if (toDelete.size === 0) return 0;

    const bulkable = toDelete.filter((m) => now - m.createdTimestamp < FOURTEEN_DAYS_MS);
    const individual = toDelete.filter((m) => now - m.createdTimestamp >= FOURTEEN_DAYS_MS);

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
 * Jalankan pembersihan rutin jam 00:00 WIB untuk semua server
 */
async function runAllAutoCleanup(client) {
  console.log('[AUTO CLEANUP 00:00 WIB] Memulai pembersihan otomatis seluruh channel fitur...');
  let totalDeleted = 0;
  for (const [, guild] of client.guilds.cache) {
    try {
      const targetChannels = guild.channels.cache.filter((c) => isAutoCleanupChannel(c));
      for (const [, ch] of targetChannels) {
        const count = await cleanupOldMessagesInChannel(ch);
        if (count > 0) {
          totalDeleted += count;
          console.log(`[AUTO CLEANUP 00:00 WIB] Menghapus ${count} pesan di #${ch.name} (${guild.name})`);
        }
      }
    } catch (err) {
      // silent
    }
  }
  console.log(`[AUTO CLEANUP 00:00 WIB] Selesai! Total ${totalDeleted} pesan dibersihkan.`);
}

/**
 * Jadwalkan pembersihan otomatis tepat setiap pukul 00:00 WIB (UTC+7)
 */
function initAutoChannelCleaner(client) {
  const scheduleNext = () => {
    const delayMs = getMsUntilNextMidnightWIB();
    const hours = Math.floor(delayMs / 3600000);
    const mins = Math.floor((delayMs % 3600000) / 60000);
    console.log(`[AUTO CLEANUP 00:00 WIB] Pembersihan harian dijadwalkan tepat pukul 00:00 WIB (dalam ${hours} jam ${mins} menit).`);

    setTimeout(async () => {
      try {
        await runAllAutoCleanup(client);
      } catch (err) {
        console.error('[AUTO CLEANUP 00:00 WIB ERROR]:', err.message);
      }
      scheduleNext();
    }, delayMs);
  };

  scheduleNext();
}

module.exports = {
  isAiChannel,
  isSosmedChannel,
  isMiniGameChannel,
  isHdChannel,
  isStalkChannel,
  isAutoCleanupChannel,
  cleanupOldAiMessagesInChannel: cleanupOldMessagesInChannel,
  cleanupOldMessagesInChannel,
  runAllAiChannelCleanup: runAllAutoCleanup,
  runAllAutoCleanup,
  initAiChannelCleaner: initAutoChannelCleaner,
  initAutoChannelCleaner,
};
