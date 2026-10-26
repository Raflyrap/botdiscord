const OpenAI = require('openai');
const { FLYBOT_KNOWLEDGE } = require('./botFeaturesKnowledge');

// Inisialisasi client OpenAI
let openaiClient = null;

function getOpenAIClient() {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

// Memory percakapan per user (UserId -> { lastActive: timestamp, messages: [] })
const userHistories = new Map();
const MAX_HISTORY_TURNS = 10; // 5 pasang pesan user & assistant
const CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 menit kedaluwarsa

const SYSTEM_PROMPT = {
  role: 'system',
  content:
    'Nama kamu adalah Bot Fly (atau dipanggil Fly).\n\n' +
    'ATURAN KEPRIBADIAN & GAYA BAHASA (MUTLAK):\n' +
    '1. IDENTITAS:\n' +
    '   - Nama kamu adalah "Bot Fly" (atau "Fly").\n' +
    '   - Jika ada yang bertanya kamu terbuat dari siapa, siapa pembuatmu, penciptamu, atau developer kamu, jawab santai bahwa kamu dibuat oleh Rafly (biasa dipanggil Fly).\n' +
    '   - Jika ada yang nanya nama kamu atau siapa kamu, jawab santai to-the-point: "Gua Bot Fly, temen AI lo di sini bray."\n\n' +
    '2. GAYA BAHASA GAUL / JAKSEL (JANGAN BAKU):\n' +
    '   - DILARANG KERAS menggunakan kata "aku", "saya", "kamu", atau "anda"!\n' +
    '   - SELALU gunakan "gue" untuk menyebut diri sendiri dan "lo" untuk menyebut lawan bicara.\n' +
    '   - Gunakan bahasa gaul santai anak Jaksel / tongkrongan, pakai panggilan akrab seperti: bro, bray, ler, dll.\n' +
    '   - Nada bicara asik, santai, seru, dan enak diajak curhat seperti sahabat tongkrongan sendiri.\n\n' +
    '3. ATURAN FORMAT & EMOJI:\n' +
    '   - DILARANG KERAS MENGGUNAKAN EMOJI APA PUN dalam jawabanmu (jan pake emoji sama sekali)!\n' +
    '   - Gunakan Discord Markdown (**tebal**, bullet point, ```code```) agar tetap rapi dan nyaman dibaca.\n\n' +
    '4. KUALITAS JAWABAN:\n' +
    '   - Walaupun gaya bicaranya santai dan gaul, kamu tetap cerdas dan solutif untuk bantu coding, pelajaran, tugas, pengetahuan umum, maupun dengerin curhatan.\n\n' +
    FLYBOT_KNOWLEDGE,
};

/**
 * Mengirim pertanyaan ke OpenAI ChatGPT
 * @param {string} userId - ID pengguna Discord
 * @param {string} prompt - Pertanyaan/prompt dari pengguna
 * @returns {Promise<{success: boolean, reply?: string, error?: string, model?: string}>}
 */
async function askAI(userId, prompt) {
  const client = getOpenAIClient();
  if (!client) {
    return {
      success: false,
      error: 'OPENAI_API_KEY belum disetel di file .env!',
    };
  }

  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return {
      success: false,
      error: 'Pertanyaan tidak boleh kosong.',
    };
  }

  // Cek riwayat percakapan user
  const now = Date.now();
  let session = userHistories.get(userId);

  if (!session || (now - session.lastActive) > CONVERSATION_TIMEOUT_MS) {
    session = {
      lastActive: now,
      messages: [],
    };
  }

  // Tambahkan prompt pengguna
  session.messages.push({
    role: 'user',
    content: trimmedPrompt,
  });

  // Batasi riwayat percakapan
  if (session.messages.length > MAX_HISTORY_TURNS) {
    session.messages = session.messages.slice(-MAX_HISTORY_TURNS);
  }

  session.lastActive = now;
  userHistories.set(userId, session);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [SYSTEM_PROMPT, ...session.messages],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content?.trim() || 'Tidak ada balasan dari model.';

    // Simpan respon bot ke riwayat
    session.messages.push({
      role: 'assistant',
      content: reply,
    });
    session.lastActive = Date.now();
    userHistories.set(userId, session);

    return {
      success: true,
      reply,
      model: response.model || 'gpt-4o-mini',
    };
  } catch (error) {
    console.error('[OPENAI ERROR]:', error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan saat menghubungi server OpenAI.',
    };
  }
}

/**
 * Mengirim pesan ke AI khusus channel Entertainment (ai-fanart, ai-generating, ai-prompt)
 * @param {object} params
 * @param {string} params.channelType - 'ai-fanart' | 'ai-generating' | 'ai-prompt'
 * @param {string} params.userId - Discord User ID
 * @param {string} params.prompt - Teks prompt atau pesan pengguna
 * @param {string} [params.imageUrl] - URL gambar (khusus review fanart / vision)
 * @param {string} [params.authorName] - Nama pengguna
 * @returns {Promise<{success: boolean, reply?: string, error?: string, model?: string}>}
 */
