const fs = require('fs');
const path = require('path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

const configPath = path.join(__dirname, 'tempVoiceConfig.json');

// Membaca file konfigurasi
function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error membaca tempVoiceConfig.json:', error);
    return {};
  }
}

// Menyimpan konfigurasi
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan tempVoiceConfig.json:', error);
  }
}

function getTempVoiceConfig(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

function setTempVoiceConfig(guildId, hubChannelId, categoryId) {
  const config = loadConfig();
  config[guildId] = { hubChannelId, categoryId };
  saveConfig(config);
  return config[guildId];
}

// Set untuk melacak ID voice channel sementara yang dibuat oleh bot
const activeTempChannels = new Set();

// Handler event voiceStateUpdate untuk Join-to-Create dan auto-delete
async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const config = getTempVoiceConfig(guild.id);
  const hubChannelId = config?.hubChannelId;

  // 1. Jika user bergabung ke channel trigger (➕・Buat Room)
  if (hubChannelId && newState.channelId === hubChannelId) {
    const member = newState.member;
    const parentCategory = newState.channel?.parentId || config?.categoryId;

    try {
      // Buat voice channel pribadi baru untuk user tersebut
      const channelName = `🔊・${member.displayName}'s Lounge`;

      const tempChannel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildVoice,
        parent: parentCategory || null,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel],
          },
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
            ],
          },
        ],
      });

      // Tandai channel ini sebagai temporary voice channel
      activeTempChannels.add(tempChannel.id);

      // Pindahkan user ke channel baru yang baru dibuat
      await member.voice.setChannel(tempChannel);
      console.log(`[TEMP VOICE] Dibuat: ${channelName} untuk ${member.user.tag}`);
    } catch (error) {
      console.error('Error saat membuat temp voice channel:', error);
    }
  }

  // 2. Jika user meninggalkan voice channel yang ada di daftar activeTempChannels
  if (oldState.channelId && activeTempChannels.has(oldState.channelId)) {
    const oldChannel = oldState.channel;
    if (oldChannel && oldChannel.members.size === 0) {
      try {
        activeTempChannels.delete(oldChannel.id);
        await oldChannel.delete();
        console.log(`[TEMP VOICE] Dihapus otomatis: ${oldChannel.name} (karena kosong)`);
      } catch (error) {
        console.error('Error saat menghapus temp voice channel kosong:', error);
      }
    }
  }
}

module.exports = {
  getTempVoiceConfig,
  setTempVoiceConfig,
  activeTempChannels,
  handleVoiceStateUpdate,
};
