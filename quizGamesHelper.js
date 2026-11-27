const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { addReward } = require('./levelingHelper');
const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');

/**
 * Daftar 8 Mini Games Kuis & Tebak-Tebakan (Powered by Xemoz API)
 * Terhubung penuh ke sistem XP, Level, Koin, dan Achievement FlyBot!
 */
const QUIZ_GAMES = {
  lengkapikalimat: {
    key: 'lengkapikalimat',
    channelName: '🎮︱lengkapi-kalimat',
    keyword: 'lengkapi-kalimat',
    configKey: 'lengkapiKalimatId',
    title: '✍️ Arena Lengkapi Kalimat',
    description: 'Lengkapi peribahasa atau kalimat rumpang berikut ini dengan kata yang tepat!',
    url: 'https://api-xemoz-official.my.id/api/game/lengkapikalimat.php',
    coins: 80,
    xp: 55,
    color: 0x5865F2,
  },
  karakterff: {
    key: 'karakterff',
    channelName: '🎮︱tebak-karakter-ff',
    keyword: 'tebak-karakter-ff',
    configKey: 'karakterFfId',
    title: '🔥 Arena Tebak Karakter Free Fire',
    description: 'Tebak nama karakter Free Fire yang muncul pada gambar di bawah ini!',
    url: 'https://api-xemoz-official.my.id/api/game/karakter-freefire.php',
    coins: 90,
    xp: 60,
    color: 0xFF9900,
  },
  mtk: {
    key: 'mtk',
    channelName: '🎮︱kuis-matematika',
    keyword: 'kuis-matematika',
    configKey: 'mtkId',
    title: '🧮 Arena Kuis Matematika',
    description: 'Hitung cepat soal matematika berikut ini dan ketik hasil angkanya di chat!',
    url: 'https://api-xemoz-official.my.id/api/game/mtk.php?level=medium',
    coins: 100,
    xp: 65,
    color: 0x00B0F4,
  },
  siapakahaku: {
    key: 'siapakahaku',
    channelName: '🎮︱siapakah-aku',
    keyword: 'siapakah-aku',
    configKey: 'siapakahAkuId',
    title: '🕵️ Arena Siapakah Aku',
    description: 'Baca petunjuk teka-teki berikut dan tebak siapakah atau apakah yang dimaksud!',
    url: 'https://api-xemoz-official.my.id/api/game/siapakahaku.php',
    coins: 80,
    xp: 55,
    color: 0x9B59B6,
  },
  susunkata: {
    key: 'susunkata',
    channelName: '🎮︱susun-kata',
    keyword: 'susun-kata',
    configKey: 'susunKataId',
    title: '🧩 Arena Susun Kata',
    description: 'Susun huruf-huruf acak berikut menjadi kata Bahasa Indonesia yang benar!',
    url: 'https://api-xemoz-official.my.id/api/game/susunkata.php',
    coins: 85,
    xp: 60,
    color: 0x1ABC9C,
  },
  tebakgambar: {
    key: 'tebakgambar',
    channelName: '🎮︱tebak-gambar',
    keyword: 'tebak-gambar',
    configKey: 'tebakGambarId',
    title: '🎨 Arena Tebak Gambar',
    description: 'Perhatikan gambar petunjuk dengan teliti dan tebak frasa/kalimat tersembunyinya!',
    url: 'https://api-xemoz-official.my.id/api/game/tebakgambar.php',
    coins: 110,
    xp: 75,
    color: 0xE67E22,
  },
  tebakgame: {
    key: 'tebakgame',
    channelName: '🎮︱tebak-game',
    keyword: 'tebak-game',
    configKey: 'tebakGameId',
    title: '🕹️ Arena Tebak Game',
    description: 'Tebak judul game populer berdasarkan cuplikan gambar di bawah ini!',
    url: 'https://api-xemoz-official.my.id/api/game/tebakgame.php',
    coins: 95,
    xp: 65,
    color: 0x57F287,
  },
  tebaklogo: {
    key: 'tebaklogo',
    channelName: '🎮︱tebak-logo',
    keyword: 'tebak-logo',
    configKey: 'tebakLogoId',
    title: '💠 Arena Tebak Logo',
    description: 'Tebak nama brand, aplikasi, atau perusahaan dari logo yang ditampilkan!',
    url: 'https://api-xemoz-official.my.id/api/game/tebaklogo.php',
    coins: 90,
    xp: 60,
    color: 0xEB459E,
  },
};

