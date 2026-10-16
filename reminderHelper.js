const fs = require('fs');
const path = require('path');
const { EmbedBuilder } = require('discord.js');

const DATA_PATH = path.join(__dirname, 'reminderData.json');

function loadReminders() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      fs.writeFileSync(DATA_PATH, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8') || '[]');
  } catch (err) {
    console.error('Error loadReminders:', err.message);
    return [];
  }
}

function saveReminders(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saveReminders:', err.message);
  }
}

// Parsing durasi seperti 30s, 10m, 2h, 1d, atau "10 menit", "1 jam"
function parseDuration(input) {
  if (!input) return null;
  const str = input.trim().toLowerCase();

  // Pola singkat: 10s, 15m, 2h, 1d
  const shortMatch = str.match(/^(\d+)\s*([smhd])$/);
  if (shortMatch) {
    const val = parseInt(shortMatch[1], 10);
    const unit = shortMatch[2];
    if (unit === 's') return val * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
  }

  // Pola teks bahasa indonesia: 10 detik, 15 menit, 2 jam, 1 hari
  const longMatch = str.match(/^(\d+)\s*(detik|menit|jam|hari)$/);
  if (longMatch) {
    const val = parseInt(longMatch[1], 10);
    const unit = longMatch[2];
    if (unit === 'detik') return val * 1000;
    if (unit === 'menit') return val * 60 * 1000;
    if (unit === 'jam') return val * 60 * 60 * 1000;
    if (unit === 'hari') return val * 24 * 60 * 60 * 1000;
  }

  return null;
}

function removeReminder(id) {
  const all = loadReminders();
  const filtered = all.filter((r) => r.id !== id);
  saveReminders(filtered);
}

function scheduleReminder(client, reminder) {
  const delay = reminder.targetTime - Date.now();

  const trigger = async () => {
    try {
      removeReminder(reminder.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Pengingat Waktu')
        .setDescription(
          `Halo <@${reminder.userId}>, ini pengingat yang kamu atur sebelumnya:\n\n` +
          `**Pesan:**\n${reminder.messageText}`
        )
        .setFooter({ text: 'Pengingat otomatis FlyBot' })
        .setTimestamp();

      let targetChannel = null;
      if (reminder.channelId) {
        targetChannel = client.channels.cache.get(reminder.channelId) || await client.channels.fetch(reminder.channelId).catch(() => null);
      }

      if (targetChannel && targetChannel.isTextBased()) {
        await targetChannel.send({
          content: `<@${reminder.userId}>`,
          embeds: [embed],
        }).catch(() => {});
      } else {
        const user = client.users.cache.get(reminder.userId) || await client.users.fetch(reminder.userId).catch(() => null);
        if (user) {
          await user.send({ embeds: [embed] }).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Error saat mengeksekusi pengingat:', err);
    }
  };

  if (delay <= 0) {
    trigger();
  } else {
    setTimeout(trigger, delay);
  }
}

function createReminder(client, userId, channelId, durationMs, messageText) {
  const all = loadReminders();
  const id = `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const targetTime = Date.now() + durationMs;

  const reminder = {
    id,
    userId,
    channelId,
    createdAt: Date.now(),
    targetTime,
    messageText,
  };

  all.push(reminder);
  saveReminders(all);

  scheduleReminder(client, reminder);
  return reminder;
}

function initReminders(client) {
  const all = loadReminders();
  for (const r of all) {
    scheduleReminder(client, r);
  }
}

module.exports = {
  parseDuration,
  createReminder,
  loadReminders,
  initReminders,
};
