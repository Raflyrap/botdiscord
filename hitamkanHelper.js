const sharp = require('sharp');

/**
 * Memproses gambar untuk mengubah tone kulit wajah & tubuh menjadi hitam pekat (African dark skin tone)
 * secara presisi tanpa mempengaruhi warna baju, rambut, tembok, atau background.
 * @param {string|Buffer} input - URL gambar atau Buffer
 * @returns {Promise<{success: boolean, buffer?: Buffer, format?: string, size?: string, error?: string}>}
 */
async function hitamkanImage(input) {
  try {
    let inputBuffer;
    if (Buffer.isBuffer(input)) {
      inputBuffer = input;
    } else if (typeof input === 'string' && input.startsWith('http')) {
      const res = await fetch(input, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        signal: AbortSignal.timeout(15000),
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

    let skinCount = 0;

    // Iterasi setiap pixel RGBA / RGB
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Ruang warna YCbCr
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

      // Ruang warna HSV
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

      // Deteksi presisi kulit manusia (Face & Skin Detector)
      // Kulit manusia alami memiliki dominansi R > G > B dengan selisih yang konsisten
      const isRgbSkin = (r > g) && (g > b) && (r - g >= 15) && (g - b >= 8) && (r - b >= 26);
      const isHueSkin = (h >= 0 && h <= 45) || (h >= 350 && h <= 360);
      const isSatSkin = s >= 0.13 && s <= 0.72;
      const isYCbCrSkin = cb >= 75 && cb <= 132 && cr >= 130 && cr <= 180 && y >= 45;

      let skinWeight = 0;
      if (isRgbSkin && isHueSkin && isSatSkin) {
        skinWeight = 1.0;
      } else if (isYCbCrSkin && (r > g) && (g >= b) && (r - b >= 20)) {
        skinWeight = 0.85;
      }

      // Filter pengecualian (bukan kulit):
      // - Saturasi terlalu pekat / neon (baju bermotif warna-warni)
      // - Terlalu gelap (rambut hitam, mata, alis, bayangan pekat)
      if (s > 0.75 || y < 40) {
        skinWeight = 0;
      }

      if (skinWeight > 0) {
        skinCount++;
        // Hitamkan ke tone kulit Afrika (Deep African Melanin Skin Tone)
        // Menjaga bayangan & kontur alami wajah dengan interpolasi pencahayaan
        const relY = Math.min(1.0, Math.max(0.0, y / 255));
        const targetR = Math.round(15 + relY * 30); // ~15-45
        const targetG = Math.round(10 + relY * 20); // ~10-30
        const targetB = Math.round(7 + relY * 15);  // ~7-22

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
    const sizeKB = (outputBuffer.length / 1024).toFixed(1) + ' KB';

    return {
      success: true,
      buffer: outputBuffer,
      format: 'png',
      size: sizeKB,
      skinDetected: skinCount > 0,
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
