const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');
const { REST, Routes } = require('discord.js');

const REPO_OWNER = 'Raflyrap';
const REPO_NAME = 'botdiscord';
const BRANCH = 'main';
const GITHUB_REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}.git`;

// File konfigurasi dan data yang wajib dipertahankan agar tidak tertimpa pembaruan
const PROTECTED_DATA_FILES = [
  '.env',
  'welcome-config.json',
  'verifConfig.json',
  'levelingConfig.json',
  'levelingData.json',
  'autoRoleConfig.json',
  'autoModConfig.json',
  'afkData.json',
  'serverStatsConfig.json',
  'tempVoiceConfig.json',
  'tempVoiceRooms.json',
  'privateAiConfig.json',
  'ticketConfig.json',
  'ticketData.json',
  'gameConfig.json',
  'logConfig.json',
  'reminderData.json',
  'serverTemplateConfig.json',
  'botMonitorData.json',
  'maintenanceConfig.json',
  'botPresenceConfig.json',
  'featureRequests.json',
  'hdChannelConfig.json',
  'patroliConfig.json',
];

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
 * Mengunduh buffer dari URL publik (HTTPS)
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'FlyBot-AutoUpdater/2.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchBuffer(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

/**
 * Update kode via GitHub Direct REST API & Tarball (Bekerja tanpa folder .git)
 */
async function pullViaGitHubApi() {
  const versionFile = path.join(__dirname, '.current_commit');
  let currentSha = '';
  if (fs.existsSync(versionFile)) {
    currentSha = fs.readFileSync(versionFile, 'utf8').trim();
  }

  // 1. Dapatkan SHA commit terbaru dari GitHub API
  const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`;
  const commitBuf = await fetchBuffer(apiUrl);
  const commitData = JSON.parse(commitBuf.toString());
  const latestSha = commitData.sha || '';
  const shortSha = latestSha.substring(0, 7);
  const commitMsg = commitData.commit?.message?.split('\n')[0] || 'Update terbaru';

  // 2. Cek apakah kode sudah versi terbaru
  if (currentSha && (currentSha === latestSha || currentSha === shortSha)) {
    return {
      success: true,
      hasUpdates: false,
      method: 'github-api',
      details: 'Kode bot sudah berada di versi paling terbaru.',
      beforeCommit: shortSha,
      afterCommit: shortSha,
      latestCommit: `${shortSha} - ${commitMsg}`,
    };
  }

  // 3. Ada update baru! Unduh tarball repository
  const tarUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.tar.gz`;
  const tarBuffer = await fetchBuffer(tarUrl);
  const tempTarPath = path.join(__dirname, 'temp_update.tar.gz');
  fs.writeFileSync(tempTarPath, tarBuffer);

  // 4. Backup file data dan konfigurasi server sebelum ekstrak
  const backups = new Map();
  for (const relPath of PROTECTED_DATA_FILES) {
    const fullPath = path.join(__dirname, relPath);
    if (fs.existsSync(fullPath)) {
      try {
        backups.set(relPath, fs.readFileSync(fullPath));
      } catch (e) {}
    }
  }

  // 5. Ekstrak file tar.gz ke direktori bot
  const extractRes = await runShell('tar -xzf temp_update.tar.gz --strip-components=1 -C .');
  if (fs.existsSync(tempTarPath)) {
    try {
      fs.unlinkSync(tempTarPath);
    } catch (e) {}
  }

  if (!extractRes.success) {
    throw new Error(`Gagal mengekstrak arsip pembaruan: ${extractRes.stderr || extractRes.error}`);
  }

  // 6. Pulihkan kembali file data dan konfigurasi
  for (const [relPath, content] of backups) {
    try {
      const targetPath = path.join(__dirname, relPath);
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, content);
    } catch (e) {}
  }

  // 7. Simpan SHA commit saat ini
  fs.writeFileSync(versionFile, latestSha, 'utf8');

  return {
    success: true,
    hasUpdates: true,
    method: 'github-api',
    details: `Berhasil mengunduh dan menerapkan pembaruan dari GitHub via direct archive.`,
    beforeCommit: currentSha ? currentSha.substring(0, 7) : 'Awal',
    afterCommit: shortSha,
    latestCommit: `${shortSha} - ${commitMsg}`,
  };
}

/**
 * Menarik update kode terbaru dari repository GitHub
 * Mendukung Git CLI lokal dan otomatis fallback ke GitHub Direct API jika bukan git repo
 */
async function pullLatestCode() {
  const gitDir = path.join(__dirname, '.git');
  const hasGitFolder = fs.existsSync(gitDir);

  // Jika folder .git belum ada (kasus Pterodactyl container standar)
  if (!hasGitFolder) {
    // Coba inisialisasi Git repository secara otomatis terlebih dahulu
    const initRes = await runShell(`git init && git remote add origin ${GITHUB_REPO_URL}`);
    if (initRes.success) {
      const fetchRes = await runShell('git fetch origin main');
      if (fetchRes.success) {
        // Ambil commit sebelum reset
        const currentShaRes = await runShell('git rev-parse --short HEAD');
        const beforeCommit = currentShaRes.stdout || '';

        // Reset hard ke origin/main
        const resetRes = await runShell('git reset --hard origin/main');
        if (resetRes.success) {
          const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
          const afterLog = await runShell('git rev-parse --short HEAD');
          const afterCommit = afterLog.stdout || '';

          const hasUpdates = !beforeCommit || beforeCommit !== afterCommit;

          return {
            success: true,
            hasUpdates,
            method: 'git-initialized',
            details: resetRes.stdout || 'Repository git berhasil diinisialisasi.',
            beforeCommit: beforeCommit || 'Awal',
            afterCommit: afterCommit,
            latestCommit: logRes.stdout || afterCommit || 'Versi saat ini',
          };
        }
      }
    }

    // Jika inisialisasi git tidak memungkinkan, gunakan metode GitHub Direct API & Tarball
    try {
      return await pullViaGitHubApi();
    } catch (apiErr) {
      return {
        success: false,
        hasUpdates: false,
        method: 'github-api',
        details: apiErr.message || 'Gagal mengunduh pembaruan dari GitHub API.',
        latestCommit: 'Tidak diketahui',
      };
    }
  }

  // Jika folder .git sudah ada, gunakan alur standar Git CLI yang handal
  try {
    const beforeLog = await runShell('git rev-parse --short HEAD');
    const beforeCommit = beforeLog.stdout || '';

    // Selalu fetch commit terbaru dari origin main terlebih dahulu
    await runShell('git fetch origin main');
    const remoteLog = await runShell('git rev-parse --short origin/main');
    const remoteCommit = remoteLog.stdout || '';

    // Jika commit lokal sudah sama persis dengan origin/main
    if (beforeCommit && remoteCommit && beforeCommit === remoteCommit) {
      const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
      return {
        success: true,
        hasUpdates: false,
        method: 'git',
        details: 'Kode bot sudah berada di versi paling terbaru.',
        beforeCommit,
        afterCommit: beforeCommit,
        latestCommit: logRes.stdout || beforeCommit || 'Versi saat ini',
      };
    }

    // Jika ada perbedaan commit, reset hard ke origin/main (bebas konflik file lokal)
    const resetRes = await runShell('git reset --hard origin/main');
    if (resetRes.success) {
      const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
      const afterLog = await runShell('git rev-parse --short HEAD');
      const afterCommit = afterLog.stdout || remoteCommit || '';

      return {
        success: true,
        hasUpdates: true,
        method: 'git-reset',
        details: resetRes.stdout || 'Kode berhasil disinkronkan ke origin/main.',
        beforeCommit,
        afterCommit,
        latestCommit: logRes.stdout || afterCommit || 'Versi saat ini',
      };
    }

    // Fallback: coba git pull standar jika reset gagal
    const gitRes = await runShell('git pull origin main');
    if (gitRes.success) {
      const logRes = await runShell('git log -1 --pretty=format:"%h - %s"');
      const afterLog = await runShell('git rev-parse --short HEAD');
      const afterCommit = afterLog.stdout || '';

      const isAlreadyUpToDate = beforeCommit && afterCommit && beforeCommit === afterCommit;

      return {
        success: true,
        hasUpdates: !isAlreadyUpToDate,
        method: 'git-pull',
        details: gitRes.stdout || 'Kode berhasil diperiksa.',
        beforeCommit,
        afterCommit,
        latestCommit: logRes.stdout || afterCommit || 'Versi saat ini',
      };
    }

    // Fallback ke GitHub Direct API jika Git CLI bermasalah
    return await pullViaGitHubApi();
  } catch (err) {
    try {
      return await pullViaGitHubApi();
    } catch (fallbackErr) {
      return {
        success: false,
        hasUpdates: false,
        method: 'fallback-failed',
        details: fallbackErr.message || err.message,
        latestCommit: 'Tidak diketahui',
      };
    }
  }
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
