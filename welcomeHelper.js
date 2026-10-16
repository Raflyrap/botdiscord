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

  // 3. Fallback: Cari text channel khusus berdasarkan nama spesifik (welcome / leave)
  const keywords = type === 'welcome' 
    ? ['welcome', 'selamat-datang', 'sambutan', 'member-join']
    : ['leave', 'goodbye', 'sampai-jumpa', 'keluar', 'member-left'];

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const [, ch] of channels) {
    if (ch && ch.type === ChannelType.GuildText) {
      const name = ch.name.toLowerCase();
      if (keywords.some((k) => name.includes(k)) && ch.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
        return ch;
      }
    }
  }

  return null;
}

// Format durasi (ms) menjadi teks singkat, contoh: "1 tahun 2 bulan", "3 hari"
function formatDuration(ms) {
  const d = Math.floor(ms / 86400000);
  if (d >= 365) {
    const y = Math.floor(d / 365), m = Math.floor((d % 365) / 30);
    return `${y} tahun${m ? ` ${m} bulan` : ''}`;
  }
  if (d >= 30) return `${Math.floor(d / 30)} bulan${d % 30 ? ` ${d % 30} hari` : ''}`;
  if (d >= 1) return `${d} hari`;
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h} jam`;
  return `${Math.max(1, Math.floor(ms / 60000))} menit`;
}

function memberAvatar(member, size = 512) {
  return member.displayAvatarURL({ extension: 'png', forceStatic: false, size });
}

// Membuat embed pesan selamat datang
function createWelcomeEmbed(member) {
  const guild = member.guild;
  const created = Math.floor(member.user.createdTimestamp / 1000);
  const avatar = memberAvatar(member);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `${member.user.username} bergabung`, iconURL: memberAvatar(member, 128) })
    .setTitle(`Selamat Datang di ${guild.name}`)
    .setDescription(
      `Halo <@${member.id}>, senang banget kamu sudah bergabung!\n` +
      `Kamu adalah member ke-**${guild.memberCount.toLocaleString()}** di server ini.\n\n` +
      `**Sebelum mulai:**\n` +
      `> Baca peraturan server terlebih dahulu\n` +
      `> Ambil role sesuai minatmu\n` +
      `> Sapa member lain dan perkenalkan dirimu`
    )
    .addFields(
      { name: 'Username', value: `\`${member.user.tag}\``, inline: true },
      { name: 'Akun Dibuat', value: `<t:${created}:D>\n<t:${created}:R>`, inline: true },
      { name: 'Member Ke', value: `\`#${guild.memberCount.toLocaleString()}\``, inline: true },
    )
    .setThumbnail(avatar)
    .setFooter({ text: `${guild.name}  •  Selamat bergabung`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  const banner = guild.bannerURL({ size: 1024 });
  if (banner) embed.setImage(banner);
  return embed;
}

// Membuat embed pesan perpisahan (member left)
function createLeaveEmbed(member) {
  const guild = member.guild;
  const avatar = memberAvatar(member);
  const joined = member.joinedTimestamp;

  const fields = [
    { name: 'Username', value: `\`${member.user.tag}\``, inline: true },
    { name: 'Sisa Member', value: `\`${guild.memberCount.toLocaleString()} orang\``, inline: true },
  ];
  if (joined) {
    fields.push({
      name: 'Lama Bergabung',
      value: `\`${formatDuration(Date.now() - joined)}\`\nSejak <t:${Math.floor(joined / 1000)}:D>`,
      inline: true,
    });
  }

  return new EmbedBuilder()
    .setColor(0x2B2D31)
    .setAuthor({ name: `${member.user.username} keluar`, iconURL: memberAvatar(member, 128) })
    .setTitle('Sampai Jumpa Lagi')
    .setDescription(
      `**${member.displayName || member.user.username}** telah meninggalkan **${guild.name}**.\n` +
      `Terima kasih atas waktu dan kebersamaannya selama ini.\n` +
      `Pintu server selalu terbuka kalau mau kembali.`
    )
    .addFields(fields)
    .setThumbnail(avatar)
    .setFooter({ text: `${guild.name}  •  Semoga sukses selalu`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  resolveChannel,
  createWelcomeEmbed,
  createLeaveEmbed,
};