const QUIZ_GAME_LIST = Object.values(QUIZ_GAMES);

// State kuis aktif per channelId
const activeQuizzes = new Map();

function normalizeAnswer(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Menghitung jarak Levenshtein untuk deteksi jawaban "Hampir Benar"
 */
function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[b.length][a.length];
}

function buildMaskedHint(answer) {
  const clean = String(answer || '').trim();
  return clean
    .split('')
    .map((ch, idx) => {
      if (ch === ' ' || ch === '-') return ch;
      if (idx === 0 || idx === clean.length - 1 || idx % 3 === 0) return ch.toUpperCase();
      return '_';
    })
    .join(' ');
}

function getQuizPanelEmbed(guild, gameDef) {
  return new EmbedBuilder()
    .setColor(gameDef.color)
    .setAuthor({
      name: `${guild.name} • Arena Mini Games`,
      iconURL: guild.client.user.displayAvatarURL(),
    })
    .setTitle(gameDef.title)
    .setDescription(
      `${gameDef.description}\n\n` +
      `**Cara Bermain:**\n` +
      `1. Klik tombol **▶️ Mulai Soal** di bawah (atau ketik \`mulai\` di chat).\n` +
      `2. Jawab langsung dengan mengetik jawabanmu di chat channel ini (batas waktu **60 detik**).\n` +
      `3. Gunakan tombol **💡 Petunjuk** jika kesulitan, atau **🏳️ Menyerah** untuk melihat jawaban.\n` +
      `4. Pemenang langsung mendapatkan **Koin + XP** yang terhubung ke sistem Level & Leaderboard server!`
    )
    .addFields(
      { name: 'Hadiah Benar', value: `**+${gameDef.coins} Koin** & **+${gameDef.xp} XP**`, inline: true },
      { name: 'Batas Waktu', value: '60 Detik / Soal', inline: true },
      { name: 'Mode', value: 'Multiplayer Cepat-Cepatan', inline: true }
    )
    .setFooter({ text: 'Klik tombol Mulai Soal di bawah untuk bermain • Bersih otomatis 00:00 WIB' })
    .setTimestamp();
}

function getQuizPanelRow(gameKey) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_quiz_start_${gameKey}`)
      .setLabel('▶️ Mulai Soal')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`btn_quiz_hint_${gameKey}`)
      .setLabel('💡 Petunjuk')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`btn_quiz_skip_${gameKey}`)
      .setLabel('🏳️ Menyerah')
      .setStyle(ButtonStyle.Danger)
  );
}

/**
 * Mengambil 1 soal acak dari Xemoz API untuk gameKey tertentu
 */
async function fetchQuizQuestion(gameKey) {
  const def = QUIZ_GAMES[gameKey];
  if (!def) throw new Error('Jenis game tidak dikenal.');

  const res = await fetch(def.url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlyBot/2.0' },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Server soal mengembalikan status HTTP ${res.status}`);

  const json = await res.json();
  const raw = json?.data?.data || json?.data || json?.result || json;

  let question = '';
  let answer = '';
  let extraHint = '';
  let imageUrl = null;

  if (gameKey === 'lengkapikalimat') {
    question = `Lengkapi kalimat berikut:\n> **${raw.pertanyaan || raw.soal}**`;
    answer = String(raw.jawaban || '');
  } else if (gameKey === 'karakterff') {
    question = 'Siapakah nama karakter **Free Fire** pada gambar di bawah ini?';
    answer = String(raw.name || raw.jawaban || '');
    imageUrl = raw.gambar || raw.img || raw.image || null;
  } else if (gameKey === 'mtk') {
    question = `Berapakah hasil dari:\n# \`${raw.str}\` = ?`;
    answer = String(raw.result ?? raw.jawaban ?? '');
    extraHint = `Mode: **${raw.mode || 'medium'}**`;
  } else if (gameKey === 'siapakahaku') {
    question = `> *${raw.soal || raw.pertanyaan}*`;
    answer = String(raw.jawaban || '');
  } else if (gameKey === 'susunkata') {
    question = `Susun huruf acak berikut:\n# \`${raw.soal}\`\nKategori: **${raw.tipe || 'Umum'}**`;
    answer = String(raw.jawaban || '');
    extraHint = `Kategori: **${raw.tipe || 'Umum'}**`;
  } else if (gameKey === 'tebakgambar') {
    question = 'Tebak frasa/kalimat dari gambar berikut ini!';
    answer = String(raw.jawaban || '');
    extraHint = raw.deskripsi || '';
    imageUrl = raw.img || raw.gambar || raw.image || null;
  } else if (gameKey === 'tebakgame') {
    question = 'Tebak nama game berdasarkan gambar di bawah ini!';
    answer = String(raw.jawaban || '');
    imageUrl = raw.img || raw.gambar || raw.image || null;
  } else if (gameKey === 'tebaklogo') {
    question = 'Tebak nama logo / brand pada gambar di bawah ini!';
    answer = String(raw.jawaban || '');
    imageUrl = raw.image || raw.img || raw.gambar || null;
  }

  if (!answer.trim()) {
    throw new Error('Data soal dari API tidak lengkap.');
  }

  return { def, question, answer: answer.trim(), extraHint, imageUrl };
}

