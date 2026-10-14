const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

const configPath = path.join(__dirname, 'welcome-config.json');

// Membaca file konfigurasi
function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error membaca welcome-config.json:', error);
    return {};
  }
}

// Menyimpan konfigurasi ke file
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan welcome-config.json:', error);
  }
}

// Mendapatkan konfigurasi channel untuk guild tertentu
function getGuildConfig(guildId) {
  const config = loadConfig();
  return config[guildId] || {};
}

// Memperbarui konfigurasi channel untuk guild tertentu
function setGuildConfig(guildId, newSettings) {
  const config = loadConfig();
  config[guildId] = { ...(config[guildId] || {}), ...newSettings };
  saveConfig(config);
  return config[guildId];
}

// Mencari channel pengiriman pesan secara cerdas
async function resolveChannel(guild, type = 'welcome') {
  const guildConfig = getGuildConfig(guild.id);
  const targetChannelId = type === 'welcome' ? guildConfig.welcomeChannel : guildConfig.leaveChannel;

  // 1. Jika sudah diatur secara manual oleh admin lewat /setwelcome
  if (targetChannelId) {
    const channel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
    if (channel && channel.isTextBased()) return channel;
  }

  // 2. Gunakan channel bawaan Discord (System Channel) jika ada
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
    return guild.systemChannel;
  }

  // 3. Fallback: Cari text channel berdasarkan nama umum
  const keywords = type === 'welcome' 
    ? ['welcome', 'selamat-datang', 'lobby', 'general', 'utama', 'chat']
    : ['leave', 'goodbye', 'sampai-jumpa', 'welcome', 'lobby', 'general'];

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const [, ch] of channels) {
    if (ch && ch.type === ChannelType.GuildText) {
      const name = ch.name.toLowerCase();
      if (keywords.some((k) => name.includes(k)) && ch.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
        return ch;
      }
    }
  }

  // 4. Fallback terakhir: Ambil text channel pertama yang bisa dikirimi pesan
  for (const [, ch] of channels) {
    if (ch && ch.type === ChannelType.GuildText && ch.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
      return ch;
    }
  }

  return null;
}

// Membuat embed pesan selamat datang
function createWelcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor(0x57F287) // Hijau segar khas Discord
    .setTitle('👋 Selamat Datang di Server!')
    .setDescription(
      `Halo <@${member.id}>, selamat datang di **${member.guild.name}**!\n` +
      `Senang kamu bergabung bersama kami, semoga betah dan seru-seruan di sini ya! 🎉`
    )
    .addFields(
      { name: '👤 Nama Akun', value: `${member.user.tag}`, inline: true },
      { name: '📅 Akun Dibuat', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
      { name: '👥 Member Ke-', value: `\`#${member.guild.memberCount}\``, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Selamat bergabung di ${member.guild.name} ✨`, iconURL: member.guild.iconURL() || undefined })
    .setTimestamp();
}

// Membuat embed pesan perpisahan (member left)
function createLeaveEmbed(member) {
  return new EmbedBuilder()
    .setColor(0xED4245) // Merah khas Discord
    .setTitle('👋 Sampai Jumpa!')
    .setDescription(
      `**${member.user.tag}** baru saja meninggalkan server **${member.guild.name}**.\n` +
      `Terima kasih atas kebersamaannya selama ini! 🕊️`
    )
    .addFields(
      { name: '👥 Total Member Sekarang', value: `\`${member.guild.memberCount} orang\``, inline: true }
    )
    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
    .setFooter({ text: `Semoga sukses selalu di luar sana ✨` })
    .setTimestamp();
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  resolveChannel,
  createWelcomeEmbed,
  createLeaveEmbed,
};
