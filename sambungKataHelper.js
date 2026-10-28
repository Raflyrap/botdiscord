const fs = require('fs');
const path = require('path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

const KBBI_FILE = path.join(__dirname, 'kbbiWords.json');
const DATA_FILE = path.join(__dirname, 'sambungKataData.json');

// Memory storage
let KBBI_SET = new Set();
let PREFIX_MAP = new Map();
let activeGames = new Map(); // guildId -> game object

const TIMEOUT_SECONDS = 30;

// Daftar kata pembuka yang dijamin seimbang dan memiliki banyak sambungan
const STARTER_WORDS = [
  'nasi', 'kopi', 'pintu', 'bunga', 'bintang',
  'kereta', 'kelapa', 'kucing', 'rumah', 'pantai',
  'sungai', 'pohon', 'lampu', 'kertas', 'sepatu',
  'kamus', 'senja', 'bulan', 'hutan', 'danau',
  'pulau', 'udara', 'sayur', 'buku', 'pena'
];

/**
 * Muat kamus KBBI dan bangun indeks awalan 2 huruf O(1)
 */
function initSambungKata() {
  try {
    if (fs.existsSync(KBBI_FILE)) {
      const words = JSON.parse(fs.readFileSync(KBBI_FILE, 'utf8'));
      KBBI_SET = new Set(words);
      PREFIX_MAP = new Map();

      for (const w of words) {
        if (w.length < 3) continue;
        const p = w.slice(0, 2);
        if (!PREFIX_MAP.has(p)) PREFIX_MAP.set(p, []);
        PREFIX_MAP.get(p).push(w);
      }
      console.log(`[SAMBUNG KATA] Kamus KBBI siap dengan ${KBBI_SET.size.toLocaleString('id-ID')} kata.`);
    } else {
      console.warn('[SAMBUNG KATA] kbbiWords.json tidak ditemukan.');
    }
  } catch (err) {
    console.error('[SAMBUNG KATA INIT ERROR]:', err);
  }
}

// Inisialisasi saat load file
initSambungKata();

/**
 * Baca dan simpan rekor permainan
 */
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { highScores: {} };
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {}
}

function getHighScore(guildId) {
  const data = loadData();
  return data.highScores?.[guildId] || 0;
}

function setHighScore(guildId, score) {
  const data = loadData();
  if (!data.highScores) data.highScores = {};
  if (score > (data.highScores[guildId] || 0)) {
    data.highScores[guildId] = score;
    saveData(data);
    return true;
  }
  return false;
}

/**
 * Panel Peraturan Permainan Sambung Kata (Disematkan Permanen)
 */
