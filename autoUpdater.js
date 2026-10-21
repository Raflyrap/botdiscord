const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_OWNER = 'Raflyrap';
const REPO_NAME = 'botdiscord';
const BRANCH = 'main';

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Node-AutoUpdater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

async function checkForUpdates() {
  try {
    if (process.env.DISABLE_AUTO_UPDATE === 'true' || process.env.AUTO_UPDATE === 'false') {
      console.log('[AUTO-UPDATER] Auto-update dilewati (dinonaktifkan via config).');
      return;
    }
    console.log('[AUTO-UPDATER] Memeriksa update terbaru dari GitHub...');
    // Cek commit SHA terbaru dari GitHub API
    const apiUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/commits/${BRANCH}`;
    const commitDataRaw = await downloadFile(apiUrl);
    const commitData = JSON.parse(commitDataRaw.toString());
    const latestSha = commitData.sha;

    const versionFile = path.join(__dirname, '.current_commit');
    let currentSha = '';
    if (fs.existsSync(versionFile)) {
      currentSha = fs.readFileSync(versionFile, 'utf-8').trim();
    }

    if (currentSha === latestSha) {
      console.log('[AUTO-UPDATER] Kode bot sudah versi paling baru! (Up to date)');
      return;
    }

    console.log(`[AUTO-UPDATER] Ditemukan update baru! (${latestSha.substring(0, 7)}) Mengunduh...`);
    const tarUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.tar.gz`;
    const tarBuffer = await downloadFile(tarUrl);
    const tempTarPath = path.join(__dirname, 'temp_update.tar.gz');
    fs.writeFileSync(tempTarPath, tarBuffer);

    // Ekstrak tar.gz menggunakan tar bawaan container Linux
    try {
      // 1. Simpan backup file konfigurasi & database server agar tidak tertimpa git update
      const DATA_FILES = [
        'welcome-config.json',
        'verifConfig.json',
        'levelingConfig.json',
        'levelingData.json',
        'autoRoleConfig.json',
        'autoModConfig.json',
        'afkData.json',
        'serverStatsConfig.json',
        'tempVoiceConfig.json',
        'privateAiConfig.json',
        'ticketConfig.json',
        'ticketData.json',
        'gameConfig.json',
        'logConfig.json',
        'reminderData.json',
        'serverTemplateConfig.json',
        'music/music.mp3',
        '.env',
      ];

      const backups = new Map();
      for (const file of DATA_FILES) {
        const fullPath = path.join(__dirname, file);
        if (fs.existsSync(fullPath)) {
          try {
            backups.set(file, fs.readFileSync(fullPath));
          } catch (e) {
            console.warn(`[AUTO-UPDATER] Gagal membaca backup ${file}:`, e.message);
          }
        }
      }

      // 2. Ekstrak update kode terbaru dari GitHub
      execSync(`tar -xzf temp_update.tar.gz --strip-components=1 -C .`, { cwd: __dirname });
      fs.writeFileSync(versionFile, latestSha, 'utf-8');
      if (fs.existsSync(tempTarPath)) fs.unlinkSync(tempTarPath);

      // 3. Kembalikan file konfigurasi server yang sudah dibackup
      for (const [file, content] of backups) {
        try {
          const targetPath = path.join(__dirname, file);
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(targetPath, content);
        } catch (e) {
          console.warn(`[AUTO-UPDATER] Gagal memulihkan ${file}:`, e.message);
        }
      }
      console.log(`[AUTO-UPDATER] Berhasil mempertahankan ${backups.size} file data/konfigurasi server.`);
      console.log('[AUTO-UPDATER] ✅ Berhasil auto-update kode ke versi terbaru dari GitHub!');

      try {
        console.log('[AUTO-UPDATER] Memeriksa & sinkronisasi dependensi baru...');
        execSync('npm install --omit=dev --no-audit', { cwd: __dirname, stdio: 'ignore' });
      } catch (npmErr) {
        console.warn('[AUTO-UPDATER] Lewati npm install:', npmErr.message);
      }
    } catch (extractErr) {
      console.error('[AUTO-UPDATER] Gagal mengekstrak update:', extractErr);
    }
  } catch (err) {
    console.log('[AUTO-UPDATER] Lewati update otomatis (tidak dapat menghubungi GitHub):', err.message);
  }
}

module.exports = { checkForUpdates };
