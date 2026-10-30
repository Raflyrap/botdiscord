const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const CONFIG_PATH = path.join(__dirname, 'streamerConfig.json');

/**
 * Muat konfigurasi data streamer
 */
function loadStreamerConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{}');
  } catch (err) {
    console.error('[STREAMER CONFIG ERROR]:', err.message);
    return {};
  }
}

/**
 * Simpan konfigurasi data streamer
 */
function saveStreamerConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[STREAMER SAVE ERROR]:', err.message);
  }
}

/**
 * Ambil konfigurasi server tertentu
 */
function getGuildStreamerConfig(guildId) {
  const configs = loadStreamerConfig();
  if (!configs[guildId]) {
    configs[guildId] = {
      channelId: null,
      streamers: [],
    };
    saveStreamerConfig(configs);
  }
  return configs[guildId];
}

/**
 * Cek apakah sebuah channel adalah channel resmi notif stream
 */
function isStreamerChannel(guildId, channelId) {
  const cfg = getGuildStreamerConfig(guildId);
  return !!(cfg && cfg.channelId && cfg.channelId === channelId);
}

/**
 * Dapatkan atau buat channel khusus notifikasi live stream secara otomatis
 * @param {import('discord.js').Guild} guild
 */
async function ensureStreamerChannel(guild) {
  try {
    const cfg = getGuildStreamerConfig(guild.id);

    // 1. Cek apakah channel yang tersimpan masih valid
    let channel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : null;

    // 2. Jika belum ada, cari channel yang sudah ada dengan nama notif-stream
    if (!channel) {
      channel = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildText &&
          (c.name.includes('notif-stream') || c.name.includes('notif-youtube') || c.name.includes('stream-notif'))
      );
    }

    // 3. Jika tetap belum ada, buat Kategori dan Channel baru secara otomatis
    if (!channel) {
      const me = guild.members.me || (await guild.members.fetchMe().catch(() => null));
      if (!me || !me.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return null;
      }

      let category = guild.channels.cache.find(
        (c) =>
          c.type === ChannelType.GuildCategory &&
          (c.name.toUpperCase().includes('NOTIFIKASI') || c.name.toUpperCase().includes('INFORMASI'))
      );

      if (!category) {
        category = await guild.channels.create({
          name: '📢︱NOTIFIKASI',
          type: ChannelType.GuildCategory,
          reason: 'Setup Kategori Notifikasi Otomatis FlyBot',
        }).catch(() => null);
      }

      channel = await guild.channels.create({
        name: '🔴︱notif-stream',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined,
        topic: 'Pusat notifikasi otomatis siaran langsung (Live Stream) YouTube & TikTok oleh FlyBot.',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AddReactions,
            ],
            deny: [
              PermissionFlagsBits.SendMessages, // Member dilarang spam agar notifikasi selalu bersih dan rapi
            ],
          },
          {
            id: guild.client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.EmbedLinks,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.MentionEveryone,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ],
        reason: 'Setup Otomatis Channel Notif Stream FlyBot',
      });

      // Kirim panduan & pin pesan di channel baru
      const introEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({
          name: 'FlyBot • Pusat Notifikasi Live Streaming',
          iconURL: guild.client.user.displayAvatarURL(),
        })
        .setTitle('🔴 Pusat Siaran Langsung YouTube & TikTok')
        .setDescription(
          `Selamat datang di channel resmi **Notifikasi Live Streaming**!\n\n` +
          `Bot akan otomatis mengirimkan kartu pengumuman siaran langsung secara realtime begitu streamer YouTube atau kreator TikTok favoritmu memulai live!\n\n` +
          `**Perintah Pengaturan Khusus di Channel Ini:**\n` +
          `• \`/streamer add\` : Mendaftarkan YouTuber atau TikToker baru untuk dipantau.\n` +
          `• \`/streamer list\` : Melihat daftar seluruh streamer yang sedang aktif dipantau.\n` +
          `• \`/streamer remove\` : Menghapus streamer dari daftar pemantauan.\n` +
          `• \`/streamer test\` : Menguji tampilan kartu notifikasi live (Hanya dilihat oleh Anda sendiri/Privat).\n\n` +
          `*Semua notifikasi dikirim otomatis 24/7 tanpa delay.*`
        )
        .setFooter({ text: 'FlyBot Streamer Radar • YouTube & TikTok Monitor' })
        .setTimestamp();

      const pinnedMsg = await channel.send({ embeds: [introEmbed] }).catch(() => null);
      if (pinnedMsg) await pinnedMsg.pin().catch(() => {});
    }

    // Simpan ID channel
    if (channel && cfg.channelId !== channel.id) {
      cfg.channelId = channel.id;
      const allConfigs = loadStreamerConfig();
      allConfigs[guild.id] = cfg;
      saveStreamerConfig(allConfigs);
    }

    return channel;
  } catch (err) {
    console.error(`[STREAMER CHANNEL SETUP ERROR] Guild ${guild?.name}:`, err.message);
    return null;
  }
}

