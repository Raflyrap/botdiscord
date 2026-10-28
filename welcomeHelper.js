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

  // 1. Cek channel ID yang sudah disimpan
  if (targetChannelId) {
    const channel = guild.channels.cache.get(targetChannelId) || await guild.channels.fetch(targetChannelId).catch(() => null);
    if (channel && channel.isTextBased()) return channel;
  }

  // 2. Fallback: Cari channel teks berdasarkan nama (welcome / leave / left)
  const keywords = type === 'welcome' 
    ? ['welcome', 'selamat-datang', 'sambutan', 'member-join']
    : ['leave', 'left', 'goodbye', 'sampai-jumpa', 'keluar', 'member-left'];

  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  for (const [, ch] of channels) {
    if (ch && ch.type === ChannelType.GuildText) {
      const name = ch.name.toLowerCase();
      if (keywords.some((k) => name.includes(k)) && ch.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
        // Otomatis sinkronkan ID channel yang ditemukan
        if (type === 'welcome') {
          setGuildConfig(guild.id, { welcomeChannel: ch.id });
        } else {
          setGuildConfig(guild.id, { leaveChannel: ch.id });
        }
        return ch;
      }
    }
  }

  // 3. Fallback: Gunakan channel bawaan Discord (System Channel) jika ada
  if (guild.systemChannel && guild.systemChannel.permissionsFor(guild.client.user)?.has(PermissionFlagsBits.SendMessages)) {
    return guild.systemChannel;
  }

  return null;
}

// Format durasi (ms) menjadi teks singkat
function formatDuration(ms) {
  if (!ms || ms <= 0) return 'Belum diketahui';
  const d = Math.floor(ms / 86400000);
  if (d >= 365) {
    const y = Math.floor(d / 365);
    const m = Math.floor((d % 365) / 30);
    return `${y} tahun${m ? ` ${m} bulan` : ''}`;
  }
  if (d >= 30) {
    const m = Math.floor(d / 30);
    const remD = d % 30;
    return `${m} bulan${remD ? ` ${remD} hari` : ''}`;
  }
  if (d >= 1) return `${d} hari`;
  const h = Math.floor(ms / 3600000);
  if (h >= 1) return `${h} jam`;
  return `${Math.max(1, Math.floor(ms / 60000))} menit`;
}

function memberAvatar(member, size = 512) {
  if (!member) return undefined;
  if (member.displayAvatarURL) {
    return member.displayAvatarURL({ extension: 'png', forceStatic: false, size });
  }
  if (member.user && member.user.displayAvatarURL) {
    return member.user.displayAvatarURL({ extension: 'png', forceStatic: false, size });
  }
  return undefined;
}

// Mendapatkan URL banner resmi Discord Server
function getServerBanner(guild) {
  if (!guild) return null;
  return (
    guild.bannerURL({ extension: 'png', size: 1024 }) ||
    guild.splashURL({ extension: 'png', size: 1024 }) ||
    guild.discoverySplashURL({ extension: 'png', size: 1024 }) ||
    null
  );
}

// Membuat embed pesan selamat datang
function createWelcomeEmbed(member) {
  const guild = member.guild;
  const user = member.user || member;
  const createdTimestamp = user.createdTimestamp ? Math.floor(user.createdTimestamp / 1000) : null;
  const avatar = memberAvatar(member, 512);
  const serverBanner = getServerBanner(guild);

  const displayName = member.displayName || user.globalName || user.username;
  const username = user.username;
  const memberCountFormatted = guild.memberCount ? guild.memberCount.toLocaleString('id-ID') : '-';

  const descLines = [
    `Halo <@${user.id}>, selamat datang di **${guild.name}**!`,
    `Selamat bergabung dan semoga betah bersama kami.`,
    ``,
    `**Informasi Member:**`,
    `• **Nama:** ${displayName} (\`${username}\`)`,
    `• **ID Akun:** \`${user.id}\``,
    `• **Member Ke:** \`#${memberCountFormatted}\``,
  ];

  if (createdTimestamp) {
    descLines.push(`• **Akun Dibuat:** <t:${createdTimestamp}:F> (<t:${createdTimestamp}:R>)`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `${username} bergabung ke server`,
      iconURL: memberAvatar(member, 128),
    })
    .setTitle(`Selamat Datang di ${guild.name}`)
    .setDescription(descLines.join('\n'))
    .setThumbnail(avatar)
    .setFooter({
      text: `${guild.name} • Selamat bergabung`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();

  if (serverBanner) {
    embed.setImage(serverBanner);
  }

  return embed;
}

// Membuat embed pesan perpisahan (member left)
function createLeaveEmbed(member) {
  const guild = member.guild;
  const user = member.user || member;
  const avatar = memberAvatar(member, 512);
  const serverBanner = getServerBanner(guild);

  const displayName = member.displayName || user.globalName || user.username;
  const username = user.username;
  const memberCountFormatted = guild.memberCount ? guild.memberCount.toLocaleString('id-ID') : '-';

  let durationText = 'Tidak tercatat';
  if (member.joinedTimestamp) {
    const durationMs = Date.now() - member.joinedTimestamp;
    durationText = `${formatDuration(durationMs)} yang lalu (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`;
  }

  const descLines = [
    `**${displayName}** (\`${username}\`) telah meninggalkan server **${guild.name}**.`,
    `Terima kasih atas waktu dan kebersamaannya selama ini.`,
    ``,
    `**Informasi Member:**`,
    `• **Nama:** ${displayName} (\`${username}\`)`,
    `• **ID Akun:** \`${user.id}\``,
    `• **Sisa Member:** \`${memberCountFormatted} orang\``,
    `• **Lama Bergabung:** ${durationText}`,
  ];

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setAuthor({
      name: `${username} keluar dari server`,
      iconURL: memberAvatar(member, 128),
    })
    .setTitle('Sampai Jumpa Lagi')
    .setDescription(descLines.join('\n'))
    .setThumbnail(avatar)
    .setFooter({
      text: `${guild.name} • Semoga sukses selalu`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTimestamp();

  if (serverBanner) {
    embed.setImage(serverBanner);
  }

  return embed;
}

// Membangun payload lengkap pesan selamat datang (menggunakan banner server Discord)
async function buildWelcomePayload(member) {
  const embed = createWelcomeEmbed(member);
  return { embed, files: [] };
}

// Membangun payload lengkap pesan perpisahan (menggunakan banner server Discord)
async function buildLeavePayload(member) {
  const embed = createLeaveEmbed(member);
  return { embed, files: [] };
}

module.exports = {
  getGuildConfig,
  setGuildConfig,
  resolveChannel,
  createWelcomeEmbed,
  createLeaveEmbed,
  buildWelcomePayload,
  buildLeavePayload,
};
