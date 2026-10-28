const sharp = require('sharp');

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function truncate(str, max = 22) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

/**
 * Unduh avatar member secara aman atau buat fallback bulat jika gagal
 */
async function getRoundedAvatar(member, size = 160) {
  const radius = Math.floor(size / 2);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="#000"/></svg>`
  );

  try {
    const avatarUrl = member.displayAvatarURL
      ? member.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 })
      : member.user?.displayAvatarURL({ extension: 'png', forceStatic: true, size: 256 });

    if (avatarUrl) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(avatarUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const rawBuf = Buffer.from(arrayBuf);
        return await sharp(rawBuf)
          .resize(size, size)
          .composite([{ input: mask, blend: 'dest-in' }])
          .png()
          .toBuffer();
      }
    }
  } catch (err) {
    // Fallback
  }

  // Fallback avatar
  const initial = escapeXml((member.displayName || member.user?.username || 'M').charAt(0).toUpperCase());
  const fallbackSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fallbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6"/>
          <stop offset="100%" stop-color="#8b5cf6"/>
        </linearGradient>
      </defs>
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="url(#fallbg)"/>
      <text x="${radius}" y="${radius + 22}" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
    </svg>`
  );
  return await sharp(fallbackSvg).png().toBuffer();
}

/**
 * Buat Banner Selamat Datang (Welcome Card) - Desain Modern & Estetik
 */
async function generateWelcomeBanner(member) {
  const guild = member.guild;
  const rawDisplayName = member.displayName || member.user?.username || 'Member';
  const rawUsername = member.user?.tag || member.user?.username || rawDisplayName;
  const rawServerName = guild?.name || 'Discord Server';

  const displayName = escapeXml(truncate(rawDisplayName, 20));
  const username = escapeXml(truncate('@' + rawUsername.replace('#0', ''), 26));
  const serverName = escapeXml(truncate(rawServerName.toUpperCase(), 28));
  const memberCount = guild?.memberCount ? guild.memberCount.toLocaleString('id-ID') : '1';

  const avatarSize = 150;
  const avatarBuffer = await getRoundedAvatar(member, avatarSize);

  // Avatar center: cx=512, cy=130 -> top=55, left=437
  const bgSvg = Buffer.from(
    `<svg width="1024" height="450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Background Gradients -->
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#050811"/>
          <stop offset="45%" stop-color="#0f172a"/>
          <stop offset="100%" stop-color="#070b16"/>
        </linearGradient>

        <!-- Inner Glass Card Gradient -->
        <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#1e293b" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0.75"/>
        </linearGradient>

        <!-- Accent Gradients -->
        <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#00f2fe"/>
          <stop offset="100%" stop-color="#4facfe"/>
        </linearGradient>

        <linearGradient id="neonPurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#c084fc"/>
        </linearGradient>

        <!-- Ambient Glow Radians -->
        <radialGradient id="glowTop" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.32"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="glowBottom" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stop-color="#818cf8" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#818cf8" stop-opacity="0"/>
        </radialGradient>

        <!-- Drop Shadow Filter -->
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>

      <!-- Main Outer Container -->
      <rect width="1024" height="450" fill="url(#bgGrad)" rx="28"/>
      <rect width="1024" height="450" fill="url(#glowTop)" rx="28"/>
      <rect width="1024" height="450" fill="url(#glowBottom)" rx="28"/>

      <!-- Outer Border Subtle Stroke -->
      <rect x="2" y="2" width="1020" height="446" fill="none" stroke="url(#neonPurple)" stroke-width="2" stroke-opacity="0.4" rx="26"/>

      <!-- Glassmorphism Inner Container -->
      <rect x="36" y="30" width="952" height="390" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.2" stroke-opacity="0.6" rx="22" filter="url(#shadow)"/>

      <!-- Decorative Cyber Lines -->
      <line x1="70" y1="230" x2="350" y2="230" stroke="url(#neonCyan)" stroke-width="2" stroke-opacity="0.6"/>
      <line x1="674" y1="230" x2="954" y2="230" stroke="url(#neonCyan)" stroke-width="2" stroke-opacity="0.6"/>
      <circle cx="350" cy="230" r="4" fill="#00f2fe"/>
      <circle cx="674" cy="230" r="4" fill="#00f2fe"/>

      <!-- Avatar Outer Neon Ring -->
      <circle cx="512" cy="130" r="86" fill="none" stroke="url(#neonPurple)" stroke-width="4" stroke-opacity="0.95"/>
      <circle cx="512" cy="130" r="80" fill="none" stroke="#0f172a" stroke-width="3"/>

      <!-- Welcome Badge Pill -->
      <rect x="322" y="238" width="380" height="32" rx="16" fill="#1e1b4b" stroke="#818cf8" stroke-width="1.2" stroke-opacity="0.8"/>
      <text x="512" y="259" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="2">WELCOME TO ${serverName}</text>

      <!-- Member Display Name -->
      <text x="512" y="318" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">${displayName}</text>

      <!-- Member Username -->
      <text x="512" y="352" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="500" fill="#94a3b8" text-anchor="middle">${username}</text>

      <!-- Member Count Badge -->
      <rect x="402" y="374" width="220" height="28" rx="14" fill="#090d16" stroke="#38bdf8" stroke-width="1" stroke-opacity="0.5"/>
      <text x="512" y="393" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#a5b4fc" text-anchor="middle" letter-spacing="1">MEMBER KE #${memberCount}</text>
    </svg>`
  );

  return await sharp(bgSvg)
    .composite([{ input: avatarBuffer, top: 55, left: 437 }])
    .png()
    .toBuffer();
}

