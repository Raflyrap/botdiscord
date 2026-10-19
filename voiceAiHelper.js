const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
  StreamType,
} = require('@discordjs/voice');
const prism = require('prism-media');
const { Readable } = require('stream');

// Map sesi aktif per guild: guildId -> SessionData
const activeSessions = new Map();

/**
 * Konversi 48kHz Stereo 16-bit PCM (Discord) ke 24kHz Mono 16-bit PCM (OpenAI Realtime)
 */
function convert48kStereoTo24kMono(stereo48kBuf) {
  const numFrames = Math.floor(stereo48kBuf.length / 4);
  const targetFrames = Math.floor(numFrames / 2);
  const mono24kBuf = Buffer.alloc(targetFrames * 2);

  let outOffset = 0;
  for (let i = 0; i < numFrames; i += 2) {
    const inOffset = i * 4;
    mono24kBuf[outOffset] = stereo48kBuf[inOffset];
    mono24kBuf[outOffset + 1] = stereo48kBuf[inOffset + 1];
    outOffset += 2;
  }
  return mono24kBuf;
}

/**
 * Konversi 24kHz Mono 16-bit PCM (OpenAI Realtime) ke 48kHz Stereo 16-bit PCM (Discord)
 */
function convert24kMonoTo48kStereo(mono24kBuf) {
  const numSamples = Math.floor(mono24kBuf.length / 2);
  const stereo48kBuf = Buffer.alloc(numSamples * 8);

  for (let i = 0; i < numSamples; i++) {
    const b0 = mono24kBuf[i * 2];
    const b1 = mono24kBuf[i * 2 + 1];
    const outOffset = i * 8;

    // Frame 1: Left & Right
    stereo48kBuf[outOffset] = b0;
    stereo48kBuf[outOffset + 1] = b1;
    stereo48kBuf[outOffset + 2] = b0;
    stereo48kBuf[outOffset + 3] = b1;

    // Frame 2: Left & Right
    stereo48kBuf[outOffset + 4] = b0;
    stereo48kBuf[outOffset + 5] = b1;
    stereo48kBuf[outOffset + 6] = b0;
    stereo48kBuf[outOffset + 7] = b1;
  }
  return stereo48kBuf;
}

const REALTIME_SYSTEM_PROMPT =
  'Kamu adalah Fly, teman nongkrong AI yang sedang berbicara LANGSUNG lewat suara di Voice Channel Discord.\n\n' +
  'ATURAN UTAMA PERCAKAPAN REAL-TIME:\n' +
  '1. Karaktermu santai, asik, humoris, dan ekspresif layaknya sahabat tongkrongan anak gaul Jakarta / Jaksel.\n' +
  '2. SELALU gunakan kata "gue" untuk diri sendiri dan "lo" untuk lawan bicara. Panggil bro/bray/sob.\n' +
  '3. JAWAB SINGKAT DAN TO-THE-POINT (maksimal 1 sampai 2 kalimat saja!). Hindari ceramah atau daftar panjang agar percakapan terus mengalir dua arah.\n' +
  '4. Bicaralah dengan intonasi hidup, bernapas, rileks, dan ekspresif. DILARANG KERAS menggunakan bahasa formal/kaku seperti "saya", "anda", atau "tentu saja".\n' +
  '5. Jangan sebut simbol markdown atau emoji apa pun karena ini adalah obrolan suara langsung.';

/**
 * Hubungkan ke WebSocket OpenAI Realtime API (GA Model gpt-realtime-mini)
 */
function connectRealtimeWebSocket(session) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[REALTIME] OPENAI_API_KEY belum disetel di .env');
    return null;
  }

  const url = 'wss://api.openai.com/v1/realtime?model=gpt-realtime-mini';
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  let currentAudioDeltas = [];
  let currentTranscript = '';

  ws.addEventListener('open', () => {
    console.log(`[REALTIME WS] Terhubung ke OpenAI Realtime API untuk Guild ${session.guildId}`);
  });

  ws.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);

      // Konfigurasi session setelah terkoneksi
      if (data.type === 'session.created') {
        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              instructions: REALTIME_SYSTEM_PROMPT,
              output_modalities: ['audio'],
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  turn_detection: null, // Dikontrol otomatis via Discord silence
                },
                output: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  voice: session.voiceType || 'alloy',
                },
              },
            },
          })
        );
      }

      // Kumpulkan audio output real-time
      if (data.type === 'response.output_audio.delta') {
        if (data.delta) {
          currentAudioDeltas.push(Buffer.from(data.delta, 'base64'));
        }
      }

      // Kumpulkan teks transkrip respon untuk log
      if (data.type === 'response.output_audio_transcript.delta') {
        currentTranscript += data.delta || '';
      }

      // Saat respon audio selesai di-generate dari OpenAI
      if (data.type === 'response.done') {
        if (currentAudioDeltas.length > 0) {
          const mono24kFull = Buffer.concat(currentAudioDeltas);
          currentAudioDeltas = [];

          if (currentTranscript.trim()) {
            console.log(`[REALTIME REPLY] Fly AI: "${currentTranscript.trim()}"`);
            currentTranscript = '';
          }

          // Mainkan audio langsung ke Discord Voice
          playRealtimeAudio(session, mono24kFull);
        } else {
          session.isProcessing = false;
          session.isSpeaking = false;
        }
      }

      if (data.type === 'error') {
        console.error('[REALTIME ERROR]', data.error);
        session.isProcessing = false;
        session.isSpeaking = false;
      }
    } catch (err) {
      console.error('[REALTIME PARSE ERROR]', err);
    }
  });

  ws.addEventListener('close', () => {
    console.log(`[REALTIME WS] Terputus untuk Guild ${session.guildId}`);
    // Auto-reconnect jika sesi bot masih aktif
    if (activeSessions.has(session.guildId)) {
      setTimeout(() => {
        if (activeSessions.has(session.guildId)) {
          session.ws = connectRealtimeWebSocket(session);
        }
      }, 2000);
    }
  });

  ws.addEventListener('error', (err) => {
    console.error('[REALTIME WS ERROR]', err.message || err);
  });

  return ws;
}

