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
 * Periksa status Live YouTube berdasarkan Channel Handle / ID / URL
 * @param {string} target Handle atau Channel ID YouTube
 */
async function checkYouTubeLive(target) {
  try {
    let clean = target.trim();
    // Bersihkan format URL jika user memasukkan URL lengkap
    if (clean.includes('youtube.com/')) {
      const matchHandle = clean.match(/@([a-zA-Z0-9_.-]+)/);
      const matchChannel = clean.match(/\/channel\/([a-zA-Z0-9_-]{24})/);
      if (matchHandle) clean = `@${matchHandle[1]}`;
      else if (matchChannel) clean = matchChannel[1];
    }

    let url;
    if (clean.startsWith('UC') && clean.length === 24) {
      url = `https://www.youtube.com/channel/${clean}/live`;
    } else {
      const handle = clean.startsWith('@') ? clean : `@${clean}`;
      url = `https://www.youtube.com/${handle}/live`;
    }

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    const html = await res.text();
    const isLive = html.includes('"isLive":true') || html.includes('"liveStreamability"');

    // Ambil Video ID
    const vidMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
    const videoId = vidMatch ? vidMatch[1] : null;

    // Ambil Judul Siaran
    let title = 'Sedang Melangsungkan Siaran Langsung!';
    const titleMatch =
      html.match(/"title":{"runs":\[{"text":"([^"]+)"}\]/) ||
      html.match(/<meta name="title" content="([^"]+)">/) ||
      html.match(/<title>([^<]+)<\/title>/);
    if (titleMatch && titleMatch[1]) {
      title = titleMatch[1].replace(/ - YouTube$/, '').trim();
    }

    // Ambil Nama Channel
    let channelName = clean;
    const authorMatch =
      html.match(/"ownerChannelName":"([^"]+)"/) ||
      html.match(/"author":"([^"]+)"/) ||
      html.match(/<link itemprop="name" content="([^"]+)">/);
    if (authorMatch && authorMatch[1]) {
      channelName = authorMatch[1].trim();
    }

    // Ambil Thumbnail
    let thumbnail = null;
    if (videoId) {
      thumbnail = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
    } else {
      const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
      if (thumbMatch) thumbnail = thumbMatch[1];
    }

    // Ambil Avatar Channel jika ada
    let avatar = 'https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png';
    const avatarMatch = html.match(/"avatar":{"thumbnails":\[{"url":"([^"]+)"/);
    if (avatarMatch && avatarMatch[1]) {
      avatar = avatarMatch[1];
    }

    return {
      success: true,
      isLive: !!(isLive && videoId),
      videoId,
      title,
      channelName,
      avatar,
      thumbnail,
      url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : url,
      targetClean: clean,
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
 * Periksa status Live TikTok berdasarkan Username
 * @param {string} username Username TikTok (tanpa tanda @)
 */
async function checkTikTokLive(username) {
  const clean = username.replace(/^@/, '').trim();
  const tiktokConn = new TikTokLiveConnection(clean, {});

  try {
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
            const yt = await checkYouTubeLive(streamer.target);
            if (yt.success) {
              if (yt.channelName) streamer.name = yt.channelName;
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
  checkYouTubeLive,
  checkTikTokLive,
  buildLiveEmbed,
  addStreamer,
  removeStreamer,
  checkAllStreamers,
  initStreamerMonitor,
};