/**
 * Resolusi target YouTube menjadi Channel ID, Handle, atau URL Live resmi
 * @param {string} target Handle (@...), Channel ID (UC...), URL, atau Nama Channel
 */
async function resolveYouTubeTarget(target) {
  let clean = target.trim();

  // Ekstrak jika formatnya URL YouTube lengkap
  if (clean.includes('youtube.com/') || clean.includes('youtu.be/')) {
    const handleMatch = clean.match(/@([a-zA-Z0-9_.-]+)/);
    if (handleMatch) {
      clean = `@${handleMatch[1]}`;
    } else {
      const channelMatch = clean.match(/\/channel\/([a-zA-Z0-9_-]{24})/);
      if (channelMatch) {
        clean = channelMatch[1];
      }
    }
  }

  // 1. Jika Channel ID langsung (UC...)
  if (clean.startsWith('UC') && clean.length === 24) {
    return {
      type: 'channelId',
      channelId: clean,
      url: `https://www.youtube.com/channel/${clean}/live`,
      clean,
    };
  }

  // 2. Jika Handle (@...)
  if (clean.startsWith('@')) {
    return {
      type: 'handle',
      handle: clean,
      url: `https://www.youtube.com/${clean}/live`,
      clean,
    };
  }

  // 3. Jika Handle tanpa tanda @ dan tanpa spasi (misal: "WindahBasudara")
  if (!clean.includes(' ') && !clean.includes('/')) {
    return {
      type: 'handle',
      handle: `@${clean}`,
      url: `https://www.youtube.com/@${clean}/live`,
      clean: `@${clean}`,
    };
  }

  // 4. Jika input berupa nama dengan spasi (misal: "Windah Basudara"), cari channel resminya via search
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(clean)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    const html = await res.text();
    const chMatch = html.match(
      /"channelRenderer":\{"channelId":"([a-zA-Z0-9_-]{24})"[^}]*?"title":\{"simpleText":"([^"]+)"\}/
    );
    if (chMatch) {
      return {
        type: 'channelId',
        channelId: chMatch[1],
        channelName: chMatch[2],
        url: `https://www.youtube.com/channel/${chMatch[1]}/live`,
        clean: chMatch[2],
      };
    }
  } catch (err) {
    console.error('[RESOLVE YT SEARCH ERROR]:', err.message);
  }

  // Fallback ke @handle
  const fallback = clean.replace(/\s+/g, '');
  return {
    type: 'handle',
    handle: `@${fallback}`,
    url: `https://www.youtube.com/@${fallback}/live`,
    clean: `@${fallback}`,
  };
}

/**
 * Periksa status Live YouTube berdasarkan Channel Handle / ID / URL
 * Menggunakan parsing ketat ytInitialPlayerResponse agar TIDAK PERNAH salah
 * mendeteksi video rekomendasi streamer lain atau stream offline/upcoming.
 *
 * @param {string} target Handle (@...), Channel ID (UC...), atau nama channel
 * @param {string|null} expectedChannelId ID channel yang diharapkan (opsional)
 */