/**
 * Mainkan Buffer audio hasil Realtime (24kHz Mono) langsung ke Discord Voice (48kHz Stereo)
 */
function playRealtimeAudio(session, mono24kBuffer) {
  session.isSpeaking = true;

  try {
    const stereo48kBuffer = convert24kMonoTo48kStereo(mono24kBuffer);
    const resource = createAudioResource(Readable.from(stereo48kBuffer), {
      inputType: StreamType.Raw,
    });

    session.player.play(resource);

    const onIdle = () => {
      session.player.off(AudioPlayerStatus.Idle, onIdle);
      setTimeout(() => {
        session.isSpeaking = false;
        session.isProcessing = false;
      }, 200);
    };

    session.player.on(AudioPlayerStatus.Idle, onIdle);

    // Timeout pengaman
    setTimeout(() => {
      session.player.off(AudioPlayerStatus.Idle, onIdle);
      session.isSpeaking = false;
      session.isProcessing = false;
    }, 20000);
  } catch (err) {
    console.error('[PLAY REALTIME AUDIO ERROR]', err);
    session.isSpeaking = false;
    session.isProcessing = false;
  }
}

/**
 * Mulai sesi Voice AI di voice channel
 */
async function startVoiceAiSession(voiceChannel, textChannel, voiceType = 'alloy') {
  const guildId = voiceChannel.guild.id;

  if (activeSessions.has(guildId)) {
    await stopVoiceAiSession(guildId);
  }

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
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
    ws: null,
    isSpeaking: false,
    isProcessing: false,
    activeListeners: new Set(),
    stats: { questionsAnswered: 0, startTime: Date.now() },
  };

  activeSessions.set(guildId, session);

  // Buka koneksi streaming OpenAI Realtime
  session.ws = connectRealtimeWebSocket(session);

  // Kirim sapaan suara pertama saat join
  setTimeout(() => {
    sendRealtimeTextMessage(session, 'Ucapkan salam sapaan santai bahwa lo udah masuk voice channel.');
  }, 1000);

  // Tangkap saat ada user mulai berbicara di voice
  connection.receiver.speaking.on('start', (userId) => {
    if (userId === voiceChannel.client.user.id) return;
    if (session.isSpeaking || session.isProcessing) return;
    if (session.activeListeners.has(userId)) return;

    handleUserSpeaking(session, userId);
  });

  connection.on(VoiceConnectionStatus.Disconnected, () => {
    stopVoiceAiSession(guildId);
  });

  return session;
}

/**
 * Kirim instruksi teks langsung ke Realtime API untuk direspons via suara
 */
function sendRealtimeTextMessage(session, text) {
  if (!session.ws || session.ws.readyState !== 1) return;

  session.isProcessing = true;
  session.ws.send(
    JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    })
  );
  session.ws.send(JSON.stringify({ type: 'response.create' }));
}

/**
 * Handle audio rekaman dari user yang berbicara
 */
function handleUserSpeaking(session, userId) {
  session.activeListeners.add(userId);

  try {
    // 500ms jeda diam untuk menandai selesai bicara (super responsif)
    const opusStream = session.connection.receiver.subscribe(userId, {
      end: {
        behavior: EndBehaviorType.AfterSilence,
        duration: 500,
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

      if (!activeSessions.has(session.guildId)) return;

      const pcmBuffer = Buffer.concat(pcmChunks);

      // Filter durasi minimal: abaikan suara < 0.4 detik (batuk/klik)
      if (pcmBuffer.length < 80000) {
        return;
      }

      if (session.isProcessing || session.isSpeaking) return;
      session.isProcessing = true;

      // Konversi Discord 48kHz stereo langsung ke 24kHz mono
      const mono24k = convert48kStereoTo24kMono(pcmBuffer);

      if (session.ws && session.ws.readyState === 1) {
        console.log(`[REALTIME STREAM] Mengirim audio mic (${mono24k.length} byte) ke OpenAI...`);

        session.ws.send(
          JSON.stringify({
            type: 'input_audio_buffer.append',
            audio: mono24k.toString('base64'),
          })
        );

        session.ws.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
        session.ws.send(JSON.stringify({ type: 'response.create' }));
        session.stats.questionsAnswered++;
      } else {
        session.isProcessing = false;
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
 * Hentikan sesi Voice AI
 */
async function stopVoiceAiSession(guildId) {
  const session = activeSessions.get(guildId);
  if (!session) return false;

  try {
    if (session.ws) {
      session.ws.close();
    }
  } catch {}

  try {
    session.player.stop();
    session.connection.destroy();
  } catch {}

  activeSessions.delete(guildId);
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
