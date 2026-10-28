const fs = require('fs');
const path = require('path');
const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
} = require('@discordjs/voice');

const PATROLI_FILE = path.join(__dirname, 'patroliConfig.json');
const MUSIC_PATH = path.join(__dirname, 'music', 'music.mp3');

// Menggunakan global singleton agar status tersinkron 100% di seluruh proses bot (termasuk saat hot-reload)
if (!global.__flybotPatroliConfig) {
  global.__flybotPatroliConfig = {};
}
if (!global.__flybotPatroliReconnectTimeouts) {
  global.__flybotPatroliReconnectTimeouts = new Map();
}

// Map untuk menyimpan audio player aktif per guild (guildId -> player)
const activePlayers = new Map();

function cancelPatroliReconnect(guildId) {
  if (global.__flybotPatroliReconnectTimeouts && global.__flybotPatroliReconnectTimeouts.has(guildId)) {
    clearTimeout(global.__flybotPatroliReconnectTimeouts.get(guildId));
    global.__flybotPatroliReconnectTimeouts.delete(guildId);
  }
}

function schedulePatroliReconnect(guildId, channel, delayMs = 3000) {
  cancelPatroliReconnect(guildId);
  if (!isPatroliActive(guildId)) return;

  const timeout = setTimeout(() => {
    global.__flybotPatroliReconnectTimeouts.delete(guildId);
    if (isPatroliActive(guildId)) {
      console.log(`[PATROLI] Menyambungkan kembali patroli ke ${channel.name}...`);
      joinPatroliChannel(channel);
    }
  }, delayMs);

  global.__flybotPatroliReconnectTimeouts.set(guildId, timeout);
}

function playPatroliMusicLoop(guildId, connection) {
  if (!fs.existsSync(MUSIC_PATH)) {
    console.warn(`[PATROLI AUDIO] File tidak ditemukan di ${MUSIC_PATH}`);
    return;
  }

  let player = activePlayers.get(guildId);
  if (!player) {
    player = createAudioPlayer();
    activePlayers.set(guildId, player);

    // Saat audio selesai diputar -> otomatis loop memutar ulang dari awal tanpa henti
    player.on(AudioPlayerStatus.Idle, () => {
      if (isPatroliActive(guildId)) {
        try {
          const resource = createAudioResource(MUSIC_PATH);
          player.play(resource);
          console.log(`[PATROLI AUDIO] Looping music.mp3 di Guild ${guildId}`);
        } catch (err) {
          console.error(`[PATROLI AUDIO LOOP ERROR] Guild ${guildId}:`, err.message);
        }
      }
    });

    player.on('error', (err) => {
      console.error(`[PATROLI AUDIO PLAYER ERROR] Guild ${guildId}:`, err.message);
      setTimeout(() => {
        if (isPatroliActive(guildId)) {
          try {
            const resource = createAudioResource(MUSIC_PATH);
            player.play(resource);
          } catch {}
        }
      }, 2000);
    });
  }

  try {
    const resource = createAudioResource(MUSIC_PATH);
    player.play(resource);
    connection.subscribe(player);
    console.log(`[PATROLI AUDIO] Memulai pemutaran loop music.mp3 di Guild ${guildId}`);
  } catch (err) {
    console.error(`[PATROLI AUDIO PLAY ERROR] Guild ${guildId}:`, err.message);
  }
}

function loadPatroliConfig() {
  try {
    if (fs.existsSync(PATROLI_FILE)) {
      global.__flybotPatroliConfig = JSON.parse(fs.readFileSync(PATROLI_FILE, 'utf-8') || '{}');
    } else {
      global.__flybotPatroliConfig = {};
    }
  } catch (err) {
    console.error('Error saat loadPatroliConfig:', err);
    global.__flybotPatroliConfig = {};
  }
}

