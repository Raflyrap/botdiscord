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
let patroliConfig = {};

// Map untuk menyimpan audio player aktif per guild (guildId -> player)
const activePlayers = new Map();

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
      // Coba ulang setelah jeda 2 detik jika patroli masih aktif
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
      patroliConfig = JSON.parse(fs.readFileSync(PATROLI_FILE, 'utf-8') || '{}');
    } else {
      patroliConfig = {};
    }
  } catch (err) {
    console.error('Error saat loadPatroliConfig:', err);
    patroliConfig = {};
  }
}

function savePatroliConfig() {
  try {
    fs.writeFileSync(PATROLI_FILE, JSON.stringify(patroliConfig, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat savePatroliConfig:', err);
  }
}

loadPatroliConfig();

function isPatroliActive(guildId) {
  return !!patroliConfig[guildId];
}

function getPatroliConfig(guildId) {
  return patroliConfig[guildId] || null;
}

function getAllPatroliConfigs() {
  return patroliConfig;
}

function setPatroliActive(guildId, voiceChannelId, textChannelId) {
  patroliConfig[guildId] = {
    voiceChannelId,
    textChannelId,
    startedAt: Date.now(),
  };
  savePatroliConfig();
  return patroliConfig[guildId];
}

function removePatroliActive(guildId) {
  if (patroliConfig[guildId]) {
    delete patroliConfig[guildId];
    savePatroliConfig();
    return true;
  }
  return false;
}

function joinPatroliChannel(channel) {
  if (!channel) return null;

  const existingConnection = getVoiceConnection(channel.guild.id);
  if (existingConnection && existingConnection.joinConfig.channelId === channel.id) {
    playPatroliMusicLoop(channel.guild.id, existingConnection);
    return existingConnection;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  // Mulai memutar music.mp3 secara looping di background
  playPatroliMusicLoop(channel.guild.id, connection);

  connection.on('error', (err) => {
    console.error(`[PATROLI VOICE ERROR] Guild ${channel.guild.id}:`, err?.message || err);
  });

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch (e) {
      try {
        if (isPatroliActive(channel.guild.id)) {
          connection.rejoin();
          playPatroliMusicLoop(channel.guild.id, connection);
        } else {
          leavePatroliChannel(channel.guild.id);
        }
      } catch (err) {
        console.error('[PATROLI ERROR] Rejoin failed:', err.message);
      }
    }
  });

  return connection;
}

function leavePatroliChannel(guildId) {
  // Hentikan pemutaran audio
  const player = activePlayers.get(guildId);
  if (player) {
    try {
      player.stop();
    } catch {}
    activePlayers.delete(guildId);
  }

  const connection = getVoiceConnection(guildId);
  if (connection) {
    try {
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
};
