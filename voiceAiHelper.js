const {
  joinVoiceChannel,
  VoiceConnectionStatus,
  entersState,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  EndBehaviorType,
} = require('@discordjs/voice');
const prism = require('prism-media');
const { Readable } = require('stream');

// Map sesi aktif per guild: guildId -> SessionData
const activeSessions = new Map();

/**
 * Buat WAV Header 44-byte untuk PCM Buffer
 */
function createWavHeader(dataLength, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
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
 * Hitung RMS volume audio untuk mendeteksi suara manusia vs noise/angin
 */
function calculateRms(pcmBuffer) {
  const numSamples = Math.floor(pcmBuffer.length / 2);
  if (numSamples === 0) return 0;
  let sum = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = pcmBuffer.readInt16LE(i * 2);
    sum += sample * sample;
  }
  return Math.sqrt(sum / numSamples);
}

/**
 * Ekstrak data server lengkap (nama grup, kategori, channel, member) untuk pengetahuan AI
 */
async function buildGuildContext(guild, voiceChannel) {
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    const channels = await guild.channels.fetch().catch(() => guild.channels.cache);

    const categoryMap = new Map();
    const uncategorized = [];

    channels.forEach((ch) => {
      if (ch && ch.type === 4) {
        categoryMap.set(ch.id, { name: ch.name, channels: [] });
      }
    });

    channels.forEach((ch) => {
      if (!ch || ch.type === 4) return;
      const typeStr = ch.isVoiceBased() ? 'Voice' : 'Text';
      const item = `${ch.name} (${typeStr})`;
      if (ch.parentId && categoryMap.has(ch.parentId)) {
        categoryMap.get(ch.parentId).channels.push(item);
      } else {
        uncategorized.push(item);
      }
    });

    let structureLines = [];
    categoryMap.forEach((cat) => {
      if (cat.channels.length > 0) {
        structureLines.push(`• Kategori "${cat.name}": ${cat.channels.join(', ')}`);
      } else {
        structureLines.push(`• Kategori "${cat.name}": (kosong)`);
      }
    });
    if (uncategorized.length > 0) {
      structureLines.push(`• Tanpa Kategori: ${uncategorized.join(', ')}`);
    }

    const voiceMembers =
      voiceChannel.members
        .filter((m) => !m.user.bot)
        .map((m) => m.displayName)
        .join(', ') || 'Hanya kamu';

    const topRoles = guild.roles.cache
      .filter((r) => r.id !== guild.id && !r.managed)
      .sort((a, b) => b.position - a.position)
      .map((r) => r.name)
      .slice(0, 10)
      .join(', ');

    return (
      `INFORMASI LENGKAP SERVER DISCORD (GRUP) TEMPAT KAMU BERADA SAAT INI:\n` +
      `- Nama Server / Grup: "${guild.name}"\n` +
      `- Pemilik Server: "${owner?.displayName || 'Owner'}"\n` +
      `- Total Anggota Server: ${guild.memberCount} member\n` +
      `- Voice Channel Tempat Kamu Berada: "${voiceChannel.name}"\n` +
      `- Teman di Voice Channel Saat Ini: ${voiceMembers}\n` +
      `- Struktur Kategori dan Channel Lengkap di Server Ini:\n${structureLines.join('\n')}\n` +
      `- Role Utama Server: ${topRoles || 'Role Standar'}\n\n` +
      `INSTRUKSI PENTING TENTANG SERVER:\n` +
      `1. Kamu tahu persis seluruh isi server ini! Jika ada yang nanya nama grup/server ini apa, sebutkan nama "${guild.name}".\n` +
      `2. Jika disuruh bacakan/sebutkan kategori atau channel apa saja yang ada di grup ini, sebutkan dengan santai dan tepat sesuai data di atas.\n` +
      `3. Jika ada yang minta setel/putar lagu musik, beri tahu dengan santai bahwa untuk setel musik bisa langsung ketik perintah slash /play di chat!`
    );
  } catch (err) {
    console.warn('[BUILD GUILD CONTEXT ERROR]', err.message);
    return `Server ini bernama "${guild.name}" dengan total ${guild.memberCount} member.`;
  }
}

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

  ws.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);

      // Konfigurasi session setelah terkoneksi
      if (data.type === 'session.created') {
        const fullInstructions =
          'Kamu adalah Bot Fly (biasa dipanggil Fly), teman tongkrongan AI yang sedang berbicara LANGSUNG lewat suara di Voice Channel Discord.\n\n' +
          'ATURAN UTAMA IDENTITAS & PERCAKAPAN REAL-TIME:\n' +
          '1. IDENTITAS: Nama kamu adalah "Bot Fly" (atau Fly). Kalau ada yang bertanya kamu terbuat dari siapa, siapa pembuatmu, atau siapa pencipta/developer kamu, jawab santai kalau kamu dibuat oleh Rafly yang biasa dipanggil Fly.\n' +
          '2. Karaktermu santai, asik, humoris, dan ekspresif layaknya sahabat tongkrongan anak gaul Jakarta / Jaksel.\n' +
          '3. SELALU gunakan kata "gue" untuk diri sendiri dan "lo" untuk lawan bicara. Panggil bro/bray/sob.\n' +
          '4. JAWAB SINGKAT, PADAT, DAN TO-THE-POINT (maksimal 1 sampai 2 kalimat saja!). Hindari ceramah atau daftar yang kepanjangan agar percakapan tetap interaktif.\n' +
          '5. Bicaralah dengan intonasi hidup, bernapas, rileks, dan ekspresif. DILARANG KERAS menggunakan bahasa formal/kaku seperti "saya", "anda", atau "tentu saja".\n' +
          '6. Jangan sebut simbol markdown atau emoji apa pun karena ini adalah obrolan suara langsung.\n\n' +
          session.guildContext;

        ws.send(
          JSON.stringify({
            type: 'session.update',
            session: {
              type: 'realtime',
              instructions: fullInstructions,
              output_modalities: ['audio'],
              audio: {
                input: {
                  format: { type: 'audio/pcm', rate: 24000 },
                  turn_detection: null,
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

          // Mainkan audio dengan WAV container berkualitas tinggi & bebas lag
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
 * Mainkan Buffer audio hasil Realtime (24kHz Mono) dengan WAV Header resmi
 */
function playRealtimeAudio(session, mono24kBuffer) {
  session.isSpeaking = true;

  try {
    const wavHeader = createWavHeader(mono24kBuffer.length, 24000, 1, 16);
    const wavBuffer = Buffer.concat([wavHeader, mono24kBuffer]);

    const resource = createAudioResource(Readable.from(wavBuffer));
    session.player.play(resource);
  } catch (err) {
    console.error('[PLAY REALTIME AUDIO ERROR]', err);
    session.isSpeaking = false;
    session.isProcessing = false;
  }
}

/**
 * Mulai sesi Voice AI di voice channel
 */
async function startVoiceAiSession(voiceChannel, textChannel, voiceType = 'alloy', options = {}) {
  const guildId = voiceChannel.guild.id;

  if (activeSessions.has(guildId)) {
    await stopVoiceAiSession(guildId);
  }

  const guildContext = await buildGuildContext(voiceChannel.guild, voiceChannel);

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
    client: voiceChannel.client,
    voiceType,
    callerUserId: options.callerUserId || null,
    connection,
    player,
    ws: null,
    guildContext,
    isSpeaking: false,
    isProcessing: false,
    activeListeners: new Set(),
    stats: { questionsAnswered: 0, startTime: Date.now() },
  };

  // Reset status saat audio selesai diputar
  player.on(AudioPlayerStatus.Idle, () => {
    setTimeout(() => {
      session.isSpeaking = false;
      session.isProcessing = false;
    }, 200);
  });

  player.on('error', (err) => {
    console.warn('[AUDIO PLAYER ERROR]', err.message);
    session.isSpeaking = false;
    session.isProcessing = false;
  });

  activeSessions.set(guildId, session);

  // Buka koneksi streaming OpenAI Realtime
  session.ws = connectRealtimeWebSocket(session);

  // Sapaan suara pertama saat join
  setTimeout(() => {
    if (options.initialGreeting !== false) {
      const greetingText =
        typeof options.initialGreeting === 'string'
          ? options.initialGreeting
          : 'Ucapkan salam sapaan santai khas tongkrongan dan sebut bahwa lo Bot Fly udah standby di voice channel.';
      sendRealtimeTextMessage(session, greetingText);
    }
  }, 1000);

  // Tangkap saat ada user mulai berbicara di voice
  connection.receiver.speaking.on('start', (userId) => {
    // 1. Abaikan suara bot
    if (userId === voiceChannel.client.user.id) return;

    // 2. Abaikan jika bot sedang berbicara atau sedang memproses
    if (session.isSpeaking || session.isProcessing) return;

    // 3. FOKUS HANYA PADA YANG MEMANGGIL AI (Orang lain di-mute pada sisi bot)
    if (session.callerUserId && userId !== session.callerUserId) {
      return;
    }

    // 4. Cegah double listener pada user yang sama
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

      // Filter durasi minimal: abaikan suara < 0.4 detik (batuk/klik mic)
      if (pcmBuffer.length < 80000) {
        return;
      }

      // Filter volume minimal (RMS): abaikan desisan/angin tanpa suara vokal manusia
      const rms = calculateRms(pcmBuffer);
      if (rms < 300) {
        return;
      }

      if (session.isProcessing || session.isSpeaking) return;
      session.isProcessing = true;

      // Konversi Discord 48kHz stereo langsung ke 24kHz mono
      const mono24k = convert48kStereoTo24kMono(pcmBuffer);

      if (session.ws && session.ws.readyState === 1) {
        console.log(`[REALTIME STREAM] Mengirim audio mic caller ${userId} (${mono24k.length} byte, RMS: ${Math.round(rms)}) ke OpenAI...`);

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
  sendRealtimeTextMessage,
};
