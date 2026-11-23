/**
 * Helper Generator Meme & Canvas Estetik menggunakan API Siputzx (https://api.siputzx.my.id)
 * Mendukung: Brat (PNG/GIF), Fake Tweet, Ship, Sertifikat, Batslap, Kiss,
 * Spotify Card, Gay Meter, dan 8 Efek Foto/Avatar (Facepalm, Beautiful, Delete, Affect, Blur, Greyscale, Invert, Circle).
 */

const BASE_URL = 'https://api.siputzx.my.id';
const DEFAULT_SHIP_BG = 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?q=80&w=1080&auto=format&fit=crop';

/**
 * Mengambil gambar buffer dari endpoint Siputzx Canvas/Meme
 * @param {string} endpointPath - contoh '/api/m/brat'
 * @param {Record<string, string|number|boolean|undefined>} params
 * @param {string} defaultExt - 'png' | 'jpg' | 'gif'
 */
async function fetchSiputzxImage(endpointPath, params = {}, defaultExt = 'png') {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) {
      qs.set(k, String(v));
    }
  }

  const url = `${BASE_URL}${endpointPath}?${qs.toString()}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyBot/2.0' },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`API Siputzx mengembalikan status HTTP ${res.status}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('image/')) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Respon bukan gambar (${contentType || 'unknown'}): ${errText.slice(0, 120)}`);
  }

  let ext = defaultExt;
  if (contentType.includes('gif')) ext = 'gif';
  else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
  else if (contentType.includes('png')) ext = 'png';
  else if (contentType.includes('webp')) ext = 'webp';

  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer || buffer.length < 100) {
    throw new Error('Gambar hasil dari API kosong atau rusak.');
  }

  return {
    success: true,
    buffer,
    ext,
    fileName: `flybot_meme_${Date.now()}.${ext}`,
    size: `${(buffer.length / 1024).toFixed(1)} KB`,
  };
}

module.exports = {
  DEFAULT_SHIP_BG,
  fetchSiputzxImage,
};
