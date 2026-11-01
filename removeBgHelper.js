/**
 * Helper untuk Remove Background menggunakan API Snowping
 * Endpoint: https://api.snowping.cfd/api/tools/removebg?url=...
 */

/**
 * Hapus background dari gambar
 * @param {string} imageUrl - URL gambar yang ingin dihapus background-nya
 * @returns {Promise<{success: boolean, resultUrl?: string, size?: string, mimetype?: string, error?: string}>}
 */
async function removeBgImage(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return { success: false, error: 'URL gambar tidak valid.' };
  }

  try {
    const apiUrl = `https://api.snowping.cfd/api/tools/removebg?url=${encodeURIComponent(imageUrl.trim())}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Server API mengembalikan status ${res.statusCode || res.status}` };
    }

    const data = await res.json();
    if (data && data.status === 200 && data.result?.url) {
      return {
        success: true,
        resultUrl: data.result.url,
        size: data.result.size || 'N/A',
        mimetype: data.result.mimetype || 'image/png',
        format: data.result.format || 'png',
        responseTime: data.responsTime || data.responseTime || null,
      };
    }

    return {
      success: false,
      error: data?.error || data?.message || 'Gagal memproses penghapusan background gambar.',
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Proses remove background melebihi batas waktu (timeout).' };
    }
    return { success: false, error: err.message };
  }
}

module.exports = {
  removeBgImage,
};

