const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
} = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const prism = require('prism-media');
const { Readable } = require('stream');
const OpenAI = require('openai');
const { toFile } = require('openai');

let openaiClient = null;
function getOpenAI() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// Map session aktif: guildId -> SessionData
const activeSessions = new Map();

// Memory percakapan voice per guild
const voiceHistories = new Map();
const MAX_VOICE_HISTORY = 8; // 4 pasang tanya-jawab

// Frasa suara jeda berpikir alami khas tongkrongan
const FILLER_PHRASES = [
  'Hmm...',
  'Bentar bray...',
  'Emmm...',
  'Hmm bentar ya...',
  'Bentar gue mikir...',
  'Oke bentar...',
];

// Cache audio filler (voiceType -> Array of Buffers)
const fillerAudioCache = new Map();

/**
 * Pre-generate audio suara mikir ke memory agar 0ms latency
 */
async function initFillersForVoice(voiceType = 'nova') {
  if (fillerAudioCache.has(voiceType) && fillerAudioCache.get(voiceType).length > 0) {
    return fillerAudioCache.get(voiceType);
  }

  const openai = getOpenAI();
  if (!openai) return [];

  const buffers = [];
  for (const phrase of FILLER_PHRASES) {
    try {
      const res = await openai.audio.speech.create({
        model: 'tts-1',
        voice: voiceType,
        input: phrase,
        speed: 1.05,
      });
      buffers.push(Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      console.warn('[FILLER GEN ERROR]', e.message);
    }
  }

  if (buffers.length > 0) {
    fillerAudioCache.set(voiceType, buffers);
    console.log(`[VOICE AI FILLER] ${buffers.length} suara mikir berhasil di-cache untuk voice: ${voiceType}`);
  }
  return buffers;
}

/**
 * Mainkan suara mikir ("Hmm...", "Bentar bray...") secara instan
 */
function playFillerSound(session) {
  const list = fillerAudioCache.get(session.voiceType) || [];
  if (list.length === 0) return Promise.resolve();

  const chosenBuffer = list[Math.floor(Math.random() * list.length)];
  session.isSpeaking = true;

  try {
    const resource = createAudioResource(Readable.from(chosenBuffer));
    session.player.play(resource);

    return new Promise((resolve) => {
      const onIdle = () => {
        session.player.off(AudioPlayerStatus.Idle, onIdle);
        resolve();
      };
      session.player.on(AudioPlayerStatus.Idle, onIdle);

      // Batas waktu pengaman 2.5 detik
      setTimeout(() => {
        session.player.off(AudioPlayerStatus.Idle, onIdle);
        resolve();
      }, 2500);
    });
  } catch (err) {
    console.error('[PLAY FILLER ERROR]', err.message);
    return Promise.resolve();
  }
}

/**
 * Buat WAV Header 44-byte untuk PCM Buffer
 */
function createWavHeader(dataLength, sampleRate = 48000, numChannels = 2, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

const VOICE_SYSTEM_PROMPT = {
  role: 'system',
  content:
    'Kamu adalah Fly, teman ngobrol AI yang sedang berbicara LANGSUNG lewat suara di Voice Channel Discord.\n\n' +
    'ATURAN PERCAKAPAN SUARA (MUTLAK):\n' +
    '1. Gunakan bahasa santai anak gaul tongkrongan / Jaksel. SELALU gunakan kata "gue" untuk diri sendiri dan "lo" untuk lawan bicara. Panggil bro/bray/sob.\n' +
    '2. JAWABAN HARUS SANGAT SINGKAT DAN PADAT (maksimal 1 sampai 2 kalimat saja!). Ini obrolan suara langsung, jadi jangan pernah berpidato atau memberi daftar panjang.\n' +
    '3. DILARANG KERAS menggunakan simbol markdown (**tebal**, *miring*, ```code```, bullet point) ataupun emoji sama sekali, karena teks ini langsung dibaca oleh suara Text-to-Speech.\n' +
    '4. Responsif, seru, asik, dan to-the-point.',
};

/**
 * Tanya AI khusus untuk respons suara pendek
 */
async function askVoiceAI(guildId, userId, prompt, userName) {
  const openai = getOpenAI();
  if (!openai) return 'Waduh bro, API key OpenAI belum disetel.';

  if (!voiceHistories.has(guildId)) {
    voiceHistories.set(guildId, []);
  }

  const history = voiceHistories.get(guildId);
  history.push({
    role: 'user',
    content: `${userName}: ${prompt}`,
  });

  if (history.length > MAX_VOICE_HISTORY) {
    history.splice(0, history.length - MAX_VOICE_HISTORY);
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [VOICE_SYSTEM_PROMPT, ...history],
      max_tokens: 150,
      temperature: 0.8,
    });

    const reply = response.choices?.[0]?.message?.content?.trim() || 'Gue denger lo bro, ada apa?';
    history.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.error('[VOICE AI COMPLETION ERROR]', err);
    return 'Sorry bro, koneksi otak gue agak ngelag sebentar.';
  }
}