function savePatroliConfig() {
  try {
    fs.writeFileSync(PATROLI_FILE, JSON.stringify(global.__flybotPatroliConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat savePatroliConfig:', err);
  }
}

loadPatroliConfig();

function isPatroliActive(guildId) {
  if (!guildId) return false;
  if (!global.__flybotPatroliConfig || !global.__flybotPatroliConfig[guildId]) return false;

  // Verifikasi ke file fisik agar 100% akurat dan tidak ada status tersisa
  try {
    if (fs.existsSync(PATROLI_FILE)) {
      const disk = JSON.parse(fs.readFileSync(PATROLI_FILE, 'utf-8') || '{}');
      if (!disk[guildId]) {
        delete global.__flybotPatroliConfig[guildId];
        return false;
      }
    }
  } catch {}

  return true;
}

function getPatroliConfig(guildId) {
  if (!isPatroliActive(guildId)) return null;
  return global.__flybotPatroliConfig[guildId] || null;
}

function getAllPatroliConfigs() {
  return global.__flybotPatroliConfig || {};
}

function setPatroliActive(guildId, voiceChannelId, textChannelId) {
  cancelPatroliReconnect(guildId);
  global.__flybotPatroliConfig[guildId] = {
    voiceChannelId,
    textChannelId,
    startedAt: Date.now(),
  };
  savePatroliConfig();
  return global.__flybotPatroliConfig[guildId];
}

function removePatroliActive(guildId) {
  cancelPatroliReconnect(guildId);
  let removed = false;

  if (global.__flybotPatroliConfig && global.__flybotPatroliConfig[guildId]) {
    delete global.__flybotPatroliConfig[guildId];
    removed = true;
  }

  try {
    if (fs.existsSync(PATROLI_FILE)) {
      const disk = JSON.parse(fs.readFileSync(PATROLI_FILE, 'utf-8') || '{}');
      if (disk[guildId]) {
        delete disk[guildId];
        fs.writeFileSync(PATROLI_FILE, JSON.stringify(disk, null, 2), 'utf-8');
        removed = true;
      }
    }
  } catch (err) {
    console.error('Error saat removePatroliActive:', err);
  }

  return removed;
}

function joinPatroliChannel(channel) {
  if (!channel) return null;
  const guildId = channel.guild.id;

  cancelPatroliReconnect(guildId);

  const existingConnection = getVoiceConnection(guildId);
  if (existingConnection && existingConnection.joinConfig.channelId === channel.id) {
    playPatroliMusicLoop(guildId, existingConnection);
    return existingConnection;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  playPatroliMusicLoop(guildId, connection);

  connection.on('error', (err) => {
    console.error(`[PATROLI VOICE ERROR] Guild ${channel.guild.id}:`, err?.message || err);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    // Jika status patroli sudah dicabut, jangan pernah rejoin
    if (!isPatroliActive(guildId)) {
      leavePatroliChannel(guildId);
      return;
    }

    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch (e) {
      if (isPatroliActive(guildId)) {
        try {
          connection.rejoin();
          playPatroliMusicLoop(guildId, connection);
        } catch (rejoinErr) {
          console.error('[PATROLI ERROR] Rejoin failed:', rejoinErr.message);
        }
      } else {
        leavePatroliChannel(guildId);
      }
    }
  });

  return connection;
}

function leavePatroliChannel(guildId) {
  cancelPatroliReconnect(guildId);

  // Hentikan pemutaran audio
  const player = activePlayers.get(guildId);
  if (player) {
    try {
      player.stop(true);
    } catch {}
    activePlayers.delete(guildId);
  }

  const connection = getVoiceConnection(guildId);
  if (connection) {
    try {
      // Hapus seluruh listener sebelum destroy agar tidak memicu event Disconnected/rejoin
      connection.removeAllListeners();
      connection.destroy();
    } catch (e) {}
  }
}

module.exports = {
  isPatroliActive,
  getPatroliConfig,
  getAllPatroliConfigs,
  setPatroliActive,
  removePatroliActive,
  joinPatroliChannel,
  leavePatroliChannel,
  schedulePatroliReconnect,
  cancelPatroliReconnect,
};
