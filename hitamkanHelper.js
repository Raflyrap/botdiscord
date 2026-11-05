const sharp = require('sharp');
const { OpenAI, toFile } = require('openai');

let openaiClient = null;
function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Memproses transformasi warna kulit manusia menggunakan AI photorealistic (OpenAI Image Engine)
 * Mengubah warna kulit wajah & tubuh menjadi hitam pekat khas Afrika secara natural dan realistis,
 * dengan tetap mempertahankan bentuk wajah, baju, rambut, dan background.
 * @param {Buffer} inputBuffer
 * @returns {Promise<Buffer|null>}
 */
async function processWithAi(inputBuffer) {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    // Resize agar sesuai rekomendasi dan hemat kuota/waktu pemrosesan
    const resizedBuffer = await sharp(inputBuffer)
      .resize(1024, 1024, { fit: 'inside' })
      .png()
      .toBuffer();

    const file = await toFile(resizedBuffer, 'input.png', { type: 'image/png' });

    const res = await client.images.edit({
      model: 'gpt-image-1-mini',
      image: file,
      prompt:
        'Transform only the skin tone of the person into a natural, photorealistic dark African black skin tone. ' +
        'Preserve the exact facial structure, eyes, hair, clothes pattern and colors, and the background completely unchanged.',
    });

    if (res?.data?.[0]?.b64_json) {
      return Buffer.from(res.data[0].b64_json, 'base64');
    }

    if (res?.data?.[0]?.url) {
      const imgRes = await fetch(res.data[0].url);
      if (imgRes.ok) {
        const arr = await imgRes.arrayBuffer();
        return Buffer.from(arr);
      }
    }
  } catch (err) {
    console.warn('[HITAMKAN AI WARNING]:', err.message || err);
  }

  return null;
}

/**
 * Fallback algoritma lokal jika AI offline atau kuota habis:
 * Memproses gambar pixel-by-pixel dengan deteksi multi-ruang warna (RGB + HSV + YCbCr)
 * @param {Buffer} inputBuffer
 * @returns {Promise<{buffer: Buffer, skinDetected: boolean}>}
 */
async function processWithLocalSharp(inputBuffer) {
  const image = sharp(inputBuffer);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  let skinCount = 0;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const s = max === 0 ? 0 : delta / max;

    let h = 0;
    if (delta > 0) {
      if (max === r) h = ((g - b) / delta) % 6;
      else if (max === g) h = (b - r) / delta + 2;
      else h = (r - g) / delta + 4;
      h = Math.round(h * 60);
      if (h < 0) h += 360;
    }

    const isRgbSkin = r > g && g > b && r - g >= 15 && g - b >= 8 && r - b >= 26;
    const isHueSkin = (h >= 0 && h <= 45) || (h >= 350 && h <= 360);
    const isSatSkin = s >= 0.13 && s <= 0.72;
    const isYCbCrSkin = cb >= 75 && cb <= 132 && cr >= 130 && cr <= 180 && y >= 45;

    let skinWeight = 0;
    if (isRgbSkin && isHueSkin && isSatSkin) {
      skinWeight = 1.0;
    } else if (isYCbCrSkin && r > g && g >= b && r - b >= 20) {
      skinWeight = 0.85;
    }

    if (s > 0.75 || y < 40) {
      skinWeight = 0;
    }

    if (skinWeight > 0) {
      skinCount++;
      const relY = Math.min(1.0, Math.max(0.0, y / 255));
      const targetR = Math.round(15 + relY * 30);
      const targetG = Math.round(10 + relY * 20);
      const targetB = Math.round(7 + relY * 15);

      data[i] = Math.round(r * (1 - skinWeight) + targetR * skinWeight);
      data[i + 1] = Math.round(g * (1 - skinWeight) + targetG * skinWeight);
      data[i + 2] = Math.round(b * (1 - skinWeight) + targetB * skinWeight);
    }
  }

  const finalSharp = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  });

  const outputBuffer = await finalSharp.png().toBuffer();
  return {
    buffer: outputBuffer,
    skinDetected: skinCount > 0,
  };
}

/**
 * Memproses gambar untuk mengubah tone kulit menjadi hitam fotorealistik (AI First dengan Sharp Fallback)
 * @param {string|Buffer} input - URL gambar atau Buffer
 * @returns {Promise<{success: boolean, buffer?: Buffer, format?: string, size?: string, engine?: string, skinDetected?: boolean, error?: string}>}
 */
async function hitamkanImage(input) {
  try {
    let inputBuffer;
    if (Buffer.isBuffer(input)) {
      inputBuffer = input;
    } else if (typeof input === 'string' && input.startsWith('http')) {
      const res = await fetch(input, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        throw new Error(`Gagal mengunduh gambar (HTTP ${res.status})`);
      }
      const arrayBuf = await res.arrayBuffer();
      inputBuffer = Buffer.from(arrayBuf);
    } else {
      throw new Error('Format input gambar tidak valid');
    }

    let finalBuffer = null;
    let engineUsed = 'AI Neural Engine';
    let skinDetected = true;

    // 1. Coba proses via AI Photorealistic terlebih dahulu
    try {
      finalBuffer = await processWithAi(inputBuffer);
    } catch (aiErr) {
      console.warn('[HITAMKAN] AI processing failed, switching to local engine:', aiErr.message);
    }

    // 2. Jika AI gagal atau tidak tersedia, fallback ke local Sharp processor
    if (!finalBuffer) {
      engineUsed = 'Local Color Engine';
      const localResult = await processWithLocalSharp(inputBuffer);
      finalBuffer = localResult.buffer;
      skinDetected = localResult.skinDetected;
    }

    const sizeKB = (finalBuffer.length / 1024).toFixed(1) + ' KB';

    return {
      success: true,
      buffer: finalBuffer,
      format: 'png',
      size: sizeKB,
      engine: engineUsed,
      skinDetected,
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Terjadi kesalahan saat memproses efek hitamkan.',
    };
  }
}

module.exports = {
  hitamkanImage,
};