async function checkYouTubeLive(target, expectedChannelId = null) {
  try {
    const resolved = await resolveYouTubeTarget(target);
    const url = resolved.url;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    if (res.status === 404) {
      return {
        success: true,
        isLive: false,
        reason: 'Channel tidak ditemukan (404)',
        targetClean: resolved.clean,
      };
    }

    const html = await res.text();

    // 1. Ekstrak data ytInitialPlayerResponse resmi dari YouTube
    // Catatan: Jika channel TIDAK SEDANG LIVE, YouTube me-redirect /live ke halaman channel utama,
    // sehingga ytInitialPlayerResponse TIDAK ADA di halaman tersebut.
    const playerMatch = html.match(/var ytInitialPlayerResponse = ({.*?});(?:var|<\/script>)/s);
    if (!playerMatch) {
      // Channel sedang offline (tidak live)
      let channelName = resolved.channelName || resolved.clean;
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      if (titleMatch && !titleMatch[1].includes('404')) {
        channelName = titleMatch[1].replace(/ - YouTube$/, '').trim();
      }

      const avatarMatch = html.match(/(https:\/\/yt3\.ggpht\.com\/[a-zA-Z0-9_\-\/=]+)/);
      const avatar = avatarMatch ? avatarMatch[1] : 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png';

      return {
        success: true,
        isLive: false,
        videoId: null,
        title: null,
        channelName,
        channelId: resolved.channelId || null,
        avatar,
        thumbnail: null,
        url: resolved.url,
        targetClean: resolved.clean,
      };
    }

    // 2. Parse ytInitialPlayerResponse
    let playerData;
    try {
      playerData = JSON.parse(playerMatch[1]);
    } catch {
      return {
        success: true,
        isLive: false,
        reason: 'Gagal parse data player YouTube',
        targetClean: resolved.clean,
      };
    }

    const videoDetails = playerData.videoDetails || {};
    const playability = playerData.playabilityStatus || {};

    const videoId = videoDetails.videoId || null;
    const channelName = videoDetails.author || resolved.channelName || resolved.clean;
    const channelId = videoDetails.channelId || resolved.channelId || null;
    const title = videoDetails.title || 'Sedang Melangsungkan Siaran Langsung!';

    // VERIFIKASI KETAT SIARAN LANGSUNG:
    // a. Harus memiliki videoId yang valid
    // b. videoDetails.isLive HARUS true murni
    // c. Bukan siaran upcoming / terjadwal yang belum mulai (isUpcoming !== true)
    // d. playabilityStatus.status HARUS 'OK' (bukan 'LIVE_STREAM_OFFLINE')
    // e. Jika expectedChannelId dicatat, channelId video HARUS COCOK agar streamer lain tidak tertukar!
    const isActivelyLive =
      !!videoId &&
      videoDetails.isLive === true &&
      videoDetails.isUpcoming !== true &&
      playability.status === 'OK' &&
      (!expectedChannelId || expectedChannelId === channelId);

    // Ambil Thumbnail siaran langsung
    const thumbs = videoDetails.thumbnail?.thumbnails || [];
    const thumbnail = thumbs.length
      ? thumbs[thumbs.length - 1].url
      : videoId
      ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
      : null;

    // Ambil Avatar Channel
    const avatarMatch = html.match(/(https:\/\/yt3\.ggpht\.com\/[a-zA-Z0-9_\-\/=]+)/);
    const avatar = avatarMatch ? avatarMatch[1] : 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png';

    return {
      success: true,
      isLive: isActivelyLive,
      videoId,
      title,
      channelName,
      channelId,
      avatar,
      thumbnail,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      targetClean: resolved.clean,
      status: playability.status,
      isUpcoming: !!videoDetails.isUpcoming,
    };
  } catch (err) {
    return {
      success: false,
      isLive: false,
      error: err.message,
    };
  }
}