function getSambungKataPanelEmbed(guild) {
  const high = getHighScore(guild.id);
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${guild.name} • Arena Mini Games`,
      iconURL: guild.client.user.displayAvatarURL(),
    })
    .setTitle('Arena Sambung Kata KBBI (2 Huruf Belakang)')
    .setDescription(
      `Selamat datang di Arena Sambung Kata Resmi Bahasa Indonesia.\n` +
      `Uji kekayaan kosakatamu dan duel langsung saling berbalas kata bersama FlyBot!\n\n` +
      `**Peraturan Permainan:**\n` +
      `1. **Aturan 2 Huruf Belakang:**\n` +
      `   Sambung **2 huruf terakhir** dari kata sebelumnya menjadi awalan kata barumu.\n` +
      `   *Contoh:* **na-si** ➔ **si-ang** ➔ **ng-an-tuk** ➔ **uk-ur**.\n\n` +
      `2. **Duel Saling Jawab Melawan Bot:**\n` +
      `   Setelah kamu menjawab kata yang valid, FlyBot akan membalas kata berikutnya. Member lain atau kamu bisa melanjutkan giliran berikutnya.\n\n` +
      `3. **Batas Waktu (Timer 30 Detik):**\n` +
      `   Setiap giliran member hanya memiliki batas waktu **30 detik** untuk menjawab. Jika lewat, ronde dinyatakan berakhir (waktu habis).\n\n` +
      `4. **Standar Baku KBBI Resmi:**\n` +
      `   Seluruh kata wajib terdaftar dalam Kamus Besar Bahasa Indonesia (KBBI). Kata bahasa asing, bahasa gaul tidak baku, dan typo akan ditolak.\n\n` +
      `5. **Tidak Boleh Mengulang Kata:**\n` +
      `   Kata yang sudah pernah keluar dalam ronde yang sama tidak boleh digunakan kembali.\n\n` +
      `6. **Hadiah Koin & XP:**\n` +
      `   Setiap tebakan kata yang valid memberikan **+15 Koin & +10 XP** serta bonus streak kelipatan 5 kata!`
    )
    .addFields(
      { name: 'Waktu Per Giliran', value: '30 Detik', inline: true },
      { name: 'Kamus Referensi', value: 'KBBI Resmi V6', inline: true },
      { name: 'Rekor Server', value: `${high} Kata Tersambung`, inline: true }
    )
    .setFooter({ text: 'Ketik kata tebakanmu langsung di chat atau klik Mulai Ronde Baru di bawah!' })
    .setTimestamp();
}

function getSambungKataActionRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_sambung_kata_start')
      .setLabel('Mulai Ronde Baru')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_sambung_kata_status')
      .setLabel('Cek Status Game')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('btn_sambung_kata_rules')
      .setLabel('Peraturan Game')
      .setStyle(ButtonStyle.Secondary)
  );
}

/**
 * Cek apakah kata valid di KBBI
 */
function isValidKbbiWord(word) {
  if (!word || typeof word !== 'string') return false;
  const clean = word.trim().toLowerCase();
  return KBBI_SET.has(clean);
}

/**
 * Mulai ronde baru
 */
async function startNewRound(channel, guild, starter = null) {
  if (activeGames.has(guild.id)) {
    const existing = activeGames.get(guild.id);
    if (existing.timer) clearTimeout(existing.timer);
  }

  let starterWord = starter;
  if (!starterWord) {
    starterWord = STARTER_WORDS[Math.floor(Math.random() * STARTER_WORDS.length)];
  }

  const targetPrefix = starterWord.slice(-2);

  const gameState = {
    guildId: guild.id,
    channelId: channel.id,
    active: true,
    currentWord: starterWord,
    targetPrefix: targetPrefix,
    usedWords: [starterWord],
    streak: 1,
    turn: 'player', // 'player' atau 'bot'
    lastPlayerId: null,
    timer: null,
    startedAt: Date.now(),
  };

  activeGames.set(guild.id, gameState);

  // Pasang timer 30 detik untuk giliran member pertama
  armTimer(guild.id, channel);

  const startEmbed = new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('Ronde Sambung Kata Dimulai!')
    .setDescription(
      `Kata pembuka dari FlyBot:\n` +
      `# **"${starterWord.toUpperCase()}"**\n\n` +
      `2 huruf terakhir: **\`${targetPrefix.toUpperCase()}\`**\n` +
      `Ayo sambung dengan kata baku KBBI yang berawalan **\`${targetPrefix.toUpperCase()}\`**!\n\n` +
      `• *Waktu menjawab:* **30 Detik**\n` +
      `• *Contoh format:* Cukup ketik katanya langsung di chat!`
    )
    .setFooter({ text: 'Timer 30 detik sedang berjalan...' })
    .setTimestamp();

  await channel.send({ embeds: [startEmbed] }).catch(() => {});
  return gameState;
}

/**
 * Pasang countdown timer 30 detik
 */
function armTimer(guildId, channel) {
  const game = activeGames.get(guildId);
  if (!game) return;

  if (game.timer) clearTimeout(game.timer);

  game.timer = setTimeout(async () => {
    await handleTimeout(guildId, channel);
  }, TIMEOUT_SECONDS * 1000);
}

/**
 * Penanganan Waktu Habis (Timeout 30 Detik)
 */
async function handleTimeout(guildId, channel) {
  const game = activeGames.get(guildId);
  if (!game || !game.active) return;

  game.active = false;
  if (game.timer) clearTimeout(game.timer);

  const streakAchieved = Math.max(0, game.streak - 1);
  const isNewRecord = setHighScore(guildId, streakAchieved);

  let desc =
    `Waktu **30 detik** telah habis! Tidak ada jawaban yang masuk untuk menyambung kata **"${game.currentWord.toUpperCase()}"** (awalan \`${game.targetPrefix.toUpperCase()}\`).\n\n` +
    `• Total Kata Tersambung Ronde Ini: **${streakAchieved} Kata**\n`;

  if (isNewRecord && streakAchieved > 0) {
    desc += `• **REKOR BARU SERVER!** Rekor tertinggi server diperbarui menjadi **${streakAchieved} Kata**!\n`;
  } else {
    desc += `• Rekor Tertinggi Server: **${getHighScore(guildId)} Kata**\n`;
  }

  desc += `\nTekan tombol **Mulai Ronde Baru** di bawah untuk memulai tantangan berikutnya!`;

  const timeoutEmbed = new EmbedBuilder()
    .setColor(0xED4245)
    .setTitle('Waktu Habis! Ronde Berakhir')
    .setDescription(desc)
    .setFooter({ text: 'FlyBot Sambung Kata • Batas Waktu 30 Detik' })
    .setTimestamp();

  await channel.send({
    embeds: [timeoutEmbed],
    components: [getSambungKataActionRow()],
  }).catch(() => {});
}

