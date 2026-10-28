const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { ChannelType, EmbedBuilder } = require('discord.js');

/**
 * Helper untuk meningkatkan kualitas gambar menggunakan AI Super-Resolution HD
 * dan manajemen kategori & channel khusus Auto-HD
 */

const CONFIG_PATH = path.join(__dirname, 'hdChannelConfig.json');

function loadHdConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{}');
  } catch (err) {
    console.error('[HD CONFIG ERROR]:', err.message);
    return {};
  }
}

function saveHdConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[HD CONFIG SAVE ERROR]:', err.message);
  }
}

function getHdConfig(guildId) {
  const configs = loadHdConfig();
  return configs[guildId] || null;
}

function setHdConfig(guildId, data) {
  const configs = loadHdConfig();
  configs[guildId] = { ...(configs[guildId] || {}), ...data };
  saveHdConfig(configs);
  return configs[guildId];
}

function isHdChannel(guildId, channelId) {
  if (!guildId || !channelId) return false;
  const cfg = getHdConfig(guildId);
  return !!(cfg && cfg.enabled && cfg.channelId === channelId);
}

/**
 * Setup otomatis kategori dan channel khusus HD foto
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<{category: import('discord.js').CategoryChannel, hdChannel: import('discord.js').TextChannel}>}
 */
async function setupHdChannel(guild) {
  const cfg = getHdConfig(guild.id) || {};

  // 1. Cek atau buat Kategori "UPGRADE FOTO HD"
  let category = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;
  if (!category) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'upgrade foto hd'
    );
  }

  if (!category) {
    category = await guild.channels.create({
      name: 'UPGRADE FOTO HD',
      type: ChannelType.GuildCategory,
      reason: 'Setup Kategori Khusus HD Foto',
    });
  }

  // 2. Cek atau buat Channel Teks "hd-foto"
  let hdChannel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : null;
  if (!hdChannel) {
    hdChannel = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildText && c.parentId === category.id && c.name === 'hd-foto'
    );
  }

  const guideEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: 'FlyBot • Studio HD Foto',
      iconURL: guild.client.user.displayAvatarURL(),
    })
    .setTitle('Channel Khusus Peningkatan Kualitas Foto')
    .setDescription(
      `Selamat datang di channel khusus Auto-HD!\n\n` +
      `**Cara Pakai (Otomatis & Sangat Mudah):**\n` +
      `• Cukup **kirim foto apa saja** ke channel ini, bot akan langsung otomatis meningkatkan resolusi dan ketajamannya dengan AI Super-Resolution tanpa perlu mengetik perintah apa pun.\n` +
      `• Kamu juga bisa me-reply foto di channel ini lalu ketik \`/hd\` atau \`!hd\`.\n\n` +
      `**Teknologi:**\n` +
      `• AI Super-Resolution HD\n` +
      `• Deep Learning Detail & Texture Enhancement\n` +
      `• Color & Contrast Optimization`
    )
    .setFooter({ text: 'Pesan disematkan permanen • Kirim foto kamu langsung di bawah' })
    .setTimestamp();

  if (!hdChannel) {
    hdChannel = await guild.channels.create({
      name: 'hd-foto',
      type: ChannelType.GuildText,
      parent: category.id,
      topic: 'Kirim foto apa saja di sini untuk langsung di-HD-in otomatis oleh FlyBot',
      reason: 'Setup Channel Khusus HD Foto',
    });

    const sent = await hdChannel.send({ embeds: [guideEmbed] });
    await sent.pin().catch(() => {});
  } else {
    const pins = await (hdChannel.messages.fetchPins ? hdChannel.messages.fetchPins() : hdChannel.messages.fetchPinned()).catch(() => null);
    if (!pins || pins.size === 0) {
      const sent = await hdChannel.send({ embeds: [guideEmbed] });
      await sent.pin().catch(() => {});
    }
  }

  setHdConfig(guild.id, {
    categoryId: category.id,
    channelId: hdChannel.id,
    enabled: true,
  });

  return { category, hdChannel };
}

/**
 * Menghapus kategori dan channel khusus HD foto
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<boolean>}
 */
async function removeHdChannel(guild) {
  const cfg = getHdConfig(guild.id);
  if (!cfg) return false;

  if (cfg.channelId) {
    const ch = guild.channels.cache.get(cfg.channelId) || (await guild.channels.fetch(cfg.channelId).catch(() => null));
    if (ch) await ch.delete('Hapus channel HD foto').catch(() => {});
  }

  if (cfg.categoryId) {
    const cat = guild.channels.cache.get(cfg.categoryId) || (await guild.channels.fetch(cfg.categoryId).catch(() => null));
    if (cat && cat.children?.cache?.size === 0) {
      await cat.delete('Hapus kategori HD foto').catch(() => {});
    }
  }

  setHdConfig(guild.id, {
    categoryId: null,
    channelId: null,
    enabled: false,
  });

  return true;
}

/**
 * Peningkatan Kualitas Gambar via Mesin AI Super-Resolution HD (Snowping Engine)
 * @param {string} imageUrl
 * @returns {Promise<Buffer>}
 */
