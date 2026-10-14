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

const configPath = path.join(__dirname, 'privateAiConfig.json');

// Membaca file konfigurasi
function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      const initial = { guilds: {}, activeChannels: {} };
      fs.writeFileSync(configPath, JSON.stringify(initial, null, 2));
      return initial;
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(data || '{}');
    if (!parsed.guilds) parsed.guilds = {};
    if (!parsed.activeChannels) parsed.activeChannels = {};
    return parsed;
  } catch (error) {
    console.error('Error membaca privateAiConfig.json:', error);
    return { guilds: {}, activeChannels: {} };
  }
}

// Menyimpan konfigurasi
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan privateAiConfig.json:', error);
  }
}

function getPrivateAiConfig(guildId) {
  const config = loadConfig();
  return config.guilds[guildId] || null;
}

function setPrivateAiConfig(guildId, hubChannelId, categoryId) {
  const config = loadConfig();
  config.guilds[guildId] = { hubChannelId, categoryId };
  saveConfig(config);
  return config.guilds[guildId];
}

function isPrivateAiChannel(channelId) {
  const config = loadConfig();
  return Boolean(config.activeChannels[channelId]);
}

function getPrivateAiChannelInfo(channelId) {
  const config = loadConfig();
  return config.activeChannels[channelId] || null;
}

function registerPrivateChannel(channelId, userId, guildId) {
  const config = loadConfig();
  config.activeChannels[channelId] = {
    userId,
    guildId,
    createdAt: Date.now(),
  };
  saveConfig(config);
}

function unregisterPrivateChannel(channelId) {
  const config = loadConfig();
  if (config.activeChannels[channelId]) {
    delete config.activeChannels[channelId];
    saveConfig(config);
  }
}

/**
 * Mencari channel private AI yang masih aktif untuk user tertentu di server
 */
async function getUserActiveAiChannel(guild, userId) {
  const config = loadConfig();
  for (const [chId, data] of Object.entries(config.activeChannels)) {
    if (data.guildId === guild.id && data.userId === userId) {
      const channel = guild.channels.cache.get(chId) || await guild.channels.fetch(chId).catch(() => null);
      if (channel) {
        return channel;
      }
      // Jika channel sudah dihapus di Discord, hapus dari config
      delete config.activeChannels[chId];
      saveConfig(config);
    }
  }
  return null;
}

/**
 * Membuat tampilan panel hub untuk channel pemicu (+ Buka AI Chat)
 */
function getHubPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('FLY CHAT LOUNGE')
    .setDescription(
      `### Ruang Ngobrol & Curhat Rahasia Bareng Fly\n\n` +
      `╭─── PILIHAN MODE CHAT ────────────────────╮\n` +
      `│\n` +
      `│  1. Mode DM Pribadi (100% Rahasia)\n` +
      `│  └ Langsung di DM bot. Admin, Owner & member lain\n` +
      `│    tidak bisa melihat chat ini sama sekali.\n` +
      `│\n` +
      `│  2. Mode Room Server\n` +
      `│  └ Bikin channel teks privat khusus kamu di server.\n` +
      `│\n` +
      `╰──────────────────────────────────────────╯\n\n` +
      `*Tinggal ketik santai tanpa prefix / atau mention bot.*\n\n` +
      `Pilih tombol di bawah untuk mulai:`
    )
    .setFooter({ text: 'Fly AI Lounge • Safe & Private' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_open_dm_ai')
      .setLabel('Buka di DM Pribadi')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_open_private_ai')
      .setLabel('Buat Room di Server')
      .setStyle(ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [row] };
}

/**
 * Membuat channel private AI baru untuk seorang member
 */
async function createPrivateAiChannel(guild, member) {
  // Cek apakah member sudah memiliki room AI yang masih aktif
  const existingChannel = await getUserActiveAiChannel(guild, member.id);
  if (existingChannel) {
    return { alreadyExists: true, channel: existingChannel };
  }

  const guildConfig = getPrivateAiConfig(guild.id);
  let parentCategory = null;

  if (guildConfig?.categoryId) {
    parentCategory = guild.channels.cache.get(guildConfig.categoryId) || await guild.channels.fetch(guildConfig.categoryId).catch(() => null);
  }

  // Jika belum ada kategori, buat otomatis
  if (!parentCategory) {
    try {
      parentCategory = await guild.channels.create({
        name: '━━━━ PRIVATE AI CHAT ━━━━',
        type: ChannelType.GuildCategory,
      });
      // Update config categoryId jika ada hubChannelId
      if (guildConfig?.hubChannelId) {
        setPrivateAiConfig(guild.id, guildConfig.hubChannelId, parentCategory.id);
      }
    } catch (e) {
      console.error('Gagal membuat kategori Private AI:', e);
    }
  }

  const safeUsername = member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'member';
  const channelName = `ai-${safeUsername}`;

  // Kunci semua role non-admin agar member lain tidak bisa mengintip
  const overwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  // Kunci eksplisit semua role di server yang bukan Administrator
  guild.roles.cache.forEach((role) => {
    if (role.id !== guild.roles.everyone.id && !role.managed) {
      if (!role.permissions.has(PermissionFlagsBits.Administrator)) {
        overwrites.push({
          id: role.id,
          deny: [PermissionFlagsBits.ViewChannel],
        });
      }
    }
  });

  // Buat private text channel
  const newChannel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: parentCategory?.id || null,
    permissionOverwrites: overwrites,
  });

  // Catat channel aktif
  registerPrivateChannel(newChannel.id, member.id, guild.id);

  // Kirim sambutan di dalam room private AI
  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('ROOM CHAT PRIVAT — FLY')
    .setDescription(
      `Yo <@${member.id}>! Kenalin gue **Fly**, temen AI lo di sini bray.\n\n` +
      `Ruang Santai: Di sini lo bisa curhat, tanya tugas, coding, atau ngobrol santai bebas.\n` +
      `Chat Bebas: Langsung ketik aja tanpa command / dan tanpa mention gue ya.\n` +
      `Memori Sesi: Gue bakal inget obrolan kita di sini biar percakapan kita tetep nyambung.\n\n` +
      `*Ketik apa aja di bawah buat mulai ngobrol!*`
    )
    .setFooter({ text: 'Fly AI Assistant' })
    .setTimestamp();

  const welcomeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_close_private_ai')
      .setLabel('Tutup & Hapus Room')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_clear_private_ai_history')
      .setLabel('Reset Memori Sesi')
      .setStyle(ButtonStyle.Secondary)
  );

  await newChannel.send({
    content: `Halo <@${member.id}>, room chat AI privat kamu sudah siap!`,
    embeds: [welcomeEmbed],
    components: [welcomeRow],
  });

  return { alreadyExists: false, channel: newChannel };
}

/**
 * Menghapus channel private AI
 */
async function deletePrivateAiChannel(channel) {
  unregisterPrivateChannel(channel.id);
  try {
    await channel.delete('Private AI session closed by user');
    return true;
  } catch (error) {
    console.error(`Gagal menghapus channel ${channel.id}:`, error);
    return false;
  }
}

module.exports = {
  getPrivateAiConfig,
  setPrivateAiConfig,
  isPrivateAiChannel,
  getPrivateAiChannelInfo,
  getUserActiveAiChannel,
  getHubPanel,
  createPrivateAiChannel,
  deletePrivateAiChannel,
  unregisterPrivateChannel,
};
