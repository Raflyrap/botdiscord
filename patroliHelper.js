const fs = require('fs');
const path = require('path');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, entersState } = require('@discordjs/voice');

const PATROLI_FILE = path.join(__dirname, 'patroliConfig.json');
let patroliConfig = {};

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
    return existingConnection;
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

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
        } else {
          connection.destroy();
        }
      } catch (err) {
        console.error('[PATROLI ERROR] Rejoin failed:', err.message);
      }
    }
  });

  return connection;
}

function leavePatroliChannel(guildId) {
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
