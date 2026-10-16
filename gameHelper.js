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

const CONFIG_PATH = path.join(__dirname, 'gameConfig.json');

function loadGameConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{}');
  } catch (err) {
    console.error('Error loadGameConfig:', err.message);
    return {};
  }
}

function saveGameConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saveGameConfig:', err.message);
  }
}

function getGameConfig(guildId) {
  const configs = loadGameConfig();
  return configs[guildId] || null;
}

function setGameConfig(guildId, data) {
  const configs = loadGameConfig();
  configs[guildId] = { ...(configs[guildId] || {}), ...data };
  saveGameConfig(configs);
  return configs[guildId];
}

// Memory state untuk game Tebak Angka per server
const activeNumberGames = new Map();

function startNumberGuessing(guildId, starterId) {
  const target = Math.floor(Math.random() * 100) + 1;
  const state = {
    target,
    starterId,
    attempts: 0,
    startedAt: Date.now(),
    active: true,
  };
  activeNumberGames.set(guildId, state);
  return state;
}

function getNumberGuessingState(guildId) {
  return activeNumberGames.get(guildId) || null;
}

function checkNumberGuess(guildId, guess) {
  const state = activeNumberGames.get(guildId);
  if (!state || !state.active) return null;

  state.attempts += 1;
  if (guess < state.target) {
    return { status: 'LOW', attempts: state.attempts, target: state.target };
  } else if (guess > state.target) {
    return { status: 'HIGH', attempts: state.attempts, target: state.target };
  } else {
    state.active = false;
    return { status: 'CORRECT', attempts: state.attempts, target: state.target };
  }
}

function resetNumberGuessing(guildId) {
  activeNumberGames.delete(guildId);
}

// Generator ActionRow Tombol Game (Tanpa Emoji)
function getCoinGameRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_game_coin_gambar')
      .setLabel('Tebak Gambar')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_game_coin_angka')
      .setLabel('Tebak Angka')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_game_coin_random')
      .setLabel('Lempar Acak')
      .setStyle(ButtonStyle.Secondary)
  );
}

function getRpsGameRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_game_rps_rock')
      .setLabel('Batu')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_game_rps_paper')
      .setLabel('Kertas')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_game_rps_scissors')
      .setLabel('Gunting')
      .setStyle(ButtonStyle.Danger)
  );
}

function getNumberGameRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_game_number_start')
      .setLabel('Main Lagi')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_game_number_status')
      .setLabel('Cek Status')
      .setStyle(ButtonStyle.Secondary)
  );
}

