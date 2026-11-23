/**
 * Helper untuk Pencarian Gambar Pinterest menggunakan API Siputzx
 * Endpoint: https://api.siputzx.my.id/api/s/pinterest?query=...&type=image
 */

/**
 * Mencari gambar di Pinterest
 * @param {string} query - Kata kunci pencarian
 * @param {number} limit - Jumlah gambar yang dicari (min 5, max 50)
 * @returns {Promise<{success: boolean, images?: string[], total?: number, error?: string}>}
 */
async function searchPinterest(query, limit = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, error: 'Kata kunci pencarian tidak boleh kosong.' };
  }

  const cleanLimit = Math.max(5, Math.min(parseInt(limit, 10) || 5, 50));

  try {
    const apiUrl = `https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query.trim())}&type=image`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { success: false, error: `Server API Pinterest mengembalikan status ${res.status}` };
    }

    const data = await res.json();
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data?.result) ? data.result : [];
    const images = items
      .map((item) => (typeof item === 'string' ? item : item?.image_url || item?.images_url || item?.url || null))
      .filter((u) => typeof u === 'string' && u.startsWith('http'))
      .slice(0, cleanLimit);

    if (images.length > 0) {
      return {
        success: true,
        images,
        total: images.length,
      };
    }

    return {
      success: false,
      error: data?.error || data?.message || `Tidak ditemukan gambar di Pinterest untuk kata kunci "${query}".`,
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Pencarian Pinterest melebihi batas waktu (timeout).' };
    }
    return { success: false, error: err.message };
  }
}

module.exports = {
  searchPinterest,
};