/**
 * Handler pesan chat member di channel sambung kata
 */
async function handlePlayerWord(message) {
  const guild = message.guild;
  if (!guild || message.author.bot) return false;

  const game = activeGames.get(guild.id);
  if (!game || !game.active) return false;
  if (message.channelId !== game.channelId) return false;

  // Hanya periksa pesan kata tunggal huruf latin (abaikan pesan panjang obrolan biasa atau perintah)
  const rawContent = message.content.trim();
  if (rawContent.startsWith('/') || rawContent.startsWith('!')) return false;

  const cleanWord = rawContent.toLowerCase().replace(/[^a-z]/g, '');
  if (!cleanWord || cleanWord.length < 2 || rawContent.includes(' ')) {
    return false;
  }

  // Cek apakah sedang giliran bot
  if (game.turn === 'bot') {
    return false;
  }

  // 1. Cek awalan 2 huruf
  const expectedPrefix = game.targetPrefix.toLowerCase();
  const playerPrefix = cleanWord.slice(0, 2);

  if (playerPrefix !== expectedPrefix) {
    await message.react('❌').catch(() => {});
    await message.reply({
      content: `Kata salah! Kamu harus mengetik kata yang berawalan **\`${expectedPrefix.toUpperCase()}\`** (2 huruf akhir dari **"${game.currentWord}"**).`,
    }).catch(() => {});
    return true;
  }

  // 2. Cek apakah ada di KBBI
  if (!isValidKbbiWord(cleanWord)) {
    await message.react('❌').catch(() => {});
    await message.reply({
      content: `Kata **"${cleanWord}"** tidak ditemukan di dalam kamus resmi KBBI! Gunakan kata baku bahasa Indonesia.`,
    }).catch(() => {});
    return true;
  }

  // 3. Cek apakah kata sudah pernah dipakai dalam ronde ini
  if (game.usedWords.includes(cleanWord)) {
    await message.react('⚠️').catch(() => {});
    await message.reply({
      content: `Kata **"${cleanWord}"** sudah pernah digunakan pada ronde ini! Cari kata lain berawalan **\`${expectedPrefix.toUpperCase()}\`**.`,
    }).catch(() => {});
    return true;
  }

  // === JAWABAN BENAR DARI MEMBER ===
  if (game.timer) clearTimeout(game.timer);
  await message.react('✅').catch(() => {});

  game.usedWords.push(cleanWord);
  game.streak++;
  game.currentWord = cleanWord;
  game.lastPlayerId = message.author.id;

  // Berikan reward koin dan XP
  const { addReward } = require('./levelingHelper');
  const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');

  let coinsEarned = 15;
  let xpEarned = 10;

  // Bonus streak kelipatan 5 kata
  if (game.streak % 5 === 0) {
    coinsEarned += 25;
    xpEarned += 20;
  }

  const reward = addReward(guild.id, message.author.id, {
    coins: coinsEarned,
    xp: xpEarned,
    isWin: true,
  });

  const nextPrefixForBot = cleanWord.slice(-2);
  const currentStreak = game.streak - 1;

  let memberReply =
    `Jawaban Tepat! **${message.author.username}** menyambung kata **"${cleanWord.toUpperCase()}"**.\n` +
    `• Hadiah: **+${coinsEarned} Koin** & **+${xpEarned} XP** (Total Streak: **${currentStreak} Kata**)\n` +
    `• 2 Huruf Berikutnya: **\`${nextPrefixForBot.toUpperCase()}\`**\n\n` +
    `*FlyBot sedang memikirkan balasan...*`;

  await message.reply({ content: memberReply }).catch(() => {});

  // Dispatch level up jika ada
  if (reward && reward.leveledUp) {
    dispatchLevelUpAndAchievements(guild, message.member, message.author, message.channel, reward).catch(() => {});
  }

  // === GILIRAN BOT MEMBALAS ===
  game.turn = 'bot';

  setTimeout(async () => {
    await processBotTurn(guild, message.channel, nextPrefixForBot);
  }, 1500);

  return true;
}

