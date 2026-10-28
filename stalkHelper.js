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
  if (str.includes('\u{1F7E2}') || str.toLowerCase() === 'true' || str.toLowerCase() === 'tersedia') {
    return 'Tersedia';
  }
  if (str.includes('\u{1F534}') || str.toLowerCase() === 'false' || str.toLowerCase() === 'tidak tersedia') {
    return 'Sudah Diklaim / Tidak Tersedia';
  }
  return str.replace(/[\u{1F7E2}\u{1F534}]/gu, '').trim() || 'Tidak Tersedia';
}

/**
 * Mencari nickname Mobile Legends melalui resolver terpercaya
 * Menggunakan endpoint isan.eu.org dengan fallback GoPay Games API
 */
async function resolveMlbbNickname(userId, zoneId) {
  const cleanId = String(userId).trim();
  const cleanZone = String(zoneId).trim();

  // 1. Coba resolver primer: isan.eu.org
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://mlbb-api.isan.eu.org/find?id=${encodeURIComponent(cleanId)}&zone=${encodeURIComponent(cleanZone)}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'FlyBot-Discord/2.0',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.name && data.name !== 'N/A') {
        return {
          nickname: String(data.name).trim(),
          countryCode: data.countryCode ? String(data.countryCode).toUpperCase() : null,
          countryName: data.countryName || null,
        };
      }
    }
  } catch (e) {}

  // 2. Fallback ke GoPay Games API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch('https://gopay.co.id/games/v1/order/user-account', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'FlyBot-Discord/2.0',
      },
      body: JSON.stringify({
        code: 'mobile-legends',
        data: { userId: cleanId, zoneId: cleanZone },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const username = data?.data?.username;
      if (username && username !== `${cleanId}${cleanZone}`) {
        return {
          nickname: String(username).trim(),
          countryCode: null,
          countryName: null,
        };
      }
    }
  } catch (e) {}

  return null;
}

/**
 * Stalk akun Mobile Legends (MLBB)
 * Menggabungkan nickname resolver dan status bundle & event promo top-up
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

  const startTime = Date.now();

  // Eksekusi paralel: Nickname Resolver dan Theresav API (untuk bundle & promo)
  const [nickResult, theresavResult] = await Promise.allSettled([
    resolveMlbbNickname(cleanUser, cleanServer),
    (async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
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
        if (!res.ok) return null;
        return await res.json();
      } catch (err) {
        clearTimeout(timeoutId);
        return null;
      }
    })(),
  ]);

  const nickData = nickResult.status === 'fulfilled' ? nickResult.value : null;
  const thData = theresavResult.status === 'fulfilled' ? theresavResult.value : null;

  // Jika kedua API tidak mengembalikan hasil apapun
  if (!nickData && (!thData || !thData.result)) {
    return {
      success: false,
      error: 'Akun Mobile Legends dengan ID tersebut tidak ditemukan atau server penyedia data sedang sibuk. Pastikan User ID dan Server ID sudah benar.',
    };
  }

  const thResult = thData?.result || {};
  const thProfile = thResult.profile || {};
  const thEvents = thResult.events || {};

  // Prioritaskan Nickname dari resolver (isan.eu.org / gopay)
  let nickname = nickData?.nickname;
  if (!nickname && thProfile.nickname && thProfile.nickname !== 'N/A') {
    nickname = thProfile.nickname;
  }
  if (!nickname) {
    nickname = 'Tidak Ditemukan / Privat';
  }

  // Tentukan Region / Negara
  const rawRegion = nickData?.countryCode || thEvents.region || thResult.region || 'ID';
  const regionName = nickData?.countryName || COUNTRY_NAMES[rawRegion.toUpperCase()] || rawRegion.toUpperCase();

  // Mapping Status Bundle
  const bundles = thEvents.bundlesStatus || {};
  const weeklyElite = cleanStatusSymbol(bundles['Weekly Elite Bundle']);
  const monthlyEpic = cleanStatusSymbol(bundles['Monthly Epic Bundle']);

  // Mapping Status Promo Event Top-Up
  const statusEvents = thEvents.status || {};
  const eventList = [];
  for (const [tier, statusVal] of Object.entries(statusEvents)) {
    eventList.push(`• Paket Diamond ${tier}: **${cleanStatusSymbol(statusVal)}**`);
  }

  const timeElapsed = `${((Date.now() - startTime) / 1000).toFixed(2)} detik`;

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
      timeTaken: thData?.time_taken || timeElapsed,
    },
  };
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
