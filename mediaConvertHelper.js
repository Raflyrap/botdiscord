/**
 * Helper Konversi & Pengunduh Media Sosial Otomatis (Khusus Konten Video)
 * Mendukung TikTok Video (No Watermark), Instagram Reels/Video,
 * Facebook Video/Reels, dan YouTube Shorts/Videos.
 */

const {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { ttdl, igdl, fbdown, youtube, aio } = require('btch-downloader');

const DISCORD_MAX_BYTES = 24 * 1024 * 1024; // 24 MB batas upload bot Discord

const PLATFORM_INFO = {
  tiktok: {
    name: 'TikTok',
    channelKeyword: 'tiktok-convert',
    icon: '🎵',
    color: 0xFE2C55,
  },
  instagram: {
    name: 'Instagram',
    channelKeyword: 'instagram-convert',
    icon: '📸',
    color: 0xE1306C,
  },
  facebook: {
    name: 'Facebook',
    channelKeyword: 'facebook-convert',
    icon: '📘',
    color: 0x1877F2,
  },
  youtube: {
    name: 'YouTube',
    channelKeyword: 'youtube-convert',
    icon: '▶️',
    color: 0xFF0000,
  },
};

/**
 * Ekstrak URL dari pesan teks
 */
function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const matches = text.match(urlRegex) || [];
  return matches.map((u) => u.replace(/[),;.]+$/, ''));
}

/**
 * Deteksi platform dari URL
 */
function detectPlatform(url) {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram';
  if (u.includes('facebook.com') || u.includes('fb.watch') || u.includes('fb.com')) return 'facebook';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  return null;
}

/**
 * Cek platform apa yang diharapkan oleh channel berdasarkan namanya
 */
function getExpectedPlatform(channelName) {
  if (!channelName) return null;
  const name = channelName.toLowerCase();
  if (name.includes('tiktok-convert')) return 'tiktok';
  if (name.includes('instagram-convert')) return 'instagram';
  if (name.includes('facebook-convert')) return 'facebook';
  if (name.includes('youtube-convert')) return 'youtube';
  return null;
}

/**
 * Cek apakah sebuah channel adalah channel konversi sosmed
 */
function isConvertChannel(channelName) {
  return Boolean(getExpectedPlatform(channelName));
}

/**
 * Helper untuk mengunduh buffer dari URL dengan batas timeout
 */
async function fetchMediaBuffer(url, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: Gagal mengunduh file media`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Konversi & Download TikTok (Khusus Video)
 */
async function convertTikTok(url) {
  // 1. Coba ttdl dari btch-downloader
  try {
    const res = await ttdl(url);
    if (res && res.status) {
      const videoUrl = Array.isArray(res.video) && res.video.length > 0 ? res.video[0] : null;
      if (videoUrl) {
        return {
          success: true,
          type: 'video',
          title: res.title || 'TikTok Video',
          videoUrl,
          thumbnail: res.thumbnail,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT TIKTOK] ttdl gagal, mencoba TikWM:', e.message);
  }

  // 2. Fallback ke TikWM API publik
  try {
    const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    const json = await tikRes.json();
    if (json && json.data) {
      const data = json.data;

      // Jika hanya foto slideshow / gambar
      if (Array.isArray(data.images) && data.images.length > 0 && !data.play) {
        return {
          success: false,
          isPhotoOnly: true,
        };
      }

      const videoUrl = data.play || data.wmplay || data.hdplay;
      if (videoUrl) {
        return {
          success: true,
          type: 'video',
          title: data.title || 'TikTok Video',
          videoUrl: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`,
          thumbnail: data.cover,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT TIKTOK] Fallback TikWM gagal:', e.message);
  }

  throw new Error('Gagal mengekstrak video TikTok. Pastikan video bersifat publik dan tidak dihapus.');
}

/**
 * Konversi & Download Instagram (Khusus Video / Reels)
 */
