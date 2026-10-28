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

function truncate(str, max = 24) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

/**
 * Unduh avatar member secara aman atau buat fallback bulat jika gagal
 */
async function getRoundedAvatar(member, size = 170) {
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
    // Abaikan dan gunakan fallback
  }

  // Fallback: Lingkaran warna default dengan inisial
  const initial = escapeXml((member.displayName || member.user?.username || 'M').charAt(0).toUpperCase());
  const fallbackSvg = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="fallbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <circle cx="${radius}" cy="${radius}" r="${radius}" fill="url(#fallbg)"/>
      <text x="${radius}" y="${radius + 20}" font-family="Arial, sans-serif" font-size="70" font-weight="bold" fill="#ffffff" text-anchor="middle">${initial}</text>
    </svg>`
  );
  return await sharp(fallbackSvg).png().toBuffer();
}

/**
 * Buat Banner Selamat Datang (Welcome Card)
 */
async function generateWelcomeBanner(member) {
  const guild = member.guild;
  const rawDisplayName = member.displayName || member.user?.username || 'Member';
  const rawUsername = member.user?.tag || member.user?.username || rawDisplayName;
  const rawServerName = guild?.name || 'Discord Server';

  const displayName = escapeXml(truncate(rawDisplayName, 22));
  const username = escapeXml(truncate('@' + rawUsername.replace('#0', ''), 28));
  const serverName = escapeXml(truncate(rawServerName.toUpperCase(), 32));
  const memberCount = guild?.memberCount ? guild.memberCount.toLocaleString('id-ID') : '1';

  const avatarBuffer = await getRoundedAvatar(member, 170);

  const bgSvg = Buffer.from(
    `<svg width="1024" height="450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Background Gradient -->
        <linearGradient id="mainBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#070a13"/>
          <stop offset="50%" stop-color="#141933"/>
          <stop offset="100%" stop-color="#0a0d18"/>
        </linearGradient>

        <!-- Outer Ring Glow -->
        <linearGradient id="ringGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#38bdf8"/>
          <stop offset="50%" stop-color="#818cf8"/>
          <stop offset="100%" stop-color="#c084fc"/>
        </linearGradient>

        <!-- Ambient Lights -->
        <radialGradient id="ambLight1" cx="20%" cy="20%" r="50%">
          <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#6366f1" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="ambLight2" cx="80%" cy="80%" r="50%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
        </radialGradient>

        <!-- Card Outline -->
        <linearGradient id="borderStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.6"/>
          <stop offset="50%" stop-color="#818cf8" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#c084fc" stop-opacity="0.6"/>
        </linearGradient>
      </defs>

      <!-- Base Rectangle -->
      <rect width="1024" height="450" fill="url(#mainBg)" rx="32"/>

      <!-- Ambient Decorative Lights -->
      <rect width="1024" height="450" fill="url(#ambLight1)" rx="32"/>
      <rect width="1024" height="450" fill="url(#ambLight2)" rx="32"/>

      <!-- Border Frame -->
      <rect x="2" y="2" width="1020" height="446" fill="none" stroke="url(#borderStroke)" stroke-width="2.5" rx="30"/>

      <!-- Decorative Grid Lines -->
      <line x1="60" y1="225" x2="380" y2="225" stroke="#334155" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.4"/>
      <line x1="644" y1="225" x2="964" y2="225" stroke="#334155" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.4"/>

      <!-- Avatar Outer Ring -->
      <circle cx="512" cy="135" r="95" fill="none" stroke="url(#ringGlow)" stroke-width="4.5" opacity="0.9"/>
      <circle cx="512" cy="135" r="88" fill="none" stroke="#0f172a" stroke-width="3"/>

      <!-- Welcome Server Pill -->
      <rect x="312" y="246" width="400" height="34" rx="17" fill="#1e1b4b" stroke="#6366f1" stroke-width="1.5" opacity="0.95"/>
      <text x="512" y="269" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#38bdf8" text-anchor="middle" letter-spacing="2">WELCOME TO ${serverName}</text>

      <!-- Member Display Name -->
      <text x="512" y="332" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">${displayName}</text>

      <!-- Member Username (@handle) -->
      <text x="512" y="366" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#94a3b8" text-anchor="middle">${username}</text>

      <!-- Member Count Badge -->
      <rect x="392" y="392" width="240" height="32" rx="16" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <text x="512" y="413" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#a5b4fc" text-anchor="middle">MEMBER KE #${memberCount}</text>
    </svg>`
  );

  return await sharp(bgSvg)
    .composite([{ input: avatarBuffer, top: 50, left: 427 }])
    .png()
    .toBuffer();
}

/**
 * Buat Banner Perpisahan (Leave / Goodbye Card)
 */
async function generateLeaveBanner(member) {
  const guild = member.guild;
  const rawDisplayName = member.displayName || member.user?.username || 'Member';
  const rawUsername = member.user?.tag || member.user?.username || rawDisplayName;
  const rawServerName = guild?.name || 'Discord Server';

  const displayName = escapeXml(truncate(rawDisplayName, 22));
  const username = escapeXml(truncate('@' + rawUsername.replace('#0', ''), 28));
  const serverName = escapeXml(truncate(rawServerName.toUpperCase(), 32));
  const remainingCount = guild?.memberCount ? guild.memberCount.toLocaleString('id-ID') : '0';

  const avatarBuffer = await getRoundedAvatar(member, 170);

  const bgSvg = Buffer.from(
    `<svg width="1024" height="450" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Background Gradient -->
        <linearGradient id="leaveBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0a0a0c"/>
          <stop offset="50%" stop-color="#1c131d"/>
          <stop offset="100%" stop-color="#0f0d11"/>
        </linearGradient>

        <!-- Ambient Red/Rose Light -->
        <radialGradient id="leaveLight" cx="50%" cy="30%" r="60%">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="#f43f5e" stop-opacity="0"/>
        </radialGradient>

        <!-- Border Stroke -->
        <linearGradient id="leaveBorder" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.5"/>
          <stop offset="50%" stop-color="#71717a" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="#f43f5e" stop-opacity="0.5"/>
        </linearGradient>
      </defs>

      <!-- Base Rectangle -->
      <rect width="1024" height="450" fill="url(#leaveBg)" rx="32"/>
      <rect width="1024" height="450" fill="url(#leaveLight)" rx="32"/>

      <!-- Border Frame -->
      <rect x="2" y="2" width="1020" height="446" fill="none" stroke="url(#leaveBorder)" stroke-width="2" rx="30"/>

      <!-- Decorative Lines -->
      <line x1="60" y1="225" x2="380" y2="225" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.3"/>
      <line x1="644" y1="225" x2="964" y2="225" stroke="#3f3f46" stroke-width="1.5" stroke-dasharray="6,6" opacity="0.3"/>

      <!-- Avatar Outer Ring -->
      <circle cx="512" cy="135" r="95" fill="none" stroke="#f43f5e" stroke-width="4" opacity="0.85"/>
      <circle cx="512" cy="135" r="88" fill="none" stroke="#18181b" stroke-width="3"/>

      <!-- Goodbye Pill -->
      <rect x="312" y="246" width="400" height="34" rx="17" fill="#271418" stroke="#f43f5e" stroke-width="1.2" opacity="0.95"/>
      <text x="512" y="269" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="bold" fill="#fda4af" text-anchor="middle" letter-spacing="2">GOODBYE FROM ${serverName}</text>

      <!-- Member Display Name -->
      <text x="512" y="332" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#ffffff" text-anchor="middle">${displayName}</text>

      <!-- Member Username (@handle) -->
      <text x="512" y="366" font-family="Arial, Helvetica, sans-serif" font-size="20" fill="#a1a1aa" text-anchor="middle">${username}</text>

      <!-- Remaining Member Pill -->
      <rect x="362" y="392" width="300" height="32" rx="16" fill="#18181b" stroke="#3f3f46" stroke-width="1"/>
      <text x="512" y="413" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="bold" fill="#fca5a5" text-anchor="middle">SAMPAI JUMPA LAGI • SISA ${remainingCount} MEMBER</text>
    </svg>`
  );

  return await sharp(bgSvg)
    .composite([{ input: avatarBuffer, top: 50, left: 427 }])
    .png()
    .toBuffer();
}

module.exports = {
  generateWelcomeBanner,
  generateLeaveBanner,
};
