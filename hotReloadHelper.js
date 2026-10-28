const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { REST, Routes } = require('discord.js');

/**
 * Menjalankan shell command secara asynchronous menggunakan Promise
 */
function runShell(command, options = {}) {
  return new Promise((resolve) => {
    exec(command, { cwd: __dirname, ...options }, (error, stdout, stderr) => {
      resolve({
        success: !error,
        stdout: stdout ? stdout.trim() : '',
        stderr: stderr ? stderr.trim() : '',
        error: error ? error.message : null,
      });
    });
  });
}

/**
 * Menarik update kode terbaru dari repository GitHub
 */
async function pullLatestCode() {
  // 1. Coba menggunakan Git CLI (Metode standar & tercepat)
  const gitRes = await runShell('git pull origin main');
  if (gitRes.success) {
    const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
    return {
      success: true,
      method: 'git',
      details: gitRes.stdout || 'Kode berhasil diperbarui.',
      latestCommit: logRes.stdout || 'Versi terbaru',
    };
  }

  // 2. Jika git CLI gagal atau ada conflict, coba git stash lalu pull
  const stashRes = await runShell('git stash && git pull origin main');
  if (stashRes.success) {
    const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
    return {
      success: true,
      method: 'git-stash-pull',
      details: stashRes.stdout,
      latestCommit: logRes.stdout || 'Versi terbaru',
    };
  }

  return {
    success: false,
    method: 'git',
    details: gitRes.stderr || gitRes.error || 'Gagal mengeksekusi git pull.',
    latestCommit: 'Tidak diketahui',
  };
}

/**
 * Me-reload seluruh modul JavaScript dan commands ke memori bot secara realtime (Zero Downtime)
 * @param {import('discord.js').Client} client
 * @returns {Promise<{success: boolean, loadedCount: number, commands: string[], error?: string}>}
 */
async function reloadModulesAndCommands(client) {
  try {
    const commandsDir = path.join(__dirname, 'commands');

    // 1. Bersihkan seluruh cache require() internal (kecuali node_modules & discord.js gateway)
    const baseDir = __dirname;
    let purgedCount = 0;
    for (const key of Object.keys(require.cache)) {
      if (key.startsWith(baseDir) && !key.includes('node_modules')) {
        delete require.cache[key];
        purgedCount++;
      }
    }

    // 2. Muat ulang seluruh file command di folder commands/
    const commandFiles = fs.readdirSync(commandsDir).filter((f) => f.endsWith('.js'));
    const loadedCommands = [];

    client.commands.clear();

    for (const file of commandFiles) {
      const filePath = path.join(commandsDir, file);
      try {
        const cmd = require(filePath);
        if (cmd && 'data' in cmd && 'execute' in cmd) {
          client.commands.set(cmd.data.name, cmd);
          loadedCommands.push(cmd.data.name);
        }
      } catch (cmdErr) {
        console.error(`[HOT RELOAD ERROR] Gagal memuat command ${file}:`, cmdErr.message);
      }
    }

    // 3. Daftarkan dan sinkronkan slash commands ke Discord REST API secara realtime
    try {
      const token = process.env.TOKEN;
      const clientId = process.env.CLIENT_ID;
      if (token && clientId) {
        const rest = new REST({ version: '10' }).setToken(token);
        const apiPayload = [];
        for (const [, cmd] of client.commands) {
          apiPayload.push(cmd.data.toJSON());
        }
        await rest.put(Routes.applicationCommands(clientId), { body: apiPayload });
      }
    } catch (restErr) {
      console.warn('[HOT RELOAD REST WARN] Pendaftaran REST API dilewati:', restErr.message);
    }

    return {
      success: true,
      purgedCacheCount: purgedCount,
      loadedCount: loadedCommands.length,
      commands: loadedCommands,
    };
  } catch (err) {
    console.error('[HOT RELOAD FATAL]:', err);
    return {
      success: false,
      loadedCount: 0,
      commands: [],
      error: err.message,
    };
  }
}

module.exports = {
  pullLatestCode,
  reloadModulesAndCommands,
};