async function convertInstagram(url) {
  // 1. Coba igdl dari btch-downloader
  try {
    const res = await igdl(url);
    if (res && res.status && Array.isArray(res.result) && res.result.length > 0) {
      const mediaList = res.result.filter((r) => r.url);
      const videoItems = mediaList.filter((item) => {
        const u = (item.url || '').toLowerCase();
        return u.includes('.mp4') || u.includes('mp4_') || u.includes('video');
      });

      if (videoItems.length > 0) {
        return {
          success: true,
          videoUrl: videoItems[0].url,
          thumbnail: videoItems[0].thumbnail || '',
        };
      }

      // Jika postingan foto / gambar (bukan video)
      return {
        success: false,
        isPhotoOnly: true,
      };
    }
  } catch (e) {
    console.warn('[CONVERT INSTAGRAM] igdl gagal, mencoba fallback AIO:', e.message);
  }

  // 2. Fallback AIO
  try {
    const aioRes = await aio(url);
    if (aioRes && aioRes.status) {
      const mediaUrl = aioRes.url || aioRes.download || aioRes.video;
      if (mediaUrl) {
        const u = mediaUrl.toLowerCase();
        if (u.includes('.mp4') || u.includes('video') || u.includes('mp4_')) {
          return {
            success: true,
            videoUrl: mediaUrl,
            thumbnail: aioRes.thumbnail || '',
          };
        } else {
          return {
            success: false,
            isPhotoOnly: true,
          };
        }
      }
    }
  } catch (e) {
    console.warn('[CONVERT INSTAGRAM] Fallback AIO gagal:', e.message);
  }

  throw new Error('Gagal mengunduh video Instagram. Pastikan akun tidak diprivat.');
}

/**
 * Konversi & Download Facebook (Khusus Video / Reels)
 */
