/**
 * Helper untuk Remove Background AI menggunakan Hugging Face Space (not-lain/background-removal)
 * Menghasilkan gambar PNG transparan murni secara akurat dan cepat tanpa API key berbayar.
 */

/**
 * Hapus background dari gambar
 * @param {string} imageUrl - URL gambar yang ingin dihapus background-nya
 * @returns {Promise<{success: boolean, buffer?: Buffer, resultUrl?: string, size?: string, mimetype?: string, format?: string, responseTime?: string, error?: string}>}
 */
async function removeBgImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { success: false, error: 'URL gambar tidak valid.' };
  }

  const startTime = Date.now();

  try {
    // 1. Unduh gambar sumber menjadi Blob
    const imgRes = await fetch(imageUrl.trim(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(20000),
    });

    if (!imgRes.ok) {
      return { success: false, error: `Gagal mengunduh gambar sumber (HTTP ${imgRes.status}).` };
    }

    const inputBlob = await imgRes.blob();

    // 2. Proses pemisahan background melalui Hugging Face AI Space (RMBG-2.0 / BiRefNet)
    const { Client } = await import('@gradio/client');
    const clientOptions = process.env.HF_TOKEN ? { token: process.env.HF_TOKEN } : {};
    const client = await Client.connect('not-lain/background-removal', clientOptions);

    const prediction = await client.predict('/png', { f: inputBlob });
    const fileInfo = Array.isArray(prediction?.data) ? prediction.data[0] : null;
    const resultUrl = typeof fileInfo === 'string' ? fileInfo : fileInfo?.url;

    if (!resultUrl) {
      return { success: false, error: 'Mesin AI tidak mengembalikan file gambar hasil remove background.' };
    }

    // 3. Unduh hasil PNG transparan ke Buffer agar bisa dilampirkan permanen di Discord
    const outRes = await fetch(resultUrl, { signal: AbortSignal.timeout(25000) });
    if (!outRes.ok) {
      return { success: false, error: `Gagal mengunduh hasil PNG transparan (HTTP ${outRes.status}).` };
    }

    const buffer = Buffer.from(await outRes.arrayBuffer());
    const sizeKB = (buffer.length / 1024).toFixed(1) + ' KB';
    const responseTime = ((Date.now() - startTime) / 1000).toFixed(1) + 's';

    return {
      success: true,
      buffer,
      resultUrl,
      size: sizeKB,
      mimetype: 'image/png',
      format: 'png',
      responseTime,
    };
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { success: false, error: 'Proses remove background melebihi batas waktu (timeout). Silakan coba lagi.' };
    }
    return { success: false, error: err.message || 'Gagal memproses penghapusan background gambar.' };
  }
}

module.exports = {
  removeBgImage,
};
