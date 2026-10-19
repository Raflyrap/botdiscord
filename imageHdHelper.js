const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { Client: GradioClient } = require('@gradio/client');
const { ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

/**
 * Helper untuk meningkatkan kualitas gambar secara lokal (Upscale & Sharpening)
 * dan manajemen kategori & channel khusus Auto-HD
 */

const CONFIG_PATH = path.join(__dirname, 'hdChannelConfig.json');
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // Maksimal input 15MB
const MAX_DIMENSION = 4096; // Maksimal lebar/tinggi output 4096px agar hemat memori & aman di Discord

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
      name: 'FlyBot  •  Studio HD Foto',
      iconURL: guild.client.user.displayAvatarURL(),
    })
    .setTitle('Channel Khusus Peningkatan Kualitas Foto')
    .setDescription(
      `Selamat datang di channel khusus Auto-HD!\n\n` +
      `**Cara Pakai (Otomatis & Sangat Mudah):**\n` +
      `• Cukup **kirim foto apa saja** ke channel ini, bot akan langsung otomatis meningkatkan resolusi dan ketajamannya (Auto-HD 2x) tanpa perlu mengetik perintah apa pun.\n` +
      `• Ingin hasil lebih besar? Ketik \`/hd 4x\` pada caption foto untuk pembesaran 4x Ultra HD.\n` +
      `• Kamu juga bisa me-reply foto di channel ini lalu ketik \`/hd\` atau \`!hd\`.\n\n` +
      `**Teknologi Studio:**\n` +
      `• Interpolasi Piksel Lanczos3\n` +
      `• Adaptive Unsharp Masking\n` +
      `• Chroma Subsampling 4:4:4 (Warna Asli Terjaga)`
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
    const pins = await hdChannel.messages.fetchPinned().catch(() => null);
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
 * Mengambil Buffer gambar dari URL atau Buffer
 * @param {string|Buffer} input - URL attachment Discord atau Buffer
 * @returns {Promise<Buffer>}
 */
async function fetchImageBuffer(input) {
  if (Buffer.isBuffer(input)) return input;

  if (typeof input === 'string') {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(`Gagal mengunduh gambar (Status HTTP ${res.status})`);
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_INPUT_BYTES) {
      throw new Error('Ukuran gambar terlalu besar (maksimal 15MB)');
    }

    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);

    if (buf.length > MAX_INPUT_BYTES) {
      throw new Error('Ukuran gambar melebihi batas 15MB');
    }

    return buf;
  }

  throw new Error('Input gambar tidak valid');
}

/**
 * Tingkatkan resolusi dan ketajaman gambar
 * @param {string|Buffer} input - URL gambar atau Buffer
 * @param {object} options
 * @param {number} [options.scale=2] - Faktor pembesaran (2 atau 4)
 * @returns {Promise<{success: boolean, buffer?: Buffer, fileName?: string, originalWidth?: number, originalHeight?: number, newWidth?: number, newHeight?: number, processTimeMs?: number, error?: string}>}
 */