async function convertFacebook(url) {
  // 1. Coba fbdown dari btch-downloader
  try {
    const res = await fbdown(url);
    if (res && res.status) {
      const videoUrl = res.HD || res.Normal_video;
      if (videoUrl) {
        return {
          success: true,
          videoUrl,
          quality: res.HD ? 'HD Quality' : 'Normal Quality',
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT FACEBOOK] fbdown gagal, mencoba fallback AIO:', e.message);
  }

  // 2. Fallback AIO
  try {
    const aioRes = await aio(url);
    if (aioRes && aioRes.status) {
      const videoUrl = aioRes.url || aioRes.download || aioRes.video;
      if (videoUrl) {
        return {
          success: true,
          videoUrl,
          quality: 'Standard',
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT FACEBOOK] Fallback AIO gagal:', e.message);
  }

  throw new Error('Gagal mengunduh video Facebook. Pastikan postingan video/reels bersifat publik.');
}

/**
 * Konversi & Download YouTube (Shorts & Video)
 * Menggunakan @distube/ytdl-core v5 sebagai mesin utama, dengan fallback ke btch.youtube
 */
async function convertYouTube(url) {
  // 1. Mesin Utama: @distube/ytdl-core v5 (Mendukung YouTube Shorts & Video)
  try {
    const { Ytdl, chooseFormat } = require('@distube/ytdl-core');
    const yt = new Ytdl();
    const info = await yt.getInfo(url);

    // Cari format yang memiliki Audio dan Video gabungan (mp4)
    const format =
      chooseFormat(info.formats, { hasAudio: true, hasVideo: true }) ||
      chooseFormat(info.formats, { quality: '18' }) ||
      info.formats.find((f) => f.hasAudio && f.hasVideo && f.url);

    if (format && format.url) {
      return {
        success: true,
        title: info.videoDetails.title || 'YouTube Video',
        author: info.videoDetails.author?.name || 'YouTube',
        thumbnail: info.videoDetails.thumbnails?.[0]?.url || '',
        videoUrl: format.url,
        quality: format.qualityLabel || format.quality || 'Standard',
      };
    }
  } catch (err) {
    console.warn('[CONVERT YOUTUBE] ytdl v5 gagal, mencoba fallback btch.youtube:', err.message);
  }

  // 2. Mesin Cadangan: btch-downloader youtube
  try {
    const res = await youtube(url);
    if (res && res.status && res.mp4) {
      return {
        success: true,
        title: res.title || 'YouTube Video',
        author: res.author || 'YouTube',
        thumbnail: res.thumbnail || '',
        videoUrl: res.mp4,
        quality: '360p/720p',
      };
    }
  } catch (e) {
    console.warn('[CONVERT YOUTUBE] btch.youtube gagal:', e.message);
  }

  throw new Error('Gagal mengunduh video YouTube. Pastikan link video tidak diprivat.');
}

/**
 * Eksekutor Utama Konversi & Pengiriman Media ke Channel
 */
async function handleMediaConvert(message, targetUrl, platform) {
  const pInfo = PLATFORM_INFO[platform];
  const progressMsg = await message.reply({
    content: `⏳ Lagi memproses dan mengunduh video **${pInfo.name}** lo bray, tunggu sebentar ya...`,
  });

  try {
    let data;
    if (platform === 'tiktok') {
      data = await convertTikTok(targetUrl);
    } else if (platform === 'instagram') {
      data = await convertInstagram(targetUrl);
    } else if (platform === 'facebook') {
      data = await convertFacebook(targetUrl);
    } else if (platform === 'youtube') {
      data = await convertYouTube(targetUrl);
    }

    // Jika yang dikirim ternyata postingan foto / gambar
    if (data && data.isPhotoOnly) {
      await progressMsg.delete().catch(() => {});
      return await message.reply({
        content: `Waduh bray <@${message.author.id}>, channel converter ini cuma bisa convert konten **video** (Reels / TikTok Video / Video FB / YouTube Shorts), belum bisa convert postingan foto/gambar ya! 🗿`,
      });
    }

    if (!data || !data.videoUrl) {
      throw new Error('Gagal mengekstrak link video.');
    }

    // Unduh buffer video untuk di-upload langsung ke chat Discord
    let videoBuffer = null;
    try {
      videoBuffer = await fetchMediaBuffer(data.videoUrl, 40000);
    } catch (e) {
      console.warn(`[${platform.toUpperCase()} BUFFER] Gagal download buffer:`, e.message);
    }

    const titleText = data.title || `${pInfo.name} Video`;
    const embed = new EmbedBuilder()
      .setColor(pInfo.color)
      .setTitle(`${pInfo.icon} ${titleText.substring(0, 200)}`)
      .setDescription(
        `Berhasil mengonversi video **${pInfo.name}**!\n` +
        (data.author ? `• Creator: **${data.author}**\n` : '') +
        (data.quality ? `• Kualitas: **${data.quality}**\n` : '')
      )
      .setFooter({ text: `FlyBot Video Downloader • Diminta oleh ${message.author.username}` })
      .setTimestamp();

    if (data.thumbnail) {
      embed.setThumbnail(data.thumbnail);
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Buka Link Asli')
        .setStyle(ButtonStyle.Link)
        .setURL(targetUrl),
      new ButtonBuilder()
        .setLabel('Unduh File (Direct Link)')
        .setStyle(ButtonStyle.Link)
        .setURL(data.videoUrl)
    );

    await progressMsg.delete().catch(() => {});

    // Jika ukuran video <= 24MB, kirim langsung sebagai file lampiran Discord
    if (videoBuffer && videoBuffer.length <= DISCORD_MAX_BYTES) {
      const file = new AttachmentBuilder(videoBuffer, { name: `${platform}_video.mp4` });
      return await message.reply({
        embeds: [embed],
        files: [file],
        components: [row],
      });
    } else {
      // Jika ukuran video > 24MB (misal video YouTube durasi panjang)
      embed.addFields({
        name: 'Ukuran Video Melebihi Limit Discord (>24MB):',
        value: 'Klik tombol **Unduh File (Direct Link)** di bawah untuk streaming atau menonton video resolusi penuh!',
      });
      return await message.reply({
        embeds: [embed],
        components: [row],
      });
    }
  } catch (err) {
    console.error(`[MEDIA CONVERT ERROR - ${platform.toUpperCase()}]:`, err);
    await progressMsg.edit({
      content: `Waduh bray, gagal mengonversi video dari ${pInfo.name}:\n> *${err.message || 'Terjadi kesalahan sistem'}*\nPastikan link video bersifat publik dan tidak diprivat ya!`,
    }).catch(() => {});
  }
}

module.exports = {
  PLATFORM_INFO,
  extractUrls,
  detectPlatform,
  getExpectedPlatform,
  isConvertChannel,
  handleMediaConvert,
};
