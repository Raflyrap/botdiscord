const MLBB_API_KEY = process.env.MLBB_API_KEY || 'PQiwU';

const COUNTRY_NAMES = {
  ID: 'Indonesia',
  BR: 'Brazil',
  PH: 'Filipina',
  MY: 'Malaysia',
  SG: 'Singapura',
  TH: 'Thailand',
  VN: 'Vietnam',
  KH: 'Kamboja',
  MM: 'Myanmar',
  US: 'Amerika Serikat',
  RU: 'Rusia',
  TR: 'Turki',
  IN: 'India',
  JP: 'Jepang',
  KR: 'Korea Selatan',
};

/**
 * Mengubah simbol status dari API pihak ketiga menjadi teks bersih tanpa emoji
 */
function cleanStatusSymbol(val) {
  if (!val) return 'Tidak Tersedia';
  const str = String(val).trim();
  if (str.includes('🟢') || str.toLowerCase() === 'true' || str.toLowerCase() === 'tersedia') {
    return 'Tersedia';
  }
  if (str.includes('🔴') || str.toLowerCase() === 'false' || str.toLowerCase() === 'tidak tersedia') {
    return 'Sudah Diklaim / Tidak Tersedia';
  }
  return str.replace(/[🟢🔴]/g, '').trim() || 'Tidak Tersedia';
}

/**
 * Stalk akun Mobile Legends (MLBB)
 * Menggunakan API theresav.eu dengan fallback timeout 20 detik
 */
async function stalkMlbb(userId, serverId) {
  const cleanUser = String(userId).trim();
  const cleanServer = String(serverId).trim();

  if (!cleanUser || !cleanServer) {
    return {
      success: false,
      error: 'User ID dan Server/Zone ID tidak boleh kosong.',
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const url = `https://api.theresav.eu/api/stalk/mlbb?userId=${encodeURIComponent(cleanUser)}&serverId=${encodeURIComponent(cleanServer)}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-apikey': MLBB_API_KEY,
        'User-Agent': 'FlyBot-Discord/2.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      return {
        success: false,
        error: `Server penyedia API merespons dengan status HTTP ${res.status}.`,
      };
    }

    const data = await res.json();
    if (!data || !data.result) {
      return {
        success: false,
        error: data?.error || 'Gagal memproses data akun Mobile Legends dari server penyedia.',
      };
    }

    const result = data.result;
    const profile = result.profile || {};
    const events = result.events || {};
    const rawRegion = events.region || result.region || 'ID';
    const regionName = COUNTRY_NAMES[rawRegion.toUpperCase()] || rawRegion.toUpperCase();

    // Mapping Status Bundle
    const bundles = events.bundlesStatus || {};
    const weeklyElite = cleanStatusSymbol(bundles['Weekly Elite Bundle']);
    const monthlyEpic = cleanStatusSymbol(bundles['Monthly Epic Bundle']);

    // Mapping Status Promo Event Top-Up
    const statusEvents = events.status || {};
    const eventList = [];
    for (const [tier, statusVal] of Object.entries(statusEvents)) {
      eventList.push(`• Paket Diamond ${tier}: **${cleanStatusSymbol(statusVal)}**`);
    }

    const nickname = profile.nickname && profile.nickname !== 'N/A' ? profile.nickname : 'Privat / Tidak Ditemukan';

    return {
      success: true,
      data: {
        userId: cleanUser,
        serverId: cleanServer,
        nickname,
        regionCode: rawRegion.toUpperCase(),
        regionName,
        weeklyElite,
        monthlyEpic,
        eventList,
        timeTaken: data.time_taken || 'Selesai',
      },
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      return {
        success: false,
        error: 'Pencarian akun MLBB memakan waktu terlalu lama (batas waktu 20 detik terlampaui). Silakan coba lagi.',
      };
    }
    return {
      success: false,
      error: `Terjadi kendala koneksi ke server API: ${err.message}`,
    };
  }
}

/**
 * Stalk akun Roblox berdasarkan Username
 * Menggunakan official public Roblox API
 */
async function stalkRoblox(username) {
  const cleanUsername = String(username).trim();
  if (!cleanUsername) {
    return {
      success: false,
      error: 'Username pemain Roblox tidak boleh kosong.',
    };
  }

  try {
    // 1. Dapatkan User ID dari Username
    const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usernames: [cleanUsername],
        excludeBannedUsers: false,
      }),
    });

    if (!searchRes.ok) {
      return {
        success: false,
        error: `Gagal mencari pemain di database Roblox (HTTP ${searchRes.status}).`,
      };
    }

    const searchData = await searchRes.json();
    const userSummary = searchData?.data?.[0];

    if (!userSummary || !userSummary.id) {
      return {
        success: false,
        error: `Akun Roblox dengan username "${cleanUsername}" tidak ditemukan.`,
      };
    }

    const userId = userSummary.id;

    // 2. Ambil detail profil, render avatar 3D, dan status online secara paralel
    const [detailsRes, avatarRes, presenceRes] = await Promise.all([
      fetch(`https://users.roblox.com/v1/users/${userId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`).then((r) => (r.ok ? r.json() : null)),
      fetch('https://presence.roblox.com/v1/presence/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: [userId] }),
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const details = detailsRes || {};
    const avatarUrl = avatarRes?.data?.[0]?.imageUrl || null;
    const presenceItem = presenceRes?.userPresences?.[0] || {};

    let statusText = 'Offline';
    if (presenceItem.userPresenceType === 1) {
      statusText = 'Online di Website / Aplikasi';
    } else if (presenceItem.userPresenceType === 2) {
      statusText = presenceItem.lastLocation ? `Sedang Bermain Game: ${presenceItem.lastLocation}` : 'Sedang Bermain Game';
    } else if (presenceItem.userPresenceType === 3) {
      statusText = 'Sedang Membuka Roblox Studio';
    }

    return {
      success: true,
      data: {
        userId,
        username: details.name || userSummary.name,
        displayName: details.displayName || userSummary.displayName,
        description: details.description || 'Tidak ada biodata pada profil akun ini.',
        createdAt: details.created ? Math.floor(new Date(details.created).getTime() / 1000) : null,
        isBanned: details.isBanned ? 'Terbanned' : 'Aktif Normal',
        hasVerifiedBadge: userSummary.hasVerifiedBadge ? 'Terverifikasi' : 'Belum Terverifikasi',
        avatarUrl,
        statusText,
        profileUrl: `https://www.roblox.com/users/${userId}/profile`,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: `Terjadi kendala saat mengambil data akun Roblox: ${err.message}`,
    };
  }
}

module.exports = {
  stalkMlbb,
  stalkRoblox,
};
