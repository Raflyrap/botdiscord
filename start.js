const { checkForUpdates } = require('./autoUpdater');

(async () => {
  // 1. Cek update otomatis dari GitHub
  await checkForUpdates().catch(console.error);

  // 2. Jalankan bot utama
  require('./bot.js');
})();