/**
 * Giliran bot mencari dan membalas kata
 */
async function processBotTurn(guild, channel, prefix) {
  const game = activeGames.get(guild.id);
  if (!game || !game.active) return;

  const candidates = PREFIX_MAP.get(prefix) || [];
  // Filter kandidat yang belum pernah dipakai dan yang akhirannya aman untuk dilanjutkan player
  const eligible = candidates.filter((w) => {
    if (game.usedWords.includes(w)) return false;
    const last2 = w.slice(-2);
    const playerContinuations = PREFIX_MAP.get(last2) || [];
    return playerContinuations.length >= 2;
  });

  // Jika bot kehabisan kata yang ramah pemain, coba kata apa saja yang belum dipakai
  let chosenWord = null;
  if (eligible.length > 0) {
    chosenWord = eligible[Math.floor(Math.random() * eligible.length)];
  } else {
    const backup = candidates.filter((w) => !game.usedWords.includes(w));
    if (backup.length > 0) {
      chosenWord = backup[Math.floor(Math.random() * backup.length)];
    }
  }

  if (!chosenWord) {
    // BOT KALAH / KEHABISAN KATA!
    game.active = false;
    if (game.timer) clearTimeout(game.timer);

    const winStreak = game.streak;
    setHighScore(guild.id, winStreak);

    const botDefeatEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('FlyBot Kehabisan Kata! Member Menang!')
      .setDescription(
        `Luar biasa! FlyBot tidak dapat menemukan kata baku KBBI yang tersisa untuk awalan **\`${prefix.toUpperCase()}\`**!\n\n` +
        `• **Pemenang Terakhir:** <@${game.lastPlayerId}>\n` +
        `• **Total Rantai Kata:** **${winStreak} Kata**\n` +
        `• **Bonus Kemenangan:** Seluruh member yang berpartisipasi berhasil menaklukkan bot!\n\n` +
        `Klik tombol di bawah untuk memulai ronde baru!`
      )
      .setFooter({ text: 'Selamat kepada para pemain!' })
      .setTimestamp();

    await channel.send({
      embeds: [botDefeatEmbed],
      components: [getSambungKataActionRow()],
    }).catch(() => {});
    return;
  }

  // Bot berhasil menemukan kata
  game.usedWords.push(chosenWord);
  game.streak++;
  game.currentWord = chosenWord;
  game.targetPrefix = chosenWord.slice(-2);
  game.turn = 'player';

  // Pasang timer 30 detik untuk giliran member berikutnya
  armTimer(guild.id, channel);

  const botEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`FlyBot: "${chosenWord.toUpperCase()}"`)
    .setDescription(
      `FlyBot membalas kata: **\`${chosenWord.toUpperCase()}\`**\n\n` +
      `Giliran member menyambung 2 huruf terakhir: **\`${game.targetPrefix.toUpperCase()}\`**\n` +
      `• *Sisa Waktu:* **30 Detik**\n` +
      `• *Rantai Kata Saat Ini:* **${game.streak} Kata**`
    )
    .setFooter({ text: 'Ketik langsung kata KBBI berawalan 2 huruf tersebut di chat!' })
    .setTimestamp();

  await channel.send({ embeds: [botEmbed] }).catch(() => {});
}

/**
 * Ambil status game saat ini untuk tombol Cek Status
 */
function getGameStatus(guildId) {
  const game = activeGames.get(guildId);
  if (!game || !game.active) {
    return {
      active: false,
      message: 'Saat ini belum ada ronde sambung kata yang sedang berjalan. Klik tombol **Mulai Ronde Baru** untuk bermain!',
    };
  }

  return {
    active: true,
    currentWord: game.currentWord,
    targetPrefix: game.targetPrefix,
    streak: game.streak,
    usedCount: game.usedWords.length,
    highScore: getHighScore(guildId),
  };
}

module.exports = {
  initSambungKata,
  isValidKbbiWord,
  getSambungKataPanelEmbed,
  getSambungKataActionRow,
  startNewRound,
  handlePlayerWord,
  getGameStatus,
  getHighScore,
};
