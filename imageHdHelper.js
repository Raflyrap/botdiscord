const sharp = require('sharp');

/**
 * Helper untuk meningkatkan kualitas gambar secara lokal (Upscale & Sharpening)
 * Menggunakan algoritma Lanczos3, Unsharp Mask Filter, dan Subsampling 4:4:4
 */

const MAX_INPUT_BYTES = 15 * 1024 * 1024; // Maksimal input 15MB
const MAX_DIMENSION = 4096; // Maksimal lebar/tinggi output 4096px agar hemat memori & aman di Discord

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

    // Hitung dimensi target baru
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
};
