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
    const zipUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/archive/refs/heads/${BRANCH}.zip`;
    const zipBuffer = await downloadFile(zipUrl);
    const tempZipPath = path.join(__dirname, 'temp_update.zip');
    fs.writeFileSync(tempZipPath, zipBuffer);

    // Ekstrak zip menggunakan tar bawaan container
    try {
      execSync(`tar -xf temp_update.zip --strip-components=1 -C .`, { cwd: __dirname });
      fs.writeFileSync(versionFile, latestSha, 'utf-8');
      if (fs.existsSync(tempZipPath)) fs.unlinkSync(tempZipPath);
      console.log('[AUTO-UPDATER] ✅ Berhasil auto-update kode ke versi terbaru dari GitHub!');
    } catch (extractErr) {
      console.error('[AUTO-UPDATER] Gagal mengekstrak update:', extractErr);
    }
  } catch (err) {
    console.log('[AUTO-UPDATER] Lewati update otomatis (tidak dapat menghubungi GitHub):', err.message);
  }
}

module.exports = { checkForUpdates };