async function askEntertainmentAI(firstArg, ...rest) {
  let channelType = 'ai-generating';
  let userId = 'anonymous';
  let prompt = '';
  let imageUrl = null;
  let authorName = 'Temen';

  if (typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg)) {
    channelType = firstArg.channelType || 'ai-generating';
    userId = firstArg.userId || 'anonymous';
    prompt = firstArg.prompt || '';
    imageUrl = firstArg.imageUrl || null;
    authorName = firstArg.authorName || 'Temen';
  } else {
    // Dipanggil sebagai argumen posisi
    const [arg2, arg3, arg4, arg5] = rest;
    if (typeof firstArg === 'string' && (firstArg.includes('ai-') || firstArg === 'fanart' || firstArg === 'prompt' || firstArg === 'promt' || firstArg === 'generating')) {
      channelType = firstArg;
      userId = arg2 || 'anonymous';
      prompt = arg3 || '';
      imageUrl = arg4 || null;
      authorName = arg5 || 'Temen';
    } else {
      userId = firstArg || 'anonymous';
      prompt = arg2 || '';
      channelType = arg3 || 'ai-generating';
      imageUrl = arg4 || null;
      authorName = arg5 || 'Temen';
    }
  }

  // Normalisasi nama channelType
  const cLower = String(channelType).toLowerCase();
  if (cLower.includes('fanart')) {
    channelType = 'ai-fanart';
  } else if (cLower.includes('promt') || cLower.includes('prompt')) {
    channelType = 'ai-prompt';
  } else {
    channelType = 'ai-generating';
  }

  const client = getOpenAIClient();
  if (!client) {
    return {
      success: false,
      error: 'OPENAI_API_KEY belum disetel di file .env!',
    };
  }

  let finalPrompt = (prompt || '').trim();
  if (!finalPrompt && imageUrl) {
    finalPrompt = 'Tolong review dan ulas karya fanart / ilustrasi visual ini dari segi komposisi, warna, gaya estetika, dan berikan saran atau ide kreatif pengembangannya bray!';
  }

  if (!finalPrompt && !imageUrl) {
    return {
      success: false,
      error: 'Pesan atau gambar tidak boleh kosong.',
    };
  }

  let systemPromptContent = '';
  if (channelType === 'ai-fanart') {
    systemPromptContent =
      'Nama kamu adalah Bot Fly (atau Fly), AI Art & Fanart Reviewer spesialis seni visual, karya anime, ilustrasi game, dan desain karakter di server ini.\n\n' +
      'ATURAN KEPRIBADIAN & GAYA BAHASA (MUTLAK):\n' +
      '1. IDENTITAS & NADA BICARA:\n' +
      '   - Kamu adalah kurator seni digital dan fanart enthusiast berwawasan luas.\n' +
      '   - Gaya bicara: Gaul, santai, asik ala anak tongkrongan / Jaksel (gunakan "gue" untuk diri sendiri dan "lo" untuk lawan bicara, panggil "bray/bro/ler").\n' +
      '   - DILARANG KERAS menggunakan kata "aku", "saya", "kamu", atau "anda"!\n' +
      '   - DILARANG KERAS menggunakan emoji apa pun dalam jawabanmu (jan pake emoji sama sekali)!\n' +
      '2. PERAN DALAM CHANNEL AI-FANART:\n' +
      '   - Jika user melampirkan gambar/karya fanart: Ulas secara apresiatif dan berbobot: analisis pencahayaan (lighting), palet warna (color harmony), ekspresi, detail pose, dan atmosfer karyanya. Berikan pujian tulus atas bagian yang keren dan saran kreatif yang membangun.\n' +
      '   - Jika user menanyakan ide/konsep/prompt fanart: Rancang ide konsep visual yang epik dengan detail tema, style referensi (misal: Makoto Shinkai style, cyberpunk, semi-realism, Ufotable, dll), dan komposisi yang hidup.\n' +
      '3. FORMAT:\n' +
      '   - Gunakan format Discord Markdown (**tebal**, bullet point, blockquote >) agar rapi dan estetik.';
  } else if (channelType === 'ai-generating') {
    systemPromptContent =
      'Nama kamu adalah Bot Fly (atau Fly), AI Generator serba bisa di server ini.\n\n' +
      'ATURAN KEPRIBADIAN & GAYA BAHASA (MUTLAK):\n' +
      '1. IDENTITAS & NADA BICARA:\n' +
      '   - Kamu adalah mesin generative AI cerdas yang siap membuatkan apa pun yang diminta: cerita, skrip, ide konten, kode program, puisi, terjemahan, ringkasan, atau pembahasan ilmiah/populer.\n' +
      '   - Gaya bicara: Gaul, santai, to-the-point ala anak tongkrongan (gunakan "gue" dan "lo", panggil "bray/bro").\n' +
      '   - DILARANG KERAS menggunakan kata "aku", "saya", "kamu", atau "anda"!\n' +
      '   - DILARANG KERAS menggunakan emoji apa pun dalam jawabanmu!\n' +
      '2. KUALITAS GENERASI:\n' +
      '   - Buat hasil generasi yang sangat kreatif, terstruktur, padat berisi, dan langsung siap dinikmati atau dipakai oleh user.\n' +
      '3. FORMAT:\n' +
      '   - Gunakan Discord Markdown (heading, code block, bullet points) yang rapi.';
  } else if (channelType === 'ai-prompt') {
    systemPromptContent =
      'Nama kamu adalah Bot Fly (atau Fly), Master Prompt Engineer generative AI (Midjourney, Stable Diffusion, DALL-E 3, ChatGPT, Claude) di server ini.\n\n' +
      'ATURAN KEPRIBADIAN & GAYA BAHASA (MUTLAK):\n' +
      '1. IDENTITAS & NADA BICARA:\n' +
      '   - Kamu adalah ahli racik prompt AI kelas dunia yang mengubah ide mentah atau konsep sederhana user menjadi prompt visual / teks tingkat master.\n' +
      '   - Gaya bicara: Gaul, santai, cerdas ala anak tongkrongan (gunakan "gue" dan "lo", panggil "bray/bro").\n' +
      '   - DILARANG KERAS menggunakan kata "aku", "saya", "kamu", atau "anda"!\n' +
      '   - DILARANG KERAS menggunakan emoji apa pun dalam jawabanmu!\n' +
      '2. STRUKTUR JAWABAN WAJIB (JELAS & RAPI):\n' +
      '   • **Konsep Prompt**: Penjelasan singkat pendekatan visual atau logika prompt yang dirancang.\n' +
      '   • **Prompt Utama (Code Block ```)**: Tuliskan prompt detail dalam BAHASA INGGRIS yang kaya deskriptor visual (subject, environment, lighting, cinematic camera, render engine seperti Unreal Engine 5 / Octane, aesthetic, aspect ratio misal --ar 16:9 --v 6.1).\n' +
      '   • **Negative Prompt (Code Block ```)**: Kata kunci negatif untuk mencegah gambar cacat/blurry/distorsi.\n' +
      '   • **Tips Eksekusi**: Parameter atau variasi kata kunci rekomendasi untuk dieksplorasi user.';
  } else {
    systemPromptContent = SYSTEM_PROMPT.content;
  }

  const systemMessage = {
    role: 'system',
    content: systemPromptContent,
  };

  // Buat isi pesan user (dengan Vision jika ada foto)
  let userMessageContent;
  if (imageUrl) {
    userMessageContent = [
      {
        type: 'text',
        text: `[Dari user: ${authorName}]\n${finalPrompt}`,
      },
      {
        type: 'image_url',
        image_url: {
          url: imageUrl,
          detail: 'low',
        },
      },
    ];
  } else {
    userMessageContent = `[Dari user: ${authorName}]\n${finalPrompt}`;
  }

  // Riwayat percakapan per user khusus entertainment channel
  const histKey = `${channelType}:${userId}`;
  const now = Date.now();
  let session = userHistories.get(histKey);
  if (!session || (now - session.lastActive) > CONVERSATION_TIMEOUT_MS) {
    session = {
      lastActive: now,
      messages: [],
    };
  }

  session.messages.push({
    role: 'user',
    content: userMessageContent,
  });

  if (session.messages.length > 8) {
    session.messages = session.messages.slice(-8);
  }

  session.lastActive = now;
  userHistories.set(histKey, session);

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...session.messages],
      max_tokens: 1600,
      temperature: 0.75,
    });

    const reply = response.choices[0]?.message?.content?.trim() || 'Tidak ada balasan dari model.';

    session.messages.push({
      role: 'assistant',
      content: reply,
    });
    session.lastActive = Date.now();
    userHistories.set(histKey, session);

    return {
      success: true,
      reply,
      model: response.model || 'gpt-4o-mini',
    };
  } catch (error) {
    console.error(`[OPENAI ${channelType.toUpperCase()} ERROR]:`, error);
    return {
      success: false,
      error: error.message || 'Terjadi kesalahan saat menghubungi server OpenAI.',
    };
  }
}

/**
 * Menghapus riwayat percakapan pengguna
 * @param {string} userId
 */
function clearUserHistory(userId) {
  return userHistories.delete(userId);
}

/**
 * Mendapatkan jumlah riwayat pesan pengguna
 * @param {string} userId
 * @returns {number}
 */
function getUserHistoryCount(userId) {
  const session = userHistories.get(userId);
  if (!session) return 0;
  return session.messages.length;
}

module.exports = {
  askAI,
  askEntertainmentAI,
  clearUserHistory,
  getUserHistoryCount,
};