/**
 * Periksa status Live TikTok berdasarkan Username atau URL
 * @param {string} username Username TikTok atau link profil
 */
async function checkTikTokLive(username) {
  let clean = username.trim();
  // Bersihkan format URL TikTok jika user memasukkan link lengkap
  if (clean.includes('tiktok.com/')) {
    const match = clean.match(/@([a-zA-Z0-9_.-]+)/);
    if (match) clean = match[1];
    else clean = clean.split('/').pop().replace(/^@/, '');
  }
  clean = clean.replace(/^@/, '').trim();

  try {
    const tiktokConn = new TikTokLiveConnection(clean, {});
    const isLive = await tiktokConn.fetchIsLive().catch(() => false);
    let roomInfo = null;

    if (isLive) {
      roomInfo = await tiktokConn.fetchRoomInfo().catch(() => null);
    }

    const title = roomInfo?.title || 'Sedang Live Streaming di TikTok!';
    const nickname = roomInfo?.owner?.nickname || clean;
    const avatar =
      roomInfo?.owner?.avatar_large?.url_list?.[0] ||
      roomInfo?.owner?.avatar_thumb?.url_list?.[0] ||
      'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7311756545228554245~c5_720x720.jpeg';
    const cover =
      roomInfo?.cover?.url_list?.[0] ||
      roomInfo?.stream_url?.flv_pull_url?.HD1 ||
      null;

    const roomId = roomInfo?.id_str || tiktokConn.roomId || `${clean}_live`;

    return {
      success: true,
      isLive: !!isLive,
      username: clean,
      nickname,
      title,
      avatar,
      cover,
      roomId,
      url: `https://www.tiktok.com/@${clean}/live`,
    };
  } catch (err) {
    return {
      success: false,
      isLive: false,
      username: clean,
      error: err.message,
    };
  }
}

/**
 * Buat kartu Embed Notifikasi Live Stream yang Estetik & Mewah
 */
