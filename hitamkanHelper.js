const sharp = require('sharp');

/**
 * Memproses gambar untuk mengubah tone wajah/kulit terang menjadi gelap/hitam
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
    const totalPixels = info.width * info.height;

    // Iterasi setiap pixel RGBA / RGB
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Deteksi warna kulit manusia (Kombinasi model RGB & YCbCr)
      const rgbSkin =
        r > 65 &&
        g > 25 &&
        b > 15 &&
        r - g >= 6 &&
        r > b &&
        Math.max(r, g, b) - Math.min(r, g, b) >= 6;

      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const ycbcrSkin = cb >= 60 && cb <= 145 && cr >= 115 && cr <= 190 && y > 25;

      if (rgbSkin || ycbcrSkin) {
        skinCount++;
        // Transformasi warna kulit menjadi hitam/gelap natural (Melanin Enhancement)
        data[i] = Math.max(10, Math.floor(r * 0.22));
        data[i + 1] = Math.max(8, Math.floor(g * 0.18));
        data[i + 2] = Math.max(6, Math.floor(b * 0.14));
      }
    }

    let finalSharp = sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    });

    // Fallback: Jika sedikit/tidak ada pixel kulit terdeteksi (misal anime, ilustrasi, lighting khusus),
    // aplikasikan dark tone filter agar gambar tetap terhitamkan secara dramatis
    if (skinCount < totalPixels * 0.03) {
      finalSharp = finalSharp.modulate({
        brightness: 0.38,
        saturation: 0.75,
      });
    }

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
