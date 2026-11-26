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

const SNOWPING_API_KEY = process.env.SNOWPING_API_KEY || 'FlyBot';

/**
 * Peningkatan Kualitas Gambar via Snowping Upscale Pro (Parish.ai - Premium)
 * @param {string} imageUrl
 * @param {number} scale - 2 atau 4
 * @returns {Promise<Buffer>}
 */
async function enhanceWithSnowpingUpscalePro(imageUrl, scale = 4) {
  const cleanScale = [2, 4, 6, 8, 10].includes(scale) ? scale : 4;
  const apiUrl =
    `https://api.snowping.cfd/api/imagehd/upscalepro?url=${encodeURIComponent(imageUrl)}` +
    `&scale=${cleanScale}&apikey=${encodeURIComponent(SNOWPING_API_KEY)}`;

  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyBot/2.0',
      apikey: SNOWPING_API_KEY,
      'x-apikey': SNOWPING_API_KEY,
      'x-api-key': SNOWPING_API_KEY,
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Snowping UpscalePro HTTP ${res.status}: ${errBody.slice(0, 150)}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('image/')) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 0) return buf;
  }

  const data = await res.json().catch(() => null);
  const resultUrl =
    data?.result?.url ||
    data?.result?.image ||
    data?.data?.url ||
    data?.url ||
    (typeof data?.result === 'string' && data.result.startsWith('http') ? data.result : null);

  if (!resultUrl) {
    throw new Error(data?.error || data?.message || 'Respon Snowping UpscalePro tidak menyertakan URL gambar.');
  }

  const imgRes = await fetch(resultUrl, { signal: AbortSignal.timeout(25000) });
  if (!imgRes.ok) {
    throw new Error(`Gagal mengunduh hasil Snowping UpscalePro (HTTP ${imgRes.status})`);
  }
  const resultBuf = Buffer.from(await imgRes.arrayBuffer());
  if (!resultBuf || resultBuf.length === 0) {
    throw new Error('Buffer gambar hasil Snowping UpscalePro kosong.');
  }
  return resultBuf;
}

/**
 * Peningkatan Kualitas Gambar via Mesin AI Super-Resolution HD (Real-ESRGAN via Hugging Face Gradio)
 * @param {Buffer} inputBuffer
 * @param {number} scale - 2 atau 4
 * @returns {Promise<Buffer>}
 */
async function enhanceWithAiSuperResolution(inputBuffer, scale = 4) {
  const { Client } = await import('@gradio/client');
  const clientOptions = process.env.HF_TOKEN ? { token: process.env.HF_TOKEN } : {};
  const inputBlob = new Blob([inputBuffer], { type: 'image/png' });

  // 1. Primary AI: Real-ESRGAN (bookbot/Image-Upscaling-Playground) — cepat (~3-5 detik) & sangat tajam
  try {
    const client = await Client.connect('bookbot/Image-Upscaling-Playground', clientOptions);
    const modelChoice = scale >= 4 ? 'modelx4' : 'modelx2';
    const prediction = await client.predict('/upscale', {
      image: inputBlob,
      model: modelChoice,
    });
    const fileInfo = Array.isArray(prediction?.data) ? prediction.data[0] : null;
    const resultUrl = typeof fileInfo === 'string' ? fileInfo : fileInfo?.url;
    if (resultUrl) {
      const imgRes = await fetch(resultUrl, { signal: AbortSignal.timeout(25000) });
      if (imgRes.ok) {
        const resultBuf = Buffer.from(await imgRes.arrayBuffer());
        if (resultBuf.length > 0) return resultBuf;
      }
    }
  } catch (err) {
    console.warn('[AI HD] bookbot Real-ESRGAN gagal, mencoba fallback Nick088 Real-ESRGAN:', err.message);
  }

  // 2. Fallback AI: Nick088/Real-ESRGAN_Pytorch
  const client2 = await Client.connect('Nick088/Real-ESRGAN_Pytorch', clientOptions);
  const prediction2 = await client2.predict('/predict', {
    img: inputBlob,
    size_modifier: scale >= 4 ? 4 : 2,
  });
  const fileInfo2 = Array.isArray(prediction2?.data) ? prediction2.data[0] : null;
  const resultUrl2 = typeof fileInfo2 === 'string' ? fileInfo2 : fileInfo2?.url;
  if (!resultUrl2) {
    throw new Error('Mesin AI Real-ESRGAN tidak mengembalikan URL hasil.');
  }
  const imgRes2 = await fetch(resultUrl2, { signal: AbortSignal.timeout(25000) });
  if (!imgRes2.ok) {
    throw new Error(`Gagal mengunduh gambar hasil AI (HTTP ${imgRes2.status})`);
  }
  const resultBuf2 = Buffer.from(await imgRes2.arrayBuffer());
  if (!resultBuf2 || resultBuf2.length === 0) {
    throw new Error('Buffer gambar hasil AI kosong.');
  }
  return resultBuf2;
}

