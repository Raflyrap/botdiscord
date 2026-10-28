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

// ==========================================
// MESIN SLOT GACHA KOIN (BUAH-BUAHAN & 777)
// ==========================================
const SLOT_SYMBOLS = [
  { tag: '7️⃣', name: '777', weight: 1, multiplier: 15, xp: 100 },
  { tag: '🍒', name: 'Ceri', weight: 2, multiplier: 10, xp: 75 },
  { tag: '🍇', name: 'Anggur', weight: 3, multiplier: 7, xp: 60 },
  { tag: '🍉', name: 'Semangka', weight: 4, multiplier: 5, xp: 50 },
  { tag: '🍊', name: 'Jeruk', weight: 5, multiplier: 4, xp: 40 },
  { tag: '🍋', name: 'Lemon', weight: 6, multiplier: 3, xp: 30 },
  { tag: '🍓', name: 'Stroberi', weight: 7, multiplier: 3, xp: 30 },
];

function getRandomSlotSymbol() {
  const totalWeight = SLOT_SYMBOLS.reduce((sum, s) => sum + s.weight, 0);
  let random = Math.floor(Math.random() * totalWeight);
  for (const sym of SLOT_SYMBOLS) {
    if (random < sym.weight) return sym;
    random -= sym.weight;
  }
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

function playSlotMachine(guildId, userId, bet = 20) {
  const { getUserData, removeCoins, addReward } = require('./levelingHelper');
  const uData = getUserData(guildId, userId);
  const currentCoins = uData.coins || 0;

  if (currentCoins < bet) {
    return {
      success: false,
      reason: 'INSUFFICIENT_COINS',
      currentCoins,
      requiredCoins: bet,
    };
  }

  // Potong taruhan koin
  removeCoins(guildId, userId, bet);

  // Putar 3 gulungan
  const reel1 = getRandomSlotSymbol();
  const reel2 = getRandomSlotSymbol();
  const reel3 = getRandomSlotSymbol();

  let isWin = false;
  let multiplier = 0;
  let winType = 'ZONK';
  let winTitle = 'Belum Beruntung';
  let xpEarned = 5;

  // Cek 3 simbol kembar (Jackpot)
  if (reel1.tag === reel2.tag && reel2.tag === reel3.tag) {
    isWin = true;
    multiplier = reel1.multiplier;
    xpEarned = reel1.xp;
    if (reel1.tag === '7️⃣') {
      winType = 'SUPER_JACKPOT';
      winTitle = 'JACKPOT 777 SUPER LUCKY!';
    } else if (reel1.tag === '🍒') {
      winType = 'MEGA_JACKPOT';
      winTitle = 'MEGA WIN TRIPLE CERI!';
    } else {
      winType = 'JACKPOT';
      winTitle = `JACKPOT TRIPLE ${reel1.name.toUpperCase()}!`;
    }
  } else if (reel1.tag === reel2.tag || reel2.tag === reel3.tag || reel1.tag === reel3.tag) {
    // 2 simbol kembar (Pair)
    isWin = true;
    multiplier = 1.5;
    winType = 'PAIR';
    winTitle = 'MATCH DUA BUAH KEMBAR!';
    xpEarned = 15;
  }

  const winnings = Math.floor(bet * multiplier);
  const reward = addReward(guildId, userId, {
    coins: winnings,
    xp: xpEarned,
    isWin,
  });

  const finalUserData = reward.userData;

  return {
    success: true,
    reels: [reel1, reel2, reel3],
    bet,
    winnings,
    netProfit: winnings - bet,
    multiplier,
    isWin,
    winType,
    winTitle,
    xpEarned,
    reward,
    finalCoins: finalUserData.coins,
  };
}

function getSlotGameRow(bet = 20) {
  const row = new ActionRowBuilder();

  // Tombol putar ulang dengan taruhan yang sama
  row.addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_game_slot_spin_${bet}`)
      .setLabel(`Putar Lagi (${bet} Koin)`)
      .setStyle(ButtonStyle.Success)
  );

  // Ambil pilihan taruhan lain tanpa menduplikasi customId
  const otherBets = [10, 20, 50, 100].filter((b) => b !== bet).slice(0, 3);
  for (const b of otherBets) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_game_slot_spin_${b}`)
        .setLabel(`Taruhan ${b}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  // Tombol cek saldo koin
  row.addComponents(
    new ButtonBuilder()
      .setCustomId('btn_game_slot_balance')
      .setLabel('Cek Saldo')
      .setStyle(ButtonStyle.Secondary)
  );

  return row;
}

function getSlotChannelRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_game_slot_spin_10')
      .setLabel('Putar 10 Koin')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_game_slot_spin_20')
      .setLabel('Putar 20 Koin')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_game_slot_spin_50')
      .setLabel('Putar 50 Koin')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_game_slot_spin_100')
      .setLabel('Putar 100 Koin')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('btn_game_slot_balance')
      .setLabel('Cek Saldo Koin')
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
      `Uji insting dan tebakan kamu di sini dan menangkan koin serta XP!\n\n` +
      `**Panduan Permainan:**\n` +
      `1. Tentukan pilihan tebakan kamu: **Gambar** atau **Angka**.\n` +
      `2. Klik tombol di bawah untuk langsung melempar koin.\n` +
      `3. Bot akan mengocok koin dan mengumumkan hasilnya.\n` +
      `4. Kamu juga bisa klik tombol **Lempar Acak** untuk sekadar mengocok koin.`
    )
    .addFields(
      { name: 'Pilihan Sisi', value: 'Gambar  |  Angka', inline: true },
      { name: 'Peluang', value: '50% : 50%', inline: true },
      { name: 'Hadiah Kemenangan', value: '+50 Koin & +30 XP', inline: true },
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
    const pins = await (coinChannel.messages.fetchPins ? coinChannel.messages.fetchPins() : coinChannel.messages.fetchPinned()).catch(() => null);
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
      `Tebak angka rahasia antara 1 sampai 100 yang disimpan oleh sistem dan raih jackpot hadiah!\n\n` +
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
      { name: 'Hadiah Juara', value: 'Hingga +200 Koin & +100 XP', inline: true },
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
    const pins = await (numberChannel.messages.fetchPins ? numberChannel.messages.fetchPins() : numberChannel.messages.fetchPinned()).catch(() => null);
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
      `Tantang FlyBot dalam adu pilihan klasik dan dapatkan koin serta XP!\n\n` +
      `**Aturan Permainan:**\n` +
      `• Batu mengalahkan Gunting\n` +
      `• Gunting mengalahkan Kertas\n` +
      `• Kertas mengalahkan Batu\n\n` +
      `Cukup klik salah satu tombol pilihan kamu di bawah ini untuk memulai duel.`
    )
    .addFields(
      { name: 'Lawan', value: 'FlyBot AI (Acak)', inline: true },
      { name: 'Sistem', value: 'Respons Instan', inline: true },
      { name: 'Hadiah', value: 'Menang: +50 Koin | Seri: +20 Koin', inline: false },
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
    const pins = await (rpsChannel.messages.fetchPins ? rpsChannel.messages.fetchPins() : rpsChannel.messages.fetchPinned()).catch(() => null);
    if (!pins || pins.size === 0) {
      const sentRps = await rpsChannel.send({ embeds: [rpsEmbed], components: [getRpsGameRow()] });
      await sentRps.pin().catch(() => {});
    }
  }

  // 5. Channel 4: Gacha Slot Mesin Buah 777
  const slotEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: 'FlyBot  •  Gacha Slot Buah 777', iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('Arena Mesin Slot Buah 777')
    .setDescription(
      `Selamat datang di Arena Mesin Slot Buah.\n` +
      `Gunakan saldo koin hasil chat, klaim /daily, dan kemenangan mini game untuk memutar mesin slot buah dan raih JACKPOT 777 hingga 15x lipat!\n\n` +
      `**Tabel Pembayaran Slot Buah:**\n` +
      `• 3x 7️⃣  --  JACKPOT 777 15x Taruhan (+100 XP)\n` +
      `• 3x 🍒  --  Triple Ceri 10x Taruhan (+75 XP)\n` +
      `• 3x 🍇  --  Triple Anggur 7x Taruhan (+60 XP)\n` +
      `• 3x 🍉  --  Triple Semangka 5x Taruhan (+50 XP)\n` +
      `• 3x 🍊  --  Triple Jeruk 4x Taruhan (+40 XP)\n` +
      `• 3x 🍋 / 🍓  --  Triple Lemon/Stroberi 3x Taruhan (+30 XP)\n` +
      `• 2 Buah Kembar  --  Match Dua Buah 1.5x Taruhan (+15 XP)\n` +
      `• Tidak Cocok  --  Zonk (+5 XP Partisipasi)\n\n` +
      `Klik salah satu tombol taruhan di bawah atau ketik /slot untuk langsung memutar mesin slot!`
    )
    .addFields(
      { name: 'Taruhan Cepat', value: '10  |  20  |  50  |  100 Koin', inline: true },
      { name: 'Jackpot Utama', value: '777 (15x Lipat)', inline: true },
      { name: 'Koin Berguna', value: 'Taruhan & Gacha', inline: true },
    )
    .setFooter({ text: 'Pesan disematkan permanen • Klik tombol di bawah untuk memutar slot' })
    .setTimestamp();

  let slotChannel = cfg.slotChannelId ? guild.channels.cache.get(cfg.slotChannelId) : null;
  if (!slotChannel) {
    slotChannel = await guild.channels.create({
      name: 'gacha-slot',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
      reason: 'Mini Game - Gacha Slot',
    });

    const sentSlot = await slotChannel.send({ embeds: [slotEmbed], components: [getSlotChannelRow()] });
    await sentSlot.pin().catch(() => {});
  } else {
    const pins = await (slotChannel.messages.fetchPins ? slotChannel.messages.fetchPins() : slotChannel.messages.fetchPinned()).catch(() => null);
    if (!pins || pins.size === 0) {
      const sentSlot = await slotChannel.send({ embeds: [slotEmbed], components: [getSlotChannelRow()] });
      await sentSlot.pin().catch(() => {});
    }
  }

  // 6. Channel 5: Sambung Kata KBBI
  const { getSambungKataPanelEmbed, getSambungKataActionRow } = require('./sambungKataHelper');
  let sambungKataChannel = cfg.sambungKataChannelId ? guild.channels.cache.get(cfg.sambungKataChannelId) : null;
  if (!sambungKataChannel) {
    sambungKataChannel = await guild.channels.create({
      name: 'sambung-kata',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: channelOverwrites,
      reason: 'Mini Game - Sambung Kata KBBI',
    });

    const sentSambung = await sambungKataChannel.send({ embeds: [getSambungKataPanelEmbed(guild)], components: [getSambungKataActionRow()] });
    await sentSambung.pin().catch(() => {});
  } else {
    const pins = await (sambungKataChannel.messages.fetchPins ? sambungKataChannel.messages.fetchPins() : sambungKataChannel.messages.fetchPinned()).catch(() => null);
    if (!pins || pins.size === 0) {
      const sentSambung = await sambungKataChannel.send({ embeds: [getSambungKataPanelEmbed(guild)], components: [getSambungKataActionRow()] });
      await sentSambung.pin().catch(() => {});
    }
  }

  // Simpan konfigurasi
  setGameConfig(guild.id, {
    categoryId: category.id,
    coinChannelId: coinChannel.id,
    numberChannelId: numberChannel.id,
    rpsChannelId: rpsChannel.id,
    slotChannelId: slotChannel.id,
    sambungKataChannelId: sambungKataChannel.id,
    enabled: true,
  });

  return {
    category,
    coinChannel,
    numberChannel,
    rpsChannel,
    slotChannel,
    sambungKataChannel,
  };
}

// Menghapus kategori dan channel mini game
async function removeMiniGames(guild) {
  const cfg = getGameConfig(guild.id);
  if (!cfg) return false;

  const channelIds = [cfg.coinChannelId, cfg.numberChannelId, cfg.rpsChannelId, cfg.slotChannelId, cfg.sambungKataChannelId];
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
    slotChannelId: null,
    sambungKataChannelId: null,
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
  playSlotMachine,
  getSlotGameRow,
  getSlotChannelRow,
};
