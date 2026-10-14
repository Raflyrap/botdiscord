const { checkForUpdates } = require('./autoUpdater');

(async () => {
  try {
    // 1. Cek update otomatis dari GitHub saat bot start
    await checkForUpdates();
  } catch (err) {
    console.error('[AUTO-UPDATER] Error:', err);
  }

  // 2. Jalankan bot utama
  require('./bot.js');
})();