/**
 * Memulai ronde soal baru di sebuah channel
 */
async function startQuizRound(channel, gameKey, starterUser = null) {
  const def = QUIZ_GAMES[gameKey];
  if (!def) return null;

  const existing = activeQuizzes.get(channel.id);
  if (existing) {
    return { alreadyActive: true, existing };
  }

  const q = await fetchQuizQuestion(gameKey);

  const timeoutId = setTimeout(async () => {
    const cur = activeQuizzes.get(channel.id);
    if (!cur || cur.answer !== q.answer) return;
    activeQuizzes.delete(channel.id);

    const timeoutEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('⏰ Waktu Habis!')
      .setDescription(
        `Tidak ada yang berhasil menjawab soal **${def.title}** dalam 60 detik.\n\n` +
        `• Jawaban yang benar: **\`${q.answer}\`**\n` +
        `• Klik tombol **▶️ Mulai Soal** di bawah untuk lanjut ke soal baru!`
      )
      .setTimestamp();

    await channel.send({ embeds: [timeoutEmbed], components: [getQuizPanelRow(gameKey)] }).catch(() => {});
  }, 60000);

  const state = {
    gameKey,
    answer: q.answer,
    normalizedAnswer: normalizeAnswer(q.answer),
    extraHint: q.extraHint,
    question: q.question,
    imageUrl: q.imageUrl,
    startedAt: Date.now(),
    timeoutId,
  };

  activeQuizzes.set(channel.id, state);

  const embed = new EmbedBuilder()
    .setColor(def.color)
    .setAuthor({
      name: `${def.title} • Soal Baru`,
      iconURL: channel.client.user.displayAvatarURL(),
    })
    .setDescription(
      `${q.question}\n\n` +
      `⏱️ Waktu: **60 detik** • 🏆 Hadiah: **+${def.coins} Koin & +${def.xp} XP**\n` +
      `Ketik jawabanmu langsung di chat channel ini!`
    )
    .setFooter({
      text: starterUser ? `Dimulai oleh ${starterUser.username}` : 'FlyBot Mini Games Arena',
    })
    .setTimestamp();

  if (q.imageUrl) {
    embed.setImage(q.imageUrl);
  }

  await channel.send({ embeds: [embed], components: [getQuizPanelRow(gameKey)] });
  return { alreadyActive: false, state };
}

/**
 * Handler tombol interaktif `btn_quiz_*`
 */