/**
 * Tingkatkan resolusi dan ketajaman gambar menggunakan mesin AI Super-Resolution Real-ESRGAN
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

    // 1. Unduh gambar asli sekali saja & baca dimensi via Sharp
    const origRes = await fetch(input, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyBot/2.0' },
      signal: AbortSignal.timeout(20000),
    });
    if (!origRes.ok) {
      throw new Error(`Gagal mengunduh gambar asli: HTTP ${origRes.status}`);
    }
    const origBuf = Buffer.from(await origRes.arrayBuffer());
    const origMeta = await sharp(origBuf).metadata().catch(() => ({}));
    const originalWidth = origMeta.width || 0;
    const originalHeight = origMeta.height || 0;

    // Pilih skala optimal: 4x untuk gambar buram/kecil (< 900px), 2x untuk gambar sudah cukup besar agar tetap cepat & tidak OOM
    const requestedScale = parseInt(options.scale, 10) || (originalWidth > 0 && originalWidth < 900 ? 4 : 2);
    const aiScale = requestedScale >= 4 && originalWidth < 1200 ? 4 : 2;

    // Pastikan input PNG bersih untuk AI (batasi max 1280px sebelum upscale agar GPU tidak OOM)
    const preparedBuf = originalWidth > 1280 || originalHeight > 1280
      ? await sharp(origBuf).resize(1280, 1280, { fit: 'inside' }).png().toBuffer()
      : await sharp(origBuf).png().toBuffer();

    // 2. Prioritas 1: Snowping Upscale Pro (Parish.ai Premium) -> Prioritas 2: AI Real-ESRGAN -> Prioritas 3: Sharp Ultra-HD
    let rawAiBuffer = null;
    let engineUsed = 'Upscale Pro (Parish.ai)';

    try {
      rawAiBuffer = await enhanceWithSnowpingUpscalePro(input, aiScale);
    } catch (snowErr) {
      console.warn('[AI HD] Snowping UpscalePro gagal/limit, beralih ke AI Real-ESRGAN:', snowErr.message);
      engineUsed = 'AI Real-ESRGAN Super-Resolution';
      try {
        rawAiBuffer = await enhanceWithAiSuperResolution(preparedBuf, aiScale);
      } catch (aiErr) {
        console.warn('[AI HD] Semua mesin AI sedang sibuk/offline, beralih ke Sharp Ultra-HD:', aiErr.message);
        engineUsed = 'Sharp Ultra-HD Engine (Fallback)';
        const targetW = originalWidth > 0 ? Math.min(originalWidth * aiScale, 3840) : 1920;
        rawAiBuffer = await sharp(origBuf)
          .resize({ width: targetW, kernel: sharp.kernel.lanczos3 })
          .sharpen({ sigma: 1.2, m1: 1.0, m2: 2.0 })
          .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
          .toBuffer();
      }
    }

    // 3. Konversi hasil ke JPG/PNG kualitas penuh (maks 8MB untuk Discord)
    let finalBuffer = await sharp(rawAiBuffer)
      .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
      .toBuffer();
    let ext = 'jpg';
    let newWidth = originalWidth * aiScale || 1920;
    let newHeight = originalHeight * aiScale || 1080;

    try {
      const resultMeta = await sharp(finalBuffer).metadata();
      newWidth = resultMeta.width || newWidth;
      newHeight = resultMeta.height || newHeight;

      if (finalBuffer.length > 8 * 1024 * 1024) {
        finalBuffer = await sharp(rawAiBuffer)
          .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
          .toBuffer();
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
      engine: engineUsed,
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
