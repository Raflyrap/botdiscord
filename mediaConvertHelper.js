/**
 * Helper Konversi & Pengunduh Media Sosial Otomatis
 * Mendukung TikTok (Video no-watermark & Foto Slideshow), Instagram (Reels & Posts),
 * Facebook (Videos & Reels), dan YouTube (Shorts & Videos).
 */

const {
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { ttdl, igdl, fbdown, youtube, aio } = require('btch-downloader');

const DISCORD_MAX_BYTES = 24 * 1024 * 1024; // 24 MB batas aman upload bot Discord

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
 * Konversi & Download TikTok
 */
async function convertTikTok(url) {
  try {
    const res = await ttdl(url);
    if (res && res.status) {
      const videoUrl = Array.isArray(res.video) && res.video.length > 0 ? res.video[0] : null;
      const audioUrl = Array.isArray(res.audio) && res.audio.length > 0 ? res.audio[0] : null;
      if (videoUrl) {
        return {
          success: true,
          type: 'video',
          title: res.title || 'TikTok Video',
          videoUrl,
          audioUrl,
          thumbnail: res.thumbnail,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT TIKTOK] ttdl gagal, mencoba fallback TikWM:', e.message);
  }

  // Fallback ke TikWM API publik
  try {
    const tikRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    });
    const json = await tikRes.json();
    if (json && json.data) {
      const data = json.data;
      if (Array.isArray(data.images) && data.images.length > 0) {
        return {
          success: true,
          type: 'images',
          title: data.title || 'TikTok Photo Slideshow',
          images: data.images,
          audioUrl: data.music || null,
        };
      }

      const videoUrl = data.play || data.wmplay || data.hdplay;
      if (videoUrl) {
        return {
          success: true,
          type: 'video',
          title: data.title || 'TikTok Video',
          videoUrl: videoUrl.startsWith('http') ? videoUrl : `https://www.tikwm.com${videoUrl}`,
          audioUrl: data.music || null,
          thumbnail: data.cover,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT TIKTOK] Fallback TikWM gagal:', e.message);
  }

  throw new Error('Gagal mengekstrak media TikTok. Pastikan video bersifat publik dan tidak dihapus.');
}

/**
 * Konversi & Download Instagram (Reels & Posts & Photos)
 */
async function convertInstagram(url) {
  try {
    const res = await igdl(url);
    if (res && res.status && Array.isArray(res.result) && res.result.length > 0) {
      const mediaList = res.result.filter((r) => r.url);
      if (mediaList.length > 0) {
        return {
          success: true,
          mediaList,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT INSTAGRAM] igdl gagal, mencoba fallback aio:', e.message);
  }

  // Fallback AIO
  try {
    const aioRes = await aio(url);
    if (aioRes && aioRes.status) {
      const mediaUrl = aioRes.url || aioRes.download || aioRes.video;
      if (mediaUrl) {
        return {
          success: true,
          mediaList: [{ url: mediaUrl, thumbnail: aioRes.thumbnail || '' }],
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT INSTAGRAM] Fallback AIO gagal:', e.message);
  }

  throw new Error('Gagal mengunduh media Instagram. Pastikan akun tidak diprivat.');
}

/**
 * Konversi & Download Facebook
 */
async function convertFacebook(url) {
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
    console.warn('[CONVERT FACEBOOK] fbdown gagal, mencoba fallback aio:', e.message);
  }

  // Fallback AIO
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

  throw new Error('Gagal mengunduh media Facebook. Pastikan postingan video/reels bersifat publik.');
}

/**
 * Konversi & Download YouTube
 */
async function convertYouTube(url) {
  try {
    const res = await youtube(url);
    if (res && res.status && res.mp4) {
      return {
        success: true,
        title: res.title || 'YouTube Video',
        author: res.author || 'YouTube',
        thumbnail: res.thumbnail || '',
        videoUrl: res.mp4,
        audioUrl: res.mp3 || null,
      };
    }
  } catch (e) {
    console.warn('[CONVERT YOUTUBE] youtube gagal, mencoba fallback aio:', e.message);
  }

  // Fallback AIO
  try {
    const aioRes = await aio(url);
    if (aioRes && aioRes.status) {
      const videoUrl = aioRes.url || aioRes.download || aioRes.video;
      if (videoUrl) {
        return {
          success: true,
          title: aioRes.title || 'YouTube Video',
          author: 'YouTube',
          thumbnail: aioRes.thumbnail || '',
          videoUrl,
          audioUrl: null,
        };
      }
    }
  } catch (e) {
    console.warn('[CONVERT YOUTUBE] Fallback AIO gagal:', e.message);
  }

  throw new Error('Gagal mengunduh video YouTube.');
}

/**
 * Eksekutor Utama Konversi & Pengiriman Media ke Channel
 */
async function handleMediaConvert(message, targetUrl, platform) {
  const pInfo = PLATFORM_INFO[platform];
  const progressMsg = await message.reply({
    content: `⏳ Lagi memproses dan mengunduh media **${pInfo.name}** lo bray, tunggu sebentar ya...`,
  });

  try {
    if (platform === 'tiktok') {
      const data = await convertTikTok(targetUrl);

      if (data.type === 'images' && Array.isArray(data.images)) {
        // Kirim foto slideshow (maksimal 10 foto per pesan Discord)
        const photoUrls = data.images.slice(0, 10);
        const files = [];

        for (let i = 0; i < photoUrls.length; i++) {
          try {
            const buf = await fetchMediaBuffer(photoUrls[i], 15000);
            if (buf.length <= DISCORD_MAX_BYTES) {
              files.push(new AttachmentBuilder(buf, { name: `tiktok_slide_${i + 1}.jpg` }));
            }
          } catch (err) {
            console.warn(`[TIKTOK SLIDE] Gagal unduh foto ${i + 1}:`, err.message);
          }
        }

        const embed = new EmbedBuilder()
          .setColor(pInfo.color)
          .setTitle(`🎵 ${data.title.substring(0, 200)}`)
          .setDescription(`Berhasil mengonversi **${files.length} foto slideshow** dari TikTok tanpa watermark!`)
          .setFooter({ text: `FlyBot Sosmed Downloader • Diminta oleh ${message.author.username}` })
          .setTimestamp();

        await progressMsg.delete().catch(() => {});
        return await message.reply({
          embeds: [embed],
          files,
        });
      } else {
        // Video TikTok
        let videoBuffer = null;
        try {
          videoBuffer = await fetchMediaBuffer(data.videoUrl, 35000);
        } catch (e) {
          console.warn('[TIKTOK BUFFER] Gagal download buffer:', e.message);
        }

        const embed = new EmbedBuilder()
          .setColor(pInfo.color)
          .setTitle(`🎵 ${data.title.substring(0, 200)}`)
          .setDescription(`Berhasil mengonversi video **TikTok No Watermark**!`)
          .setFooter({ text: `FlyBot Sosmed Downloader • Diminta oleh ${message.author.username}` })
          .setTimestamp();

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

        if (videoBuffer && videoBuffer.length <= DISCORD_MAX_BYTES) {
          const file = new AttachmentBuilder(videoBuffer, { name: 'tiktok_video.mp4' });
          return await message.reply({
            embeds: [embed],
            files: [file],
            components: [row],
          });
        } else {
          embed.addFields({
            name: 'Ukuran Melebihi Limit Discord (>25MB):',
            value: `Klik tombol **Unduh File (Direct Link)** di bawah untuk langsung menonton atau mendownload dengan kecepatan tinggi!`,
          });
          return await message.reply({
            embeds: [embed],
            components: [row],
          });
        }
      }
    } else if (platform === 'instagram') {
      const data = await convertInstagram(targetUrl);
      const files = [];

      for (let i = 0; i < Math.min(data.mediaList.length, 6); i++) {
        const item = data.mediaList[i];
        try {
          const buf = await fetchMediaBuffer(item.url, 25000);
          if (buf.length <= DISCORD_MAX_BYTES) {
            const isVideo = item.url.includes('.mp4') || !item.url.includes('.jpg');
            const ext = isVideo ? 'mp4' : 'jpg';
            files.push(new AttachmentBuilder(buf, { name: `instagram_media_${i + 1}.${ext}` }));
          }
        } catch (err) {
          console.warn(`[IG MEDIA] Gagal unduh media ${i + 1}:`, err.message);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(pInfo.color)
        .setTitle('📸 Instagram Media Converter')
        .setDescription(`Berhasil mengonversi **${files.length} media Instagram** (Reels / Postingan)!`)
        .setFooter({ text: `FlyBot Sosmed Downloader • Diminta oleh ${message.author.username}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Buka Postingan Asli')
          .setStyle(ButtonStyle.Link)
          .setURL(targetUrl)
      );

      await progressMsg.delete().catch(() => {});

      if (files.length > 0) {
        return await message.reply({
          embeds: [embed],
          files,
          components: [row],
        });
      } else {
        const directUrl = data.mediaList[0]?.url;
        if (directUrl) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel('Unduh Langsung (Direct Link)')
              .setStyle(ButtonStyle.Link)
              .setURL(directUrl)
          );
        }
        embed.setDescription('Ukuran media melebihi 25MB. Silakan klik tombol di bawah untuk mengunduh secara langsung:');
        return await message.reply({
          embeds: [embed],
          components: [row],
        });
      }
    } else if (platform === 'facebook') {
      const data = await convertFacebook(targetUrl);
      let videoBuffer = null;
      try {
        videoBuffer = await fetchMediaBuffer(data.videoUrl, 35000);
      } catch (e) {
        console.warn('[FB BUFFER] Gagal download buffer:', e.message);
      }

      const embed = new EmbedBuilder()
        .setColor(pInfo.color)
        .setTitle('📘 Facebook Video Converter')
        .setDescription(`Berhasil mengonversi video Facebook (${data.quality})!`)
        .setFooter({ text: `FlyBot Sosmed Downloader • Diminta oleh ${message.author.username}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Buka Postingan Asli')
          .setStyle(ButtonStyle.Link)
          .setURL(targetUrl),
        new ButtonBuilder()
          .setLabel('Unduh File (Direct Link)')
          .setStyle(ButtonStyle.Link)
          .setURL(data.videoUrl)
      );

      await progressMsg.delete().catch(() => {});

      if (videoBuffer && videoBuffer.length <= DISCORD_MAX_BYTES) {
        const file = new AttachmentBuilder(videoBuffer, { name: 'facebook_video.mp4' });
        return await message.reply({
          embeds: [embed],
          files: [file],
          components: [row],
        });
      } else {
        embed.addFields({
          name: 'Ukuran Melebihi Batas Discord (>25MB):',
          value: 'Klik tombol **Unduh File (Direct Link)** di bawah untuk streaming atau mendownload kualitas penuh.',
        });
        return await message.reply({
          embeds: [embed],
          components: [row],
        });
      }
    } else if (platform === 'youtube') {
      const data = await convertYouTube(targetUrl);
      let videoBuffer = null;
      try {
        videoBuffer = await fetchMediaBuffer(data.videoUrl, 40000);
      } catch (e) {
        console.warn('[YT BUFFER] Gagal download buffer:', e.message);
      }

      const embed = new EmbedBuilder()
        .setColor(pInfo.color)
        .setTitle(`▶️ ${data.title.substring(0, 200)}`)
        .setDescription(`Channel: **${data.author}**\nBerhasil mengonversi media YouTube / Shorts!`)
        .setFooter({ text: `FlyBot Sosmed Downloader • Diminta oleh ${message.author.username}` })
        .setTimestamp();

      if (data.thumbnail) {
        embed.setThumbnail(data.thumbnail);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Buka di YouTube')
          .setStyle(ButtonStyle.Link)
          .setURL(targetUrl),
        new ButtonBuilder()
          .setLabel('Unduh Video (Direct Link)')
          .setStyle(ButtonStyle.Link)
          .setURL(data.videoUrl)
      );

      if (data.audioUrl) {
        row.addComponents(
          new ButtonBuilder()
            .setLabel('Unduh Audio MP3')
            .setStyle(ButtonStyle.Link)
            .setURL(data.audioUrl)
        );
      }

      await progressMsg.delete().catch(() => {});

      if (videoBuffer && videoBuffer.length <= DISCORD_MAX_BYTES) {
        const file = new AttachmentBuilder(videoBuffer, { name: 'youtube_video.mp4' });
        return await message.reply({
          embeds: [embed],
          files: [file],
          components: [row],
        });
      } else {
        embed.addFields({
          name: 'Ukuran Melebihi Batas Discord (>25MB):',
          value: 'Video YouTube ini berukuran lebih dari 25MB. Silakan klik tombol **Unduh Video (Direct Link)** di bawah untuk menonton atau mengunduh langsung.',
        });
        return await message.reply({
          embeds: [embed],
          components: [row],
        });
      }
    }
  } catch (err) {
    console.error(`[MEDIA CONVERT ERROR - ${platform.toUpperCase()}]:`, err);
    await progressMsg.edit({
      content: `Waduh bray, gagal mengonversi media dari ${pInfo.name}:\n> *${err.message || 'Terjadi kesalahan sistem'}*\nPastikan link media bersifat publik dan tidak diprivat ya!`,
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