function buildLiveEmbed(platform, data, isTest = false) {
  const isYt = platform.toLowerCase() === 'youtube';

  if (isYt) {
    const embed = new EmbedBuilder()
      .setColor(0xED4245) // Merah YouTube
      .setAuthor({
        name: isTest ? '🔴 [TEST PREVIEW] YouTube Live Monitor' : '🔴 SIARAN LANGSUNG YOUTUBE',
        iconURL: data.avatar || 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png',
        url: data.url,
      })
      .setTitle(data.title || 'Siaran Langsung YouTube Dimulai!')
      .setURL(data.url)
      .setDescription(
        `Halo semuanya! **${data.channelName}** sedang melangsungkan siaran langsung sekarang di **YouTube**!\n\n` +
        `Yuk segera merapat, ramaikan kolom live chat, dan jangan lupa tekan tombol like sekarang juga!`
      )
      .addFields(
        { name: '📺 Channel', value: `**${data.channelName}**`, inline: true },
        { name: '🔴 Status', value: '` SEDANG LIVE `', inline: true },
        { name: '🔗 Tonton Live', value: `[Klik di Sini Menuju Live](${data.url})`, inline: true }
      );

    if (data.thumbnail) {
      embed.setImage(data.thumbnail);
    }

    if (data.avatar) {
      embed.setThumbnail(data.avatar);
    }

    embed
      .setFooter({
        text: isTest
          ? 'Mode Uji Coba • Hanya Anda yang dapat melihat pesan ini • Tidak ada ping yang terkirim'
          : 'FlyBot Live Radar • Siaran Langsung YouTube',
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🔴 Tonton Live YouTube')
        .setStyle(ButtonStyle.Link)
        .setURL(data.url)
    );

    return { embed, row };
  } else {
    // Platform TikTok
    const embed = new EmbedBuilder()
      .setColor(0x00F2FE) // Warna Neon Cyan TikTok
      .setAuthor({
        name: isTest ? '🎵 [TEST PREVIEW] TikTok Live Monitor' : '🎵 SIARAN LANGSUNG TIKTOK',
        iconURL: data.avatar || 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/7311756545228554245~c5_720x720.jpeg',
        url: data.url,
      })
      .setTitle(data.title || `Live Streaming TikTok: @${data.username}`)
      .setURL(data.url)
      .setDescription(
        `Halo semuanya! Kreator **${data.nickname}** (\`@${data.username}\`) sedang live sekarang di **TikTok**!\n\n` +
        `Yuk buka aplikasi TikTok sekarang, tap-tap layarnya, dan bergabung di ruang siarannya!`
      )
      .addFields(
        { name: '👤 Kreator', value: `**${data.nickname}** (\`@${data.username}\`)`, inline: true },
        { name: '🎵 Status', value: '` SEDANG LIVE `', inline: true },
        { name: '🔗 Buka TikTok', value: `[Buka Siaran Langsung](${data.url})`, inline: true }
      );

    if (data.cover) {
      embed.setImage(data.cover);
    }

    if (data.avatar) {
      embed.setThumbnail(data.avatar);
    }

    embed
      .setFooter({
        text: isTest
          ? 'Mode Uji Coba • Hanya Anda yang dapat melihat pesan ini • Tidak ada ping yang terkirim'
          : 'FlyBot Live Radar • Siaran Langsung TikTok',
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🎵 Buka Live TikTok')
        .setStyle(ButtonStyle.Link)
        .setURL(data.url)
    );

    return { embed, row };
  }
}

/**
 * Tambah streamer baru ke daftar pemantauan
 */
function addStreamer(guildId, streamerData) {
  const configs = loadStreamerConfig();
  if (!configs[guildId]) {
    configs[guildId] = { channelId: null, streamers: [] };
  }

  // Cek apakah sudah terdaftar
  const existsIndex = configs[guildId].streamers.findIndex(
    (s) => s.platform === streamerData.platform && s.target.toLowerCase() === streamerData.target.toLowerCase()
  );

  if (existsIndex >= 0) {
    configs[guildId].streamers[existsIndex] = {
      ...configs[guildId].streamers[existsIndex],
      ...streamerData,
    };
  } else {
    configs[guildId].streamers.push({
      id: `${streamerData.platform}_${Date.now()}`,
      ...streamerData,
      isCurrentlyLive: false,
      lastLiveId: null,
      lastCheckTime: Date.now(),
    });
  }

  saveStreamerConfig(configs);
  return configs[guildId].streamers;
}

/**
 * Hapus streamer dari pemantauan
 */
function removeStreamer(guildId, targetOrId) {
  const configs = loadStreamerConfig();
  if (!configs[guildId] || !configs[guildId].streamers) return false;

  const initialLength = configs[guildId].streamers.length;
  configs[guildId].streamers = configs[guildId].streamers.filter(
    (s) =>
      s.id !== targetOrId &&
      s.target.toLowerCase() !== targetOrId.toLowerCase() &&
      (s.name ? s.name.toLowerCase() !== targetOrId.toLowerCase() : true)
  );

  const removed = configs[guildId].streamers.length < initialLength;
  if (removed) {
    saveStreamerConfig(configs);
  }
  return removed;
}

/**
 * Background Scheduler: Memeriksa seluruh streamer terdaftar secara berkala
 */
async function checkAllStreamers(client) {
  try {
    const configs = loadStreamerConfig();
    let hasChanges = false;

    for (const guildId of Object.keys(configs)) {
      const cfg = configs[guildId];
      if (!cfg || !cfg.channelId || !cfg.streamers || cfg.streamers.length === 0) continue;

      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;

      const channel = guild.channels.cache.get(cfg.channelId);
      if (!channel) continue;

      for (const streamer of cfg.streamers) {
        try {
          if (streamer.platform === 'youtube') {
            const yt = await checkYouTubeLive(streamer.target, streamer.channelId);
            if (yt.success) {
              if (yt.channelName) streamer.name = yt.channelName;
              if (yt.channelId && !streamer.channelId) streamer.channelId = yt.channelId;
              streamer.lastCheckTime = Date.now();

              // Jika streamer baru saja mulai LIVE dan belum dinotifikasi
              if (yt.isLive && (!streamer.isCurrentlyLive || streamer.lastLiveId !== yt.videoId)) {
                streamer.isCurrentlyLive = true;
                streamer.lastLiveId = yt.videoId;
                hasChanges = true;

                // Bangun pesan notifikasi
                const { embed, row } = buildLiveEmbed('youtube', yt, false);
                let mentionContent = '';
                if (streamer.roleId) {
                  mentionContent = `<@&${streamer.roleId}> `;
                }
                if (streamer.customMessage) {
                  mentionContent += streamer.customMessage;
                }

                await channel.send({
                  content: mentionContent.trim() ? mentionContent.trim() : undefined,
                  embeds: [embed],
                  components: [row],
                }).catch((e) => console.warn(`[STREAMER NOTIF ERROR] ${guild.name}:`, e.message));
              } else if (!yt.isLive && streamer.isCurrentlyLive) {
                // Streamer sudah selesai siaran
                streamer.isCurrentlyLive = false;
                hasChanges = true;
              }
            }
          } else if (streamer.platform === 'tiktok') {
            const tt = await checkTikTokLive(streamer.target);
            if (tt.success) {
              if (tt.nickname) streamer.name = tt.nickname;
              streamer.lastCheckTime = Date.now();

              // Jika baru saja LIVE
              if (tt.isLive && (!streamer.isCurrentlyLive || streamer.lastLiveId !== tt.roomId)) {
                streamer.isCurrentlyLive = true;
                streamer.lastLiveId = tt.roomId;
                hasChanges = true;

                const { embed, row } = buildLiveEmbed('tiktok', tt, false);
                let mentionContent = '';
                if (streamer.roleId) {
                  mentionContent = `<@&${streamer.roleId}> `;
                }
                if (streamer.customMessage) {
                  mentionContent += streamer.customMessage;
                }

                await channel.send({
                  content: mentionContent.trim() ? mentionContent.trim() : undefined,
                  embeds: [embed],
                  components: [row],
                }).catch((e) => console.warn(`[STREAMER NOTIF ERROR] ${guild.name}:`, e.message));
              } else if (!tt.isLive && streamer.isCurrentlyLive) {
                streamer.isCurrentlyLive = false;
                hasChanges = true;
              }
            }
          }
        } catch (singleErr) {
          console.warn(`[STREAMER CHECK WARN] ${streamer.target}:`, singleErr.message);
        }
      }
    }

    if (hasChanges) {
      saveStreamerConfig(configs);
    }
  } catch (err) {
    console.error('[STREAMER GLOBAL CHECK ERROR]:', err.message);
  }
}

/**
 * Inisialisasi background monitor untuk live streamer
 */
function initStreamerMonitor(client) {
  console.log('[STREAMER MONITOR] Menginisialisasi sistem radar live stream YouTube & TikTok...');

  // Auto-create channel untuk semua server yang diikuti bot saat start
  for (const [, guild] of client.guilds.cache) {
    ensureStreamerChannel(guild).catch(() => {});
  }

  // Jalankan pengecekan pertama 15 detik setelah start
  setTimeout(() => {
    checkAllStreamers(client).catch(() => {});
  }, 15000);

  // Interval rutin setiap 2.5 menit (150 detik)
  setInterval(() => {
    checkAllStreamers(client).catch(() => {});
  }, 150 * 1000);
}

module.exports = {
  loadStreamerConfig,
  saveStreamerConfig,
  getGuildStreamerConfig,
  ensureStreamerChannel,
  isStreamerChannel,
  resolveYouTubeTarget,
  checkYouTubeLive,
  checkTikTokLive,
  buildLiveEmbed,
  addStreamer,
  removeStreamer,
  checkAllStreamers,
  initStreamerMonitor,
};
