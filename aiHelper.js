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
  clearUserHistory,
  getUserHistoryCount,
};