/**
 * Mulai sesi Voice AI di voice channel
 */
async function startVoiceAiSession(voiceChannel, textChannel, voiceType = 'nova') {
  const guildId = voiceChannel.guild.id;

  // Jika sudah ada sesi aktif di guild ini, hentikan dulu
  if (activeSessions.has(guildId)) {
    await stopVoiceAiSession(guildId);
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false, // Wajib false agar bot bisa mendengarkan mic user
    selfMute: false,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 20000);

  const player = createAudioPlayer();
  connection.subscribe(player);

  const session = {
    guildId,
    channelId: voiceChannel.id,
    textChannel,
    voiceType,
    connection,
    player,
    isSpeaking: false,
    isProcessing: false,
    activeListeners: new Set(),
    stats: { questionsAnswered: 0, startTime: Date.now() },
  };

  activeSessions.set(guildId, session);

  // Pre-cache audio filler (suara "hmmm...") di background
  initFillersForVoice(voiceType).catch(console.error);

  // Sambutan suara pertama saat join
  playGreeting(session);

  // Tangkap saat ada user mulai berbicara di voice
  connection.receiver.speaking.on('start', (userId) => {
    // Abaikan suara bot sendiri
    if (userId === voiceChannel.client.user.id) return;
    // Jangan dengarkan jika bot sedang berbicara atau sedang memproses jawaban
    if (session.isSpeaking || session.isProcessing) return;
    // Hindari duplikasi listener pada user yang sama
    if (session.activeListeners.has(userId)) return;

    handleUserSpeaking(session, userId);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    activeSessions.delete(guildId);
    voiceHistories.delete(guildId);
  });

  return session;
}

/**
 * Putar suara sapaan pertama kali bot join
 */
async function playGreeting(session) {
  const greetingText = 'Halo bro, gue Fly udah masuk voice nih. Langsung ngomong aja di mic lo, gue dengerin!';
  await playSpeech(session, greetingText);
}

/**
 * Handle audio rekaman dari user yang berbicara
 */
function handleUserSpeaking(session, userId) {
  session.activeListeners.add(userId);

  try {
    // Berhenti merekam setelah ada jeda diam 750ms
    const opusStream = session.connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 750,
      },
    });

    const decoder = new prism.opus.Decoder({
      rate: 48000,
      channels: 2,
      frameSize: 960,
    });

    const pcmChunks = [];
    const pcmStream = opusStream.pipe(decoder);

    pcmStream.on('data', (chunk) => {
      pcmChunks.push(chunk);
    });

    pcmStream.on('end', async () => {
      session.activeListeners.delete(userId);

      // Cek apakah sesi masih aktif
      if (!activeSessions.has(session.guildId)) return;

      const pcmBuffer = Buffer.concat(pcmChunks);

      // Filter durasi minimal: jika kurang dari ~0.6 detik (115.000 byte), abaikan
      if (pcmBuffer.length < 115000) {
        return;
      }

      // Hindari proses bertumpuk
      if (session.isProcessing || session.isSpeaking) return;
      session.isProcessing = true;

      // Segera bunyikan suara mikir ("Hmm...", "Bentar bray...") secara instan tanpa jeda
      const fillerPromise = playFillerSound(session);

      try {
        await processVoiceSpeech(session, userId, pcmBuffer, fillerPromise);
      } catch (err) {
        console.error('[PROCESS VOICE ERROR]', err);
      } finally {
        session.isProcessing = false;
        session.isSpeaking = false;
      }
    });

    pcmStream.on('error', (err) => {
      session.activeListeners.delete(userId);
      console.warn('[OPUS DECODE ERROR]', err.message);
    });
  } catch (err) {
    session.activeListeners.delete(userId);
    console.error('[SUBSCRIBE VOICE ERROR]', err);
  }
}

/**
 * Transkrip mic user via Whisper -> Tanya GPT -> Jawab via Suara
 */