async function handleQuizButton(interaction) {
  const parts = interaction.customId.split('_'); // btn_quiz_<action>_<gameKey>
  const action = parts[2];
  const gameKey = parts.slice(3).join('_');
  const def = QUIZ_GAMES[gameKey];
  if (!def) return false;

  if (action === 'start') {
    const existing = activeQuizzes.get(interaction.channelId);
    if (existing) {
      return interaction.reply({
        content: 'Masih ada soal yang sedang aktif di channel ini! Jawab dulu soal di atas atau klik **🏳️ Menyerah**.',
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      await startQuizRound(interaction.channel, gameKey, interaction.user);
      await interaction.editReply({ content: `✅ Soal baru **${def.title}** telah dikirim!` }).catch(() => {});
    } catch (err) {
      await interaction.editReply({ content: `Gagal mengambil soal baru: ${err.message}` }).catch(() => {});
    }
    return true;
  }

  if (action === 'hint') {
    const cur = activeQuizzes.get(interaction.channelId);
    if (!cur) {
      return interaction.reply({
        content: 'Belum ada soal aktif. Klik tombol **▶️ Mulai Soal** terlebih dahulu!',
        flags: MessageFlags.Ephemeral,
      });
    }
    const masked = buildMaskedHint(cur.answer);
    const extra = cur.extraHint ? `\n• Info Tambahan: ${cur.extraHint}` : '';
    return interaction.reply({
      content: `💡 **Petunjuk Jawaban:** \`${masked}\` (${cur.answer.length} karakter)${extra}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  if (action === 'skip') {
    const cur = activeQuizzes.get(interaction.channelId);
    if (!cur) {
      return interaction.reply({
        content: 'Tidak ada soal yang sedang aktif saat ini.',
        flags: MessageFlags.Ephemeral,
      });
    }
    clearTimeout(cur.timeoutId);
    activeQuizzes.delete(interaction.channelId);

    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🏳️ Soal Dilewati')
      .setDescription(
        `<@${interaction.user.id}> memilih menyerah.\n\n` +
        `• Jawaban yang benar: **\`${cur.answer}\`**\n` +
        `• Klik **▶️ Mulai Soal** untuk mencoba soal berikutnya!`
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], components: [getQuizPanelRow(gameKey)] }).catch(() => {});
    return true;
  }

  return false;
}

/**
 * Deteksi apakah channel ini termasuk salah satu dari 8 channel Quiz Mini Game
 */
function detectQuizGameKeyFromChannel(channel) {
  if (!channel || !channel.name) return null;
  const clean = channel.name.toLowerCase().replace(/[^a-z0-9-]/g, '');
  for (const def of QUIZ_GAME_LIST) {
    if (clean.includes(def.keyword)) return def.key;
  }
  return null;
}

/**
 * Handler jawaban chat di salah satu dari 8 channel Quiz Mini Game
 */
async function handleQuizMessage(message) {
  if (!message.guild || message.author.bot) return false;

  const gameKey = detectQuizGameKeyFromChannel(message.channel);
  if (!gameKey) return false;

  const def = QUIZ_GAMES[gameKey];
  const rawContent = message.content.trim();
  if (!rawContent || rawContent.startsWith('/')) return false;

  const normalized = normalizeAnswer(rawContent);
  const cur = activeQuizzes.get(message.channel.id);

  // Jika belum ada soal aktif dan user ketik mulai/start/play
  if (!cur) {
    if (['mulai', 'start', 'play', 'gas', 'main'].includes(normalized)) {
      try {
        await startQuizRound(message.channel, gameKey, message.author);
      } catch (err) {
        await message.reply(`Gagal memuat soal baru: ${err.message}`).catch(() => {});
      }
      return true;
    }
    return false;
  }

  // Jika user ketik menyerah / skip
  if (['nyerah', 'menyerah', 'skip'].includes(normalized)) {
    clearTimeout(cur.timeoutId);
    activeQuizzes.delete(message.channel.id);
    const embed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('🏳️ Soal Dilewati')
      .setDescription(`Jawaban yang benar adalah: **\`${cur.answer}\`**`)
      .setTimestamp();
    await message.reply({ embeds: [embed], components: [getQuizPanelRow(gameKey)] }).catch(() => {});
    return true;
  }

  // Jika user ketik petunjuk / hint / clue di chat
  if (['hint', 'petunjuk', 'clue', 'bantuan'].includes(normalized)) {
    const masked = buildMaskedHint(cur.answer);
    const extra = cur.extraHint ? `\n• Info Tambahan: ${cur.extraHint}` : '';
    const remainingSec = Math.max(1, Math.ceil((60000 - (Date.now() - cur.startedAt)) / 1000));
    await message.reply(
      `💡 **Petunjuk Jawaban:** \`${masked}\` (${cur.answer.length} karakter)${extra}\n⏱️ Sisa waktu: **${remainingSec} detik**`
    ).catch(() => {});
    return true;
  }

  // Cek jawaban benar!
  if (normalized === cur.normalizedAnswer) {
    clearTimeout(cur.timeoutId);
    activeQuizzes.delete(message.channel.id);
    message.react('✅').catch(() => {});

    const elapsedSec = ((Date.now() - cur.startedAt) / 1000).toFixed(1);
    const reward = addReward(message.guild.id, message.author.id, {
      coins: def.coins,
      xp: def.xp,
      isWin: true,
    });

    dispatchLevelUpAndAchievements(
      message.guild,
      message.member,
      message.author,
      message.channel,
      reward
    ).catch(() => {});

    const levelNotice = reward.leveledUp
      ? `\n\n🎉 **LEVEL UP!** Selamat <@${message.author.id}> naik ke **Level ${reward.newLevel}**!`
      : '';

    const winEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('✅ JAWABAN BENAR!')
      .setDescription(
        `Selamat <@${message.author.id}> berhasil menjawab dengan tepat dalam **${elapsedSec} detik**!\n\n` +
        `• Jawaban: **\`${cur.answer}\`**\n` +
        `• Hadiah: **+${def.coins} Koin** & **+${def.xp} XP**${levelNotice}`
      )
      .setFooter({ text: 'Klik tombol Mulai Soal untuk lanjut ke ronde berikutnya!' })
      .setTimestamp();

    await message.reply({ embeds: [winEmbed], components: [getQuizPanelRow(gameKey)] }).catch(() => {});
    return true;
  }

  // === JAWABAN SALAH: Beri pemberitahuan langsung agar bot responsif ===
  message.react('❌').catch(() => {});
  const remainingSec = Math.max(1, Math.ceil((60000 - (Date.now() - cur.startedAt)) / 1000));
  const safeGuess = rawContent.length > 50 ? `${rawContent.slice(0, 47)}...` : rawContent;

  let feedbackText = `❌ **Salah!** \`${safeGuess}\` belum tepat. Coba lagi atau ketik \`hint\` / klik **💡 Petunjuk**! *(⏱️ Sisa ${remainingSec} detik)*`;

  if (gameKey === 'mtk') {
    const guessNum = Number(rawContent.replace(',', '.'));
    const targetNum = Number(cur.answer);
    if (!Number.isNaN(guessNum) && !Number.isNaN(targetNum)) {
      if (guessNum > targetNum) {
        feedbackText = `📉 **Salah, terlalu besar!** Angka jawaban lebih kecil dari \`${safeGuess}\`. *(⏱️ Sisa ${remainingSec} detik)*`;
      } else {
        feedbackText = `📈 **Salah, terlalu kecil!** Angka jawaban lebih besar dari \`${safeGuess}\`. *(⏱️ Sisa ${remainingSec} detik)*`;
      }
    } else {
      feedbackText = `❌ **Salah!** Ketik hasil angka yang benar ya. *(⏱️ Sisa ${remainingSec} detik)*`;
    }
  } else {
    const dist = levenshteinDistance(normalized, cur.normalizedAnswer);
    const maxCloseDist = cur.normalizedAnswer.length >= 7 ? 2 : 1;
    const isPartialMatch =
      normalized.length >= 3 &&
      (cur.normalizedAnswer.includes(normalized) || normalized.includes(cur.normalizedAnswer));

    if ((cur.normalizedAnswer.length >= 4 && dist <= maxCloseDist) || isPartialMatch) {
      feedbackText = `🤏 **Hampir benar!** Jawaban \`${safeGuess}\` sudah dekat banget — cek ejaan & coba lagi! *(⏱️ Sisa ${remainingSec} detik)*`;
    }
  }

  await message.reply({
    content: feedbackText,
    allowedMentions: { repliedUser: false },
  }).catch(() => {});

  return true;
}

module.exports = {
  QUIZ_GAMES,
  QUIZ_GAME_LIST,
  getQuizPanelEmbed,
  getQuizPanelRow,
  startQuizRound,
  handleQuizButton,
  handleQuizMessage,
  detectQuizGameKeyFromChannel,
};