async function enhanceImage(input, options = {}) {
  const startTime = Date.now();
  const scale = options.scale === 4 ? 4 : 2;

  try {
    const rawBuffer = await fetchImageBuffer(input);

    const image = sharp(rawBuffer, { failOn: 'none' });
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return {
        success: false,
        error: 'File yang dikirim bukan format gambar yang didukung (gunakan JPG, PNG, atau WebP).',
      };
    }

    // 1. Prioritaskan Deep Learning Super-Resolution AI (Real-ESRGAN / CUGAN) jika HF_TOKEN tersedia
    const hfToken = process.env.HF_TOKEN;
    if (hfToken) {
      try {
        const aiModel = scale === 4 ? '4xRealWebPhoto_v4_dat2' : '2xHFA2kReal-CUGAN';
        const mime = metadata.format === 'png' ? 'image/png' : 'image/jpeg';
        const imageBlob = new Blob([rawBuffer], { type: mime });

        const app = await GradioClient.connect('Phips/Upscaler', { token: hfToken });
        const res = await app.predict('/upscale_image', [imageBlob, aiModel]);

        const downloadUrl = res?.data?.[1]?.url;
        if (downloadUrl) {
          const downloadRes = await fetch(downloadUrl);
          if (downloadRes.ok) {
            let aiBuffer = Buffer.from(await downloadRes.arrayBuffer());
            let finalMeta = await sharp(aiBuffer).metadata();
            let ext = finalMeta.format || 'png';

            // Jika hasil melebihi 8MB (batas Discord free), konversi efisien ke JPEG kualitas tinggi
            if (aiBuffer.length > 8 * 1024 * 1024) {
              aiBuffer = await sharp(aiBuffer).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
              ext = 'jpg';
              finalMeta = await sharp(aiBuffer).metadata();
            }

            const elapsed = Date.now() - startTime;
            return {
              success: true,
              buffer: aiBuffer,
              fileName: `ai_hd_${finalMeta.width}x${finalMeta.height}_${Date.now()}.${ext}`,
              originalWidth: metadata.width,
              originalHeight: metadata.height,
              newWidth: finalMeta.width,
              newHeight: finalMeta.height,
              scale: scale,
              engine: 'Real-ESRGAN AI (Hugging Face GPU)',
              processTimeMs: elapsed,
            };
          }
        }
      } catch (hfErr) {
        console.warn('[HF AI UPSCALE FAILED, FALLBACK TO LOCAL]:', hfErr.message);
      }
    }

    // 2. Fallback Lokal Studio menggunakan Sharp (Lanczos3 + Unsharp Mask) jika AI offline
    let targetWidth = Math.round(metadata.width * scale);
    let targetHeight = Math.round(metadata.height * scale);

    // Batasi dimensi maksimal agar aman di Discord dan server Pterodactyl
    if (targetWidth > MAX_DIMENSION || targetHeight > MAX_DIMENSION) {
      const ratio = Math.min(MAX_DIMENSION / targetWidth, MAX_DIMENSION / targetHeight);
      targetWidth = Math.max(1, Math.round(targetWidth * ratio));
      targetHeight = Math.max(1, Math.round(targetHeight * ratio));
    }

    // Pipeline pemrosesan gambar berkecepatan tinggi:
    // 1. Resize menggunakan interpolasi Lanczos3 (kualitas detail piksel tertinggi)
    // 2. Sharpening filter adaptif untuk menonjolkan garis tepi dan tekstur
    // 3. Modulasi kontras halus dan saturasi warna seimbang
    let pipeline = image
      .rotate() // Auto-orientasi sesuai EXIF gambar asli
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'inside',
        withoutEnlargement: false,
      })
      .sharpen({
        sigma: 1.4,
        m1: 1.2,
        m2: 0.6,
        x1: 2,
        y2: 10,
        y3: 20,
      })
      .modulate({
        saturation: 1.04,
        brightness: 1.01,
      });

    const isPng = metadata.format === 'png';
    let outputBuffer;
    let ext = 'jpg';

    if (isPng && targetWidth * targetHeight <= 2048 * 2048) {
      // Untuk PNG kecil, pertahankan PNG lossless
      outputBuffer = await pipeline
        .png({
          compressionLevel: 8,
          adaptiveFiltering: true,
        })
        .toBuffer();
      ext = 'png';
    } else {
      // Gunakan JPEG kualitas studio 95% dengan subsampling 4:4:4 untuk ketajaman warna murni
      outputBuffer = await pipeline
        .jpeg({
          quality: 95,
          chromaSubsampling: '4:4:4',
          trellisQuantisation: true,
          overshootDeringing: true,
          optimizeScans: true,
        })
        .toBuffer();
      ext = 'jpg';
    }

    // Jika ukuran output masih di atas 8MB (batas gratis Discord), turunkan sedikit kualitas ke 88%
    if (outputBuffer.length > 8 * 1024 * 1024) {
      outputBuffer = await pipeline
        .jpeg({
          quality: 88,
          chromaSubsampling: '4:4:4',
        })
        .toBuffer();
      ext = 'jpg';
    }

    const elapsed = Date.now() - startTime;
    const finalMeta = await sharp(outputBuffer).metadata();

    return {
      success: true,
      buffer: outputBuffer,
      fileName: `hd_${finalMeta.width}x${finalMeta.height}_${Date.now()}.${ext}`,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      newWidth: finalMeta.width,
      newHeight: finalMeta.height,
      scale: scale,
      engine: 'Lanczos3 + Unsharp Mask (Local Studio)',
      processTimeMs: elapsed,
    };
  } catch (err) {
    console.error('[IMAGE HD ERROR]:', err);
    return {
      success: false,
      error: err.message || 'Gagal memproses gambar.',
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