// Auto-setup kategori dan 3 channel mini game
async function setupMiniGames(guild) {
  const cfg = getGameConfig(guild.id) || {};

  // 1. Kategori (Tanpa Emoji)
  let category = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes('MINI GAMES')
    );
  }

  if (!category) {
    category = await guild.channels.create({
      name: 'MINI GAMES',
      type: ChannelType.GuildCategory,
      reason: 'Auto-setup Kategori Mini Games',
    });
  }

  // Overwrites: semua member bisa melihat & mengetik
  const channelOverwrites = [
    {
      id: guild.roles.everyone.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  // 2. Channel 1: Tebak Koin (Tanpa Emoji)
  const coinEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'FlyBot  •  Tebak Koin', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('Arena Tebak Koin')
    .setDescription(
      `Selamat datang di Arena Tebak Koin.\n` +
      `Uji insting dan tebakan kamu di sini.\n\n` +
      `**Panduan Permainan:**\n` +
      `1. Tentukan pilihan tebakan kamu: **Gambar** atau **Angka**.\n` +
      `2. Klik tombol di bawah untuk langsung melempar koin.\n` +
      `3. Bot akan mengocok koin dan mengumumkan hasilnya.\n` +
      `4. Kamu juga bisa klik tombol **Lempar Acak** untuk sekadar mengocok koin.`
    )
    .addFields(
      { name: 'Pilihan Sisi', value: 'Gambar  |  Angka', inline: true },
      { name: 'Peluang', value: '50% : 50%', inline: true },
    )
    .setFooter({ text: 'Pesan disematkan permanen • Klik tombol di bawah untuk bermain' })
    .setTimestamp();

  let coinChannel = cfg.coinChannelId ? guild.channels.cache.get(cfg.coinChannelId) : null;
  if (!coinChannel) {
    coinChannel = await guild.channels.create({
      name: 'tebak-koin',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
      reason: 'Mini Game - Tebak Koin',
    });

    const sentCoin = await coinChannel.send({ embeds: [coinEmbed], components: [getCoinGameRow()] });
    await sentCoin.pin().catch(() => {});
  } else {
    const pins = await coinChannel.messages.fetchPinned().catch(() => null);
    if (!pins || pins.size === 0) {
      const sentCoin = await coinChannel.send({ embeds: [coinEmbed], components: [getCoinGameRow()] });
      await sentCoin.pin().catch(() => {});
    }
  }

  // 3. Channel 2: Tebak Angka (Tanpa Emoji)
  const numberEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'FlyBot  •  Tebak Angka', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('Arena Tebak Angka (1 - 100)')
    .setDescription(
      `Selamat datang di Arena Tebak Angka.\n` +
      `Tebak angka rahasia antara 1 sampai 100 yang disimpan oleh sistem.\n\n` +
      `**Panduan Permainan:**\n` +
      `1. Klik tombol **Main Lagi** di bawah untuk memulai ronde baru.\n` +
      `2. Ketik angka tebakan kamu (contoh: 50) langsung di chat channel ini.\n` +
      `3. Bot akan memberikan petunjuk arah:\n` +
      `   • [Terlalu KECIL] Angka rahasia lebih besar dari tebakanmu\n` +
      `   • [Terlalu BESAR] Angka rahasia lebih kecil dari tebakanmu\n` +
      `4. Member yang berhasil menebak dengan tepat dinyatakan sebagai pemenang.`
    )
    .addFields(
      { name: 'Rentang Angka', value: '1 sampai 100', inline: true },
      { name: 'Mode', value: 'Multiplayer Komunitas', inline: true },
    )
    .setFooter({ text: 'Pesan disematkan permanen • Klik tombol di bawah untuk mulai' })
    .setTimestamp();

  let numberChannel = cfg.numberChannelId ? guild.channels.cache.get(cfg.numberChannelId) : null;
  if (!numberChannel) {
    numberChannel = await guild.channels.create({
      name: 'tebak-angka',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
      reason: 'Mini Game - Tebak Angka',
    });

    const sentNumber = await numberChannel.send({ embeds: [numberEmbed], components: [getNumberGameRow()] });
    await sentNumber.pin().catch(() => {});
  } else {
    const pins = await numberChannel.messages.fetchPinned().catch(() => null);
    if (!pins || pins.size === 0) {
      const sentNumber = await numberChannel.send({ embeds: [numberEmbed], components: [getNumberGameRow()] });
      await sentNumber.pin().catch(() => {});
    }
  }

  // 4. Channel 3: Suit Jepang (Tanpa Emoji)
  const rpsEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'FlyBot  •  Suit Jepang', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('Arena Suit (Gunting Batu Kertas)')
    .setDescription(
      `Tantang FlyBot dalam adu pilihan klasik.\n\n` +
      `**Aturan Permainan:**\n` +
      `• Batu mengalahkan Gunting\n` +
      `• Gunting mengalahkan Kertas\n` +
      `• Kertas mengalahkan Batu\n\n` +
      `Cukup klik salah satu tombol pilihan kamu di bawah ini untuk memulai duel.`
    )
    .addFields(
      { name: 'Lawan', value: 'FlyBot AI (Acak)', inline: true },
      { name: 'Sistem', value: 'Respons Instan', inline: true },
    )
    .setFooter({ text: 'Pesan disematkan permanen • Pilih Batu, Kertas, atau Gunting di bawah' })
    .setTimestamp();

  let rpsChannel = cfg.rpsChannelId ? guild.channels.cache.get(cfg.rpsChannelId) : null;
  if (!rpsChannel) {
    rpsChannel = await guild.channels.create({
      name: 'suit-jepang',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
      reason: 'Mini Game - Suit Jepang',
    });

    const sentRps = await rpsChannel.send({ embeds: [rpsEmbed], components: [getRpsGameRow()] });
    await sentRps.pin().catch(() => {});
  } else {
    const pins = await rpsChannel.messages.fetchPinned().catch(() => null);
    if (!pins || pins.size === 0) {
      const sentRps = await rpsChannel.send({ embeds: [rpsEmbed], components: [getRpsGameRow()] });
      await sentRps.pin().catch(() => {});
    }
  }

  // Simpan konfigurasi
  setGameConfig(guild.id, {
    categoryId: category.id,
    coinChannelId: coinChannel.id,
    numberChannelId: numberChannel.id,
    rpsChannelId: rpsChannel.id,
    enabled: true,
  });

  return {
    category,
    coinChannel,
    numberChannel,
    rpsChannel,
  };
}

// Menghapus kategori dan channel mini game
async function removeMiniGames(guild) {
  const cfg = getGameConfig(guild.id);
  if (!cfg) return false;

  const channelIds = [cfg.coinChannelId, cfg.numberChannelId, cfg.rpsChannelId];
  for (const id of channelIds) {
    if (id) {
      const ch = guild.channels.cache.get(id) || await guild.channels.fetch(id).catch(() => null);
      if (ch) await ch.delete('Hapus mini games').catch(() => {});
    }
  }

  if (cfg.categoryId) {
    const cat = guild.channels.cache.get(cfg.categoryId) || await guild.channels.fetch(cfg.categoryId).catch(() => null);
    if (cat) await cat.delete('Hapus kategori mini games').catch(() => {});
  }

  setGameConfig(guild.id, {
    categoryId: null,
    coinChannelId: null,
    numberChannelId: null,
    rpsChannelId: null,
    enabled: false,
  });

  resetNumberGuessing(guild.id);
  return true;
}

module.exports = {
  getGameConfig,
  setGameConfig,
  setupMiniGames,
  removeMiniGames,
  startNumberGuessing,
  getNumberGuessingState,
  checkNumberGuess,
  resetNumberGuessing,
  getCoinGameRow,
  getRpsGameRow,
  getNumberGameRow,
};
