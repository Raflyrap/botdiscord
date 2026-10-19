const { LavalinkManager } = require('lavalink-client');
const { EmbedBuilder } = require('discord.js');
const { isPatroliActive } = require('./patroliHelper');

/**
 * Format durasi milidetik ke bentuk string mm:ss atau hh:mm:ss
 * @param {number} ms 
 * @returns {string}
 */
function formatDuration(ms) {
  if (!ms || isNaN(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Inisialisasi LavalinkManager v4
 * @param {import('discord.js').Client} client 
 * @returns {LavalinkManager}
 */
function initLavalink(client) {
  // Daftar node cadangan (public Lavalink v4 nodes yang mendukung YouTube & Spotify plugin LavaSrc)
  const defaultNodes = [
    {
      id: 'serenetia-v4',
      host: 'lavalinkv4.serenetia.com',
      port: 443,
      authorization: 'https://dsc.gg/ajidevserver',
      secure: true,
      requestTimeout: 20000,
    },
    {
      id: 'trinium-v4',
      host: 'lavalink-v4.triniumhost.com',
      port: 443,
      authorization: 'free',
      secure: true,
      requestTimeout: 20000,
    },
    {
      id: 'nazha-v4',
      host: 'lavalink.nazha.online',
      port: 443,
      authorization: 'nazhafreelava',
      secure: true,
      requestTimeout: 20000,
    },
  ];

  const configuredNodes = [];

  // Jika user menyetel konfigurasi node kustom di .env
  if (process.env.LAVALINK_HOST) {
    configuredNodes.push({
      id: 'custom-node',
      host: process.env.LAVALINK_HOST,
      port: parseInt(process.env.LAVALINK_PORT || '443', 10),
      authorization: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
      secure: process.env.LAVALINK_SECURE !== 'false',
      requestTimeout: 20000,
    });
  }

  // Gabungkan node kustom dengan fallback node publik
  configuredNodes.push(...defaultNodes);

  const manager = new LavalinkManager({
    nodes: configuredNodes,
    sendToShard: (guildId, payload) => {
      const guild = client.guilds.cache.get(guildId);
      if (guild?.shard) {
        guild.shard.send(payload);
      }
    },
    client: {
      id: client.user?.id || process.env.CLIENT_ID || '1559514149795401799',
      username: client.user?.username || 'Bot',
    },
    autoSkip: true,
    playerOptions: {
      clientBasedPositionUpdateInterval: 150,
      defaultSearchPlatform: 'ytsearch',
      volumeDecrementer: 1,
    },
    queueOptions: {
      maxPreviousTracks: 25,
    },
  });

  // Listener Node Lavalink
  manager.nodeManager
    .on('connect', (node) => {
      console.log(`[LAVALINK v4] Node '${node.id}' (${node.options.host}:${node.options.port}) BERHASIL TERHUBUNG!`);
    })
    .on('disconnect', (node, reason) => {
      console.warn(`[LAVALINK v4] Node '${node.id}' terputus. Alasan:`, reason);
    })
    .on('error', (node, error) => {
      console.error(`[LAVALINK v4] Error pada node '${node.id}':`, error.message);
    })
    .on('reconnecting', (node) => {
      console.log(`[LAVALINK v4] Menghubungkan ulang ke node '${node.id}'...`);
    });

  // Listener Pemutaran Musik (Player / Track events)
  manager
    // Saat lagu mulai dimainkan
    .on('trackStart', async (player, track) => {
      if (!player.textChannelId) return;
      const channel = client.channels.cache.get(player.textChannelId);
      if (!channel || typeof channel.send !== 'function') return;

      const requesterStr = track.requester?.id
        ? `<@${track.requester.id}>`
        : (track.requester?.tag || track.requester?.username || 'User');

      const embed = new EmbedBuilder()
        .setColor(0x00FF7F)
        .setTitle('🎵 Sedang Memutar Lagu')
        .setDescription(`[**${track.info.title}**](${track.info.uri || ''})`)
        .addFields(
          { name: '🎤 Artis / Penulis', value: `\`${track.info.author || 'Tidak Diketahui'}\``, inline: true },
          { name: '⏱️ Durasi', value: `\`${formatDuration(track.info.duration)}\``, inline: true },
          { name: '👤 Diminta Oleh', value: `${requesterStr}`, inline: true },
          { name: '🔊 Volume', value: `\`${player.volume}%\``, inline: true }
        )
        .setFooter({ text: 'Lavalink v4 Audio Engine • High Fidelity' })
        .setTimestamp();

      if (track.info.artworkUrl) {
        embed.setThumbnail(track.info.artworkUrl);
      }

      channel.send({ embeds: [embed] }).catch(console.error);
    })

    // Saat seluruh antrean lagu telah habis diputar
    .on('queueEnd', async (player) => {
      // Jangan matikan koneksi jika mode patroli 24 jam masih aktif di guild ini
      if (isPatroliActive(player.guildId)) return;

      const channel = client.channels.cache.get(player.textChannelId);
      if (channel && typeof channel.send === 'function') {
        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription('✅ **Semua antrean lagu telah selesai diputar.** Terima kasih sudah mendengarkan musik!')
          .setFooter({ text: 'Bot akan keluar otomatis jika tidak ada lagu baru yang ditambahkan.' });

        channel.send({ embeds: [embed] }).catch(() => {});
      }

      // Tunggu 30 detik sebelum bot keluar dari voice jika tidak ada aktivitas lagu lagi
      setTimeout(async () => {
        const p = manager.getPlayer(player.guildId);
        if (p && !p.playing && !p.queue.current && p.queue.tracks.length === 0 && !isPatroliActive(player.guildId)) {
          await p.destroy('QueueFinishedIdle');
        }
      }, 30000);
    })

    // Saat terjadi error pemutaran audio
    .on('trackError', async (player, track, payload) => {
      console.error(`[LAVALINK TRACK ERROR] Guild: ${player.guildId} | Lagu: ${track?.info?.title}:`, payload);
      const channel = client.channels.cache.get(player.textChannelId);
      if (channel && typeof channel.send === 'function') {
        channel.send(`⚠️ Gagal memutar lagu **${track?.info?.title || 'tidak diketahui'}**: ${payload?.exception?.message || 'Sumber audio tidak dapat diakses'}`).catch(() => {});
      }
    });

  return manager;
}

module.exports = {
  initLavalink,
  formatDuration,
};
