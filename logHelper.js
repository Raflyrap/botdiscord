const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');

const CONFIG_PATH = path.join(__dirname, 'logConfig.json');

function loadLogConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8') || '{}');
  } catch (err) {
    console.error('Error loadLogConfig:', err.message);
    return {};
  }
}

function saveLogConfig(data) {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saveLogConfig:', err.message);
  }
}

function getLogConfig(guildId) {
  const configs = loadLogConfig();
  return configs[guildId] || null;
}

function setLogConfig(guildId, data) {
  const configs = loadLogConfig();
  configs[guildId] = { ...(configs[guildId] || {}), ...data };
  saveLogConfig(configs);
  return configs[guildId];
}

async function setupAuditLog(guild) {
  const cfg = getLogConfig(guild.id) || {};

  // 1. Cari atau buat Kategori AUDIT LOG
  let category = cfg.categoryId ? guild.channels.cache.get(cfg.categoryId) : null;
  if (!category || category.type !== ChannelType.GuildCategory) {
    category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase().includes('AUDIT LOG')
    );
  }

  if (!category) {
    category = await guild.channels.create({
      name: 'AUDIT LOG',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
      reason: 'Auto-setup Kategori Audit Log',
    });
  }

  // 2. Cari atau buat Text Channel audit-log
  let channel = cfg.channelId ? guild.channels.cache.get(cfg.channelId) : null;
  if (!channel) {
    channel = await guild.channels.create({
      name: 'audit-log',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: guild.members.me.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageChannels,
          ],
        },
      ],
      reason: 'Auto-setup Channel Audit Log',
    });

    const infoEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({ name: 'FlyBot  •  Sistem Audit Log', iconURL: guild.client.user.displayAvatarURL() })
      .setTitle('Catatan Audit Server')
      .setDescription(
        `Channel ini difungsikan khusus untuk mencatat rekaman aktivitas penting di server secara otomatis.\n\n` +
        `**Aktivitas Yang Dicatat:**\n` +
        `• Pesan Terhapus (Pengirim, channel, isi teks, lampiran file)\n` +
        `• Pesan Diedit (Perbandingan teks sebelum dan sesudah diedit)\n` +
        `• Member Keluar (Waktu bergabung dan daftar role)\n` +
        `• Perubahan Role (Penambahan atau pencabutan role member)`
      )
      .addFields(
        { name: 'Akses', value: 'Hanya Administrator', inline: true },
        { name: 'Status', value: 'Aktif Merekam', inline: true },
      )
      .setFooter({ text: 'Pesan disematkan permanen • Konfigurasi otomatis' })
      .setTimestamp();

    const sent = await channel.send({ embeds: [infoEmbed] });
    await sent.pin().catch(() => {});
  }

  setLogConfig(guild.id, {
    categoryId: category.id,
    channelId: channel.id,
    enabled: true,
  });

  return { category, channel };
}

async function removeAuditLog(guild) {
  const cfg = getLogConfig(guild.id);
  if (!cfg) return false;

  if (cfg.channelId) {
    const ch = guild.channels.cache.get(cfg.channelId) || await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (ch) await ch.delete('Hapus audit log').catch(() => {});
  }

  if (cfg.categoryId) {
    const cat = guild.channels.cache.get(cfg.categoryId) || await guild.channels.fetch(cfg.categoryId).catch(() => null);
    if (cat) await cat.delete('Hapus kategori audit log').catch(() => {});
  }

  setLogConfig(guild.id, {
    categoryId: null,
    channelId: null,
    enabled: false,
  });

  return true;
}

async function sendAuditLog(guild, embed) {
  if (!guild) return;
  const cfg = getLogConfig(guild.id);
  if (!cfg || !cfg.enabled || !cfg.channelId) return;

  try {
    const ch = guild.channels.cache.get(cfg.channelId) || await guild.channels.fetch(cfg.channelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  } catch (err) {
    console.error('Error sendAuditLog:', err.message);
  }
}

module.exports = {
  getLogConfig,
  setLogConfig,
  setupAuditLog,
  removeAuditLog,
  sendAuditLog,
};
