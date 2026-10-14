// Memuat environment variables dari file .env
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

// Validasi konfigurasi sebelum registrasi
const token = process.env.TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId || guildId === 'ISI_GUILD_ID_DI_SINI') {
  console.error('❌ Error: Pastikan TOKEN, CLIENT_ID, dan GUILD_ID sudah diisi dengan benar di file .env sebelum deploy command!');
  process.exit(1);
}

// Array untuk menyimpan data command dalam format JSON
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
// Baca semua file command di folder commands/
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    commands.push(command.data.toJSON());
  } else {
    console.warn(`[PERINGATAN] Command di ${filePath} tidak memiliki properti "data" atau "execute" yang valid.`);
  }
}

// Inisialisasi REST module discord.js
const rest = new REST({ version: '10' }).setToken(token);

// Daftarkan slash commands secara GLOBAL (berlaku untuk semua server yang di-invite bot)
(async () => {
  try {
    console.log(`🚀 Memulai pendaftaran ${commands.length} slash command secara GLOBAL ke semua server...`);

    const data = await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    );

    console.log(`✅ Berhasil mendaftarkan ${data.length} slash command secara GLOBAL!`);
  } catch (error) {
    console.error('❌ Terjadi kesalahan saat mendaftarkan command secara global:', error);
  }
})();

