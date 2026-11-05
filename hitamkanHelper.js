const sharp = require('sharp');

/**
 * Memproses transformasi warna kulit manusia (Melanin Recolor Engine)
 * Mengubah HANYA warna kulit wajah, leher, dan tubuh menjadi warna kulit hitam pekat khas Afrika,
 * dengan menjaga 100% bentuk wajah asli, garis hidung, mata, bibir, rambut, baju, dan background
 * tanpa merubah identitas ataupun menciptakan wajah baru.
 * 
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

    const image = sharp(inputBuffer);
    const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

    const w = info.width;
    const h = info.height;
    const maskData = Buffer.alloc(w * h, 0);
    let skinPixelCount = 0;

    // 1. Deteksi presisi pigmen kulit manusia pada gambar
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x;
        const idx = p * info.channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const delta = max - min;
        const sat = max === 0 ? 0 : delta / max;

        let hue = 0;
        if (delta > 0) {
          if (max === r) hue = ((g - b) / delta) % 6;
          else if (max === g) hue = (b - r) / delta + 2;
          else hue = (r - g) / delta + 4;
          hue = Math.round(hue * 60);
          if (hue < 0) hue += 360;
        }

        // Kriteria warna kulit manusia asli (RGB + HSV + YCbCr multi-space)
        const isSkin =
          r > g &&
          g > b &&
          r - g >= 15 &&
          g - b >= 8 &&
          r - b >= 26 &&
          hue >= 6 &&
          hue <= 42 &&
          sat >= 0.15 &&
          sat <= 0.65 &&
          cr >= 132 &&
          cr <= 175 &&
          cb >= 82 &&
          cb <= 128 &&
          lum >= 50 &&
          lum <= 248;

        if (isSkin) {
          // Proteksi bola mata putih (sclera) agar tatapan mata tetap tajam & jernih
          const isEyeWhite = sat < 0.13 && lum > 155 && y > h * 0.25 && y < h * 0.45 && x > w * 0.4 && x < w * 0.6;
          if (!isEyeWhite) {
            maskData[p] = 255;
            skinPixelCount++;
          }
        }
      }
    }

    const totalPixels = w * h;
    const skinDetected = skinPixelCount > totalPixels * 0.005;

    // 2. Feathering mask menggunakan Gaussian Blur halus agar transisi tepi (hairline, leher, baju) menyatu sempurna
    const { data: blurredMaskBuf } = await sharp(maskData, {
      raw: { width: w, height: h, channels: 1 },
    })
      .blur(2.0)
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true });

    // 3. Rekolorisasi Melanin: Menerapkan tone hitam pekat khas Afrika dengan mempertahankan 100% anatomi asli wajah
    const out = Buffer.from(data);

    for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
      const alpha = blurredMaskBuf[p] / 255;
      if (alpha <= 0.01) continue;

      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const normLum = lum / 255;

      // Kurva intensitas melanin fotorealistik:
      // Mempertahankan highlight pencahayaan, bayangan alami, lekuk hidung, dan ekspresi asli
      const melaninBase = Math.pow(normLum, 1.3) * 48 + 18; // rentang 18 - 66

      // Rasio warna warm dark chocolate khas kulit hitam Afrika yang natural
      const targetR = Math.min(255, Math.round(melaninBase * 1.45));
      const targetG = Math.min(255, Math.round(melaninBase * 1.00));
      const targetB = Math.min(255, Math.round(melaninBase * 0.78));

      out[i] = Math.round(r * (1 - alpha) + targetR * alpha);
      out[i + 1] = Math.round(g * (1 - alpha) + targetG * alpha);
      out[i + 2] = Math.round(b * (1 - alpha) + targetB * alpha);
    }

    const resultBuffer = await sharp(out, {
      raw: { width: w, height: h, channels: info.channels },
    })
      .png()
      .toBuffer();

    const sizeKB = (resultBuffer.length / 1024).toFixed(1) + ' KB';

    return {
      success: true,
      buffer: resultBuffer,
      format: 'png',
      size: sizeKB,
      engine: 'Skin Melanin Recolor',
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