async function processVoiceSpeech(session, userId, pcmBuffer, fillerPromise) {
  const openai = getOpenAI();
  if (!openai) {
    if (fillerPromise) await fillerPromise;
    return;
  }

  // Bungkus PCM Buffer jadi file WAV lengkap
  const wavHeader = createWavHeader(pcmBuffer.length, 48000, 2, 16);
  const wavBuffer = Buffer.concat([wavHeader, pcmBuffer]);

  const audioFile = await toFile(wavBuffer, 'speech.wav');

  let transcriptionText = '';
  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'id',
    });
    transcriptionText = transcription.text?.trim() || '';
  } catch (err) {
    console.warn('[WHISPER ERROR]', err.message);
    if (fillerPromise) await fillerPromise;
    return;
  }

  // Filter teks kosong atau noise halusinasi Whisper
  if (!transcriptionText || transcriptionText.length < 2) {
    if (fillerPromise) await fillerPromise;
    return;
  }
  const lower = transcriptionText.toLowerCase();
  const ignoredHallucinations = [
    'terima kasih',
    'terima kasih.',
    'subtitle oleh',
    'subs by',
    'amara.org',
    'you',
    '...',
    'terima kasih sudah menonton',
  ];
  if (ignoredHallucinations.includes(lower)) {
    if (fillerPromise) await fillerPromise;
    return;
  }

  const member = await session.textChannel.guild.members.fetch(userId).catch(() => null);
  const userName = member?.displayName || 'Teman';

  console.log(`[VOICE AI RECOGNIZED] ${userName}: "${transcriptionText}"`);

  try {
    // Ambil jawaban dari Fly AI
    const aiReply = await askVoiceAI(session.guildId, userId, transcriptionText, userName);
    console.log(`[VOICE AI REPLY] Fly AI -> ${userName}: "${aiReply}"`);

    session.stats.questionsAnswered++;

    // Generate audio jawaban
    const mp3Res = await openai.audio.speech.create({
      model: 'tts-1',
      voice: session.voiceType || 'nova',
      input: aiReply,
    });
    const mp3Buffer = Buffer.from(await mp3Res.arrayBuffer());

    // Pastikan suara mikir ("Hmm...") selesai diputar sebelum memainkan jawaban utama
    if (fillerPromise) {
      await fillerPromise;
    }

    // Mainkan audio jawaban langsung ke Voice Channel
    await playAudioBuffer(session, mp3Buffer);
  } catch (err) {
    console.error('[VOICE AI FLOW ERROR]', err);
    if (fillerPromise) await fillerPromise;
  }
}

/**
 * Mainkan audio buffer ke Voice Channel
 */
function playAudioBuffer(session, buffer) {
  session.isSpeaking = true;

  try {
    const resource = createAudioResource(Readable.from(buffer));
    session.player.play(resource);

    return new Promise((resolve) => {
      const onIdle = () => {
        session.player.off(AudioPlayerStatus.Idle, onIdle);
        setTimeout(() => {
          session.isSpeaking = false;
          resolve();
        }, 350);
      };
      session.player.on(AudioPlayerStatus.Idle, onIdle);

      // Batas waktu pengaman 25 detik
      setTimeout(() => {
        session.player.off(AudioPlayerStatus.Idle, onIdle);
        session.isSpeaking = false;
        resolve();
      }, 25000);
    });
  } catch (err) {
    console.error('[PLAY AUDIO BUFFER ERROR]', err.message);
    session.isSpeaking = false;
    return Promise.resolve();
  }
}

/**
 * Mainkan audio suara (TTS) teks ke Voice Channel
 */
async function playSpeech(session, text) {
  const openai = getOpenAI();
  if (!openai) return;

  try {
    const mp3Res = await openai.audio.speech.create({
      model: 'tts-1',
      voice: session.voiceType || 'nova',
      input: text,
    });

    const mp3Buffer = Buffer.from(await mp3Res.arrayBuffer());
    await playAudioBuffer(session, mp3Buffer);
  } catch (err) {
    console.error('[PLAY SPEECH ERROR]', err.message);
  }
}

/**
 * Hentikan sesi Voice AI
 */
async function stopVoiceAiSession(guildId) {
  const session = activeSessions.get(guildId);
  if (!session) return false;

  try {
    // Sapaan perpisahan pendek
    await playSpeech(session, 'Oke bray, gue cabut dulu ya. Panggil lagi kalau butuh!');
  } catch {}

  try {
    session.player.stop();
    session.connection.destroy();
  } catch {}

  activeSessions.delete(guildId);
  voiceHistories.delete(guildId);
  return true;
}

/**
 * Cek status sesi
 */
function getVoiceAiSession(guildId) {
  return activeSessions.get(guildId) || null;
}

module.exports = {
  startVoiceAiSession,
  stopVoiceAiSession,
  getVoiceAiSession,
};