/**
 * Buat Banner Perpisahan (Leave Card) - Desain Modern & Estetik
 */
async function generateLeaveBanner(member) {
  const guild = member.guild;
  const rawDisplayName = member.displayName || member.user?.username || 'Member';
  const rawUsername = member.user?.tag || member.user?.username || rawDisplayName;
  const rawServerName = guild?.name || 'Discord Server';

  const displayName = escapeXml(truncate(rawDisplayName, 20));
  const username = escapeXml(truncate('@' + rawUsername.replace('#0', ''), 26));
  const serverName = escapeXml(truncate(rawServerName.toUpperCase(), 28));
  const remainingCount = guild?.memberCount ? guild.memberCount.toLocaleString('id-ID') : '0';

  const avatarSize = 150;
  const avatarBuffer = await getRoundedAvatar(member, avatarSize);

  // Avatar center: cx=512, cy=130 -> top=55, left=437
  const bgSvg = Buffer.from(
    `<svg width="1024" height="450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Background Gradients -->
        <linearGradient id="leaveBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0a0d"/>
          <stop offset="45%" stop-color="#181318"/>
          <stop offset="100%" stop-color="#0d0a0d"/>
        </linearGradient>

        <!-- Inner Glass Card Gradient -->
        <linearGradient id="leaveCardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#271a22" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#140f13" stop-opacity="0.75"/>
        </linearGradient>

        <!-- Accent Crimson Gradient -->
        <linearGradient id="neonRose" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#ff0844"/>
          <stop offset="100%" stop-color="#ffb199"/>
        </linearGradient>

        <linearGradient id="roseRing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f43f5e"/>
          <stop offset="50%" stop-color="#fb7185"/>
          <stop offset="100%" stop-color="#fda4af"/>
        </linearGradient>

        <!-- Ambient Lights -->
        <radialGradient id="leaveGlowTop" cx="50%" cy="0%" r="60%">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="#f43f5e" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="leaveGlowBottom" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stop-color="#e11d48" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#e11d48" stop-opacity="0"/>
        </radialGradient>

        <!-- Drop Shadow Filter -->
        <filter id="shadowLeave" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.5"/>
        </filter>
      </defs>

      <!-- Main Outer Container -->
      <rect width="1024" height="450" fill="url(#leaveBg)" rx="28"/>
      <rect width="1024" height="450" fill="url(#leaveGlowTop)" rx="28"/>
      <rect width="1024" height="450" fill="url(#leaveGlowBottom)" rx="28"/>

      <!-- Outer Border Subtle Stroke -->
      <rect x="2" y="2" width="1020" height="446" fill="none" stroke="url(#roseRing)" stroke-width="2" stroke-opacity="0.4" rx="26"/>

      <!-- Glassmorphism Inner Container -->
      <rect x="36" y="30" width="952" height="390" fill="url(#leaveCardGrad)" stroke="#4c1d29" stroke-width="1.2" stroke-opacity="0.6" rx="22" filter="url(#shadowLeave)"/>

      <!-- Decorative Lines -->
      <line x1="70" y1="230" x2="350" y2="230" stroke="url(#neonRose)" stroke-width="2" stroke-opacity="0.6"/>
      <line x1="674" y1="230" x2="954" y2="230" stroke="url(#neonRose)" stroke-width="2" stroke-opacity="0.6"/>
      <circle cx="350" cy="230" r="4" fill="#ff0844"/>
      <circle cx="674" cy="230" r="4" fill="#ff0844"/>

      <!-- Avatar Outer Neon Ring -->
      <circle cx="512" cy="130" r="86" fill="none" stroke="url(#roseRing)" stroke-width="4" stroke-opacity="0.95"/>
      <circle cx="512" cy="130" r="80" fill="none" stroke="#18181b" stroke-width="3"/>

      <!-- Goodbye Badge Pill -->
      <rect x="322" y="238" width="380" height="32" rx="16" fill="#2d1218" stroke="#f43f5e" stroke-width="1.2" stroke-opacity="0.8"/>
      <text x="512" y="259" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="bold" fill="#fda4af" text-anchor="middle" letter-spacing="2">GOODBYE FROM ${serverName}</text>

      <!-- Member Display Name -->
      <text x="512" y="318" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">${displayName}</text>

      <!-- Member Username -->
      <text x="512" y="352" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="18" font-weight="500" fill="#a1a1aa" text-anchor="middle">${username}</text>

      <!-- Remaining Member Badge -->
      <rect x="362" y="374" width="300" height="28" rx="14" fill="#140a0e" stroke="#f43f5e" stroke-width="1" stroke-opacity="0.5"/>
      <text x="512" y="393" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="bold" fill="#fca5a5" text-anchor="middle" letter-spacing="1">SAMPAI JUMPA LAGI • SISA ${remainingCount} MEMBER</text>
    </svg>`
  );

  return await sharp(bgSvg)
    .composite([{ input: avatarBuffer, top: 55, left: 437 }])
    .png()
    .toBuffer();
}

module.exports = {
  generateWelcomeBanner,
  generateLeaveBanner,
};