async function enhanceWithAiSuperResolution(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string' || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
    throw new Error('URL gambar tidak valid untuk diproses oleh AI Super-Resolution.');
  }

  const apiUrl = 'https://api.snowping.cfd/api/imagehd/hd?url=' + encodeURIComponent(imageUrl);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35000);

  let res;
  try {
    res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyBot/2.0',
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Koneksi ke mesin AI Super-Resolution timeout.');
    }
    throw new Error(`Koneksi AI gagal: ${err.message}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    throw new Error(`Mesin AI merespon dengan status HTTP ${res.status}`);
  }

  const data = await res.json().catch(() => null);
  if (!data || data.status !== 200 || !data.result?.url) {
    const errMsg = data?.error || 'Respon AI tidak menyertakan URL hasil.';
    throw new Error(errMsg);
  }

  const imgRes = await fetch(data.result.url);
  if (!imgRes.ok) {
    throw new Error(`Gagal mengunduh gambar hasil AI (Status HTTP ${imgRes.status})`);
  }

  const arrayBuf = await imgRes.arrayBuffer();
  const resultBuf = Buffer.from(arrayBuf);
  if (!resultBuf || resultBuf.length === 0) {
    throw new Error('Buffer gambar hasil AI kosong.');
  }

  return resultBuf;
}

/**
 * Tingkatkan resolusi dan ketajaman gambar HANYA menggunakan mesin AI Super-Resolution HD
 * @param {string} input - URL gambar publik/Discord CDN
 * @param {object} options
 * @returns {Promise<{success: boolean, buffer?: Buffer, fileName?: string, originalWidth?: number, originalHeight?: number, newWidth?: number, newHeight?: number, scale?: number, engine?: string, processTimeMs?: number, error?: string}>}
 */
async function enhanceImage(input, options = {}) {
  const startTime = Date.now();

  try {
    if (!input || typeof input !== 'string' || (!input.startsWith('http://') && !input.startsWith('https://'))) {
      return {
        success: false,
        error: 'Gambar harus memiliki URL publik yang valid (JPG, PNG, atau WebP).',
      };
    }

    // 1. Ambil info dimensi asli gambar via Sharp
    let originalWidth = 0;
    let originalHeight = 0;
    try {
      const origRes = await fetch(input);
      if (origRes.ok) {
        const origBuf = Buffer.from(await origRes.arrayBuffer());
        const origMeta = await sharp(origBuf).metadata();
        originalWidth = origMeta.width || 0;
        originalHeight = origMeta.height || 0;
      }
    } catch (e) {
      // Lanjut proses jika metadata gagal di-fetch
    }

    // 2. Proses menggunakan mesin AI Super-Resolution HD
    const rawAiBuffer = await enhanceWithAiSuperResolution(input);

    // 3. Metadata dan pengecekan ukuran gambar
    let finalBuffer = rawAiBuffer;
    let ext = 'jpg';
    let newWidth = originalWidth * 2 || 1920;
    let newHeight = originalHeight * 2 || 1080;

    try {
      const resultMeta = await sharp(rawAiBuffer).metadata();
      ext = resultMeta.format === 'png' ? 'png' : 'jpg';
      newWidth = resultMeta.width || newWidth;
      newHeight = resultMeta.height || newHeight;

      // Batasi 8MB untuk Discord
      if (finalBuffer.length > 8 * 1024 * 1024) {
        finalBuffer = await sharp(rawAiBuffer)
          .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
          .toBuffer();
        ext = 'jpg';
      }
    } catch (metaErr) {
      console.warn('[AI HD SHARP META WARN]:', metaErr.message);
    }

    const elapsed = Date.now() - startTime;
    const calculatedScale = originalWidth > 0 ? Math.round(newWidth / originalWidth) : 2;

    return {
      success: true,
      buffer: finalBuffer,
      fileName: `ai_hd_${newWidth}x${newHeight}_${Date.now()}.${ext}`,
      originalWidth: originalWidth || Math.round(newWidth / 2),
      originalHeight: originalHeight || Math.round(newHeight / 2),
      newWidth: newWidth,
      newHeight: newHeight,
      scale: calculatedScale || 2,
      engine: 'AI Super-Resolution HD',
      processTimeMs: elapsed,
    };
  } catch (err) {
    console.error('[AI SUPER RESOLUTION HD ERROR]:', err.message);
    return {
      success: false,
      error: err.message || 'Gagal memproses gambar dengan AI Super-Resolution HD.',
    };
  }
}

/**
 * Mencari URL gambar pertama dari pesan Discord (baik dari attachments atau embeds)
 * @param {import('discord.js').Message} message
 * @returns {string|null}
 */
function extractImageUrlFromMessage(message) {
  if (!message) return null;

  // Cek file attachment
  if (message.attachments && message.attachments.size > 0) {
    for (const [, att] of message.attachments) {
      const contentType = att.contentType || '';
      if (
        contentType.startsWith('image/') ||
        /\.(png|jpe?g|webp|bmp|tiff)$/i.test(att.name || att.url)
      ) {
        return att.url;
      }
    }
  }

  // Cek embeds jika berupa link gambar
  if (message.embeds && message.embeds.length > 0) {
    for (const emb of message.embeds) {
      if (emb.image?.url) return emb.image.url;
      if (emb.thumbnail?.url) return emb.thumbnail.url;
    }
  }

  return null;
}

module.exports = {
  enhanceImage,
  extractImageUrlFromMessage,
  getHdConfig,
  setHdConfig,
  setupHdChannel,
  removeHdChannel,
  isHdChannel,
};
