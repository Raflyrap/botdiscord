/**
 * Helper untuk Pencarian Gambar Pinterest menggunakan API Snowping
 * Endpoint: https://api.snowping.cfd/api/search/pinterest?query=...&limit=...
 */

/**
 * Mencari gambar di Pinterest
 * @param {string} query - Kata kunci pencarian
 * @param {number} limit - Jumlah gambar yang dicari (min 5, max 50)
 * @returns {Promise<{success: boolean, images?: string[], error?: string}>}
 */
async function searchPinterest(query, limit = 5) {
  if (!query || typeof query !== 'string' || !query.trim()) {
    return { success: false, error: 'Kata kunci pencarian tidak boleh kosong.' };
  }

  const cleanLimit = Math.max(5, Math.min(parseInt(limit, 10) || 5, 50));

  try {
    const apiUrl = `https://api.snowping.cfd/api/search/pinterest?query=${encodeURIComponent(query.trim())}&limit=${cleanLimit}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

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
    if (data && data.status === 200 && Array.isArray(data.result) && data.result.length > 0) {
      return {
        success: true,
        images: data.result,
        total: data.result.length,
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

