const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  getTemplateConfig,
  setTemplateConfig,
  getOrCreateChannel,
  setupMiniGamesTemplate,
} = require('./templateSetupHelper');
const {
  setupModularFeature,
  removeModularFeature,
} = require('./modularSetupHelper');

/**
 * Katalog lengkap seluruh fitur FlyBot yang dapat di-ON / di-OFF secara individual per server
 */
const FEATURE_CATALOG = [
  {
    key: 'welcome',
    label: 'Welcome (Sambutan Member)',
    configIds: ['welcomeId'],
    keywords: ['welcome', 'selamat-datang', 'sambutan'],
    type: 'welcome',
  },
  {
    key: 'leave',
    label: 'Leave (Member Keluar)',
    configIds: ['leaveId'],
    keywords: ['leave', 'left', 'goodbye', 'sampai-jumpa', 'keluar'],
    type: 'modular',
  },
  {
    key: 'music',
    label: 'Musik (/play)',
    configIds: ['playMusicId'],
    keywords: ['play-music', 'playmusic', 'musik'],
    type: 'modular',
  },
  {
    key: 'hitamkan',
    label: 'Hitamkan Foto',
    configIds: ['hitamkanId'],
    keywords: ['hitamkan'],
    type: 'modular',
  },
  {
    key: 'hd',
    label: 'HD Foto (AI Upscale)',
    configIds: ['hdFotoId'],
    keywords: ['hd-foto', 'hdfoto'],
    type: 'hd',
  },
  {
    key: 'meme',
    label: 'Meme & Canvas Studio',
    configIds: ['memeId'],
    keywords: ['meme'],
    type: 'modular',
  },
  {
    key: 'removebg',
    label: 'Remove Background',
    configIds: ['removeBgId'],
    keywords: ['remove-bg', 'removebg'],
    type: 'modular',
  },
  {
    key: 'pinterest',
    label: 'Pinterest Search',
    configIds: ['pinterestId'],
    keywords: ['pinterest'],
    type: 'modular',
  },
  {
    key: 'stalk',
    label: 'Stalker Profil',
    configIds: ['stalkId'],
    keywords: ['stalk'],
    type: 'modular',
  },
  {
    key: 'sosmed',
    label: 'Sosmed Video Converter',
    configIds: ['tiktokConvertId', 'instagramConvertId', 'facebookConvertId', 'youtubeConvertId'],
    keywords: ['tiktok-convert', 'instagram-convert', 'facebook-convert', 'youtube-convert'],
    type: 'modular',
  },
  {
    key: 'games',
    label: 'Mini Games (Semua Game)',
    configIds: ['coinId', 'numberId', 'rpsId', 'slotId', 'sambungKataId'],
    keywords: ['tebak-koin', 'tebak-angka', 'suit-jepang', 'gacha-slot', 'sambung-kata'],
    type: 'games',
  },
  {
    key: 'sambungkata',
    label: 'Game Sambung Kata',
    configIds: ['sambungKataId'],
    keywords: ['sambung-kata', 'sambungkata'],
    type: 'modular',
  },
  {
    key: 'slot',
    label: 'Game Gacha Slot',
    configIds: ['slotId'],
    keywords: ['gacha-slot', 'slot'],
    type: 'modular',
  },
  {
    key: 'giveaway',
    label: 'Giveaway Interaktif',
    configIds: ['giveawayId'],
    keywords: ['giveaway'],
    type: 'giveaway',
  },
  {
    key: 'level',
    label: 'Leveling & XP Notif',
    configIds: ['levelUpId'],
    keywords: ['level-up', 'levelup', 'rank-notif'],
    type: 'level',
  },
  {
    key: 'voicehub',
    label: 'Temp Voice (Buat Room Voice)',
    configIds: ['hubVoiceId'],
    keywords: ['buat-room-voice', 'buat room voice', 'room-voice'],
    type: 'modular',
  },
  {
    key: 'aigenerating',
    label: 'AI Generating Chat',
    configIds: ['aiGeneratingId'],
    keywords: ['ai-generating', 'aigenerating'],
    type: 'modular',
  },
  {
    key: 'aiprompt',
    label: 'AI Prompt Studio',
    configIds: ['aiPromptId'],
    keywords: ['ai-prompt', 'aiprompt'],
    type: 'modular',
  },
  {
    key: 'fanart',
    label: 'AI Fanart Studio',
    configIds: ['aiFanartId'],
    keywords: ['ai-fanart', 'fanart'],
    type: 'modular',
  },
  {
    key: 'streamer',
    label: 'Notif Live Stream (YT/TikTok)',
    configIds: ['streamerId'],
    keywords: ['notif-stream', 'notif-youtube', 'stream-notif'],
    type: 'streamer',
  },
  {
    key: 'ticket',
    label: 'Sistem Ticket Support',
    configIds: ['ticketId'],
    keywords: ['open-ticket', 'ticket', 'tiket'],
    type: 'ticket',
  },
  {
    key: 'verif',
    label: 'Verifikasi Member',
    configIds: ['verifId'],
    keywords: ['verifikasi', 'verify', 'verif'],
    type: 'verif',
  },
];

function getFeatureDef(featureKey) {
  return FEATURE_CATALOG.find((f) => f.key === String(featureKey || '').toLowerCase()) || null;
}

/**
 * Mengecek apakah fitur tertentu sedang dimatikan (OFF) di guild
 */
function isFeatureDisabled(guildId, featureKey) {
  if (!guildId || !featureKey) return false;
  const cfg = getTemplateConfig(guildId);
  const disabled = Array.isArray(cfg?.disabledFeatures) ? cfg.disabledFeatures : [];
  return disabled.includes(String(featureKey).toLowerCase());
}

/**
 * Menandai fitur sebagai ON atau OFF di konfigurasi guild
 */
function setFeatureDisabled(guildId, featureKey, disabled) {
  const cfg = getTemplateConfig(guildId);
  const current = new Set(Array.isArray(cfg?.disabledFeatures) ? cfg.disabledFeatures : []);
  const key = String(featureKey).toLowerCase();
  if (disabled) {
    current.add(key);
  } else {
    current.delete(key);
  }
  setTemplateConfig(guildId, { disabledFeatures: [...current] });
}

/**
 * Cari atau buat kategori wadah fitur
 */
async function getOrCreateCategory(guild, categoryName) {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let category = channels.find(
    (c) => c && c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(categoryName.toLowerCase())
  );
  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      reason: `Auto-setup kategori ${categoryName}`,
    });
  }
  return category;
}

/**
 * Mengumpulkan semua channel yang terkait dengan fitur tertentu di guild
 */
async function findFeatureChannels(guild, def) {
  const found = new Map();
  const cfg = getTemplateConfig(guild.id);
  const chCfg = cfg?.channels || {};

  const allChannels = await guild.channels.fetch().catch(() => guild.channels.cache);

  // 1. Cek dari templateSetupHelper channels config
  for (const idKey of def.configIds) {
    const chId = chCfg[idKey];
    if (chId && allChannels.has(chId)) {
      found.set(chId, allChannels.get(chId));
    }
  }

  // 2. Cek dari config helper spesifik masing-masing fitur
  try {
    if (def.key === 'welcome') {
      const { getGuildConfig } = require('./welcomeHelper');
      const wId = getGuildConfig(guild.id)?.welcomeChannel;
      if (wId && allChannels.has(wId)) found.set(wId, allChannels.get(wId));
    } else if (def.key === 'leave') {
      const { getGuildConfig } = require('./welcomeHelper');
      const lId = getGuildConfig(guild.id)?.leaveChannel;
      if (lId && allChannels.has(lId)) found.set(lId, allChannels.get(lId));
    } else if (def.key === 'hd') {
      const { getHdConfig } = require('./imageHdHelper');
      const hId = getHdConfig(guild.id)?.channelId;
      if (hId && allChannels.has(hId)) found.set(hId, allChannels.get(hId));
    } else if (def.key === 'giveaway') {
      const { getGiveaway } = require('./giveawayHelper');
      const gId = getGiveaway(guild.id)?.channelId;
      if (gId && allChannels.has(gId)) found.set(gId, allChannels.get(gId));
    } else if (def.key === 'level') {
      const { getLevelConfig } = require('./levelingHelper');
      const lvlCfg = getLevelConfig(guild.id);
      if (lvlCfg?.levelUpChannel && allChannels.has(lvlCfg.levelUpChannel)) {
        found.set(lvlCfg.levelUpChannel, allChannels.get(lvlCfg.levelUpChannel));
      }
    } else if (def.key === 'streamer') {
      const { getGuildStreamerConfig } = require('./streamerHelper');
      const sId = getGuildStreamerConfig(guild.id)?.channelId;
      if (sId && allChannels.has(sId)) found.set(sId, allChannels.get(sId));
    } else if (def.key === 'voicehub') {
      const { getTempVoiceConfig } = require('./tempVoiceHelper');
      const vId = getTempVoiceConfig(guild.id)?.hubChannelId;
      if (vId && allChannels.has(vId)) found.set(vId, allChannels.get(vId));
    } else if (def.key === 'ticket') {
      const { getGuildTicketConfig } = require('./ticketHelper');
      const tId = getGuildTicketConfig(guild.id)?.panelChannelId;
      if (tId && allChannels.has(tId)) found.set(tId, allChannels.get(tId));
    } else if (def.key === 'verif') {
      const { getVerifConfig } = require('./verifHelper');
      const vfId = getVerifConfig(guild.id)?.verifChannelId;
      if (vfId && allChannels.has(vfId)) found.set(vfId, allChannels.get(vfId));
    }
  } catch (_) {}

  // 3. Fallback: cari berdasarkan keyword nama channel (hindari kategori)
  for (const [, ch] of allChannels) {
    if (!ch || ch.type === ChannelType.GuildCategory) continue;
    const cleanName = ch.name.toLowerCase();
    if (def.keywords.some((kw) => cleanName.includes(kw))) {
      found.set(ch.id, ch);
    }
  }

  return [...found.values()];
}

/**
 * MEMATIKAN (OFF) satu fitur secara individual & menghapus channel-nya secara otomatis
 */
async function disableFeature(guild, featureKey) {
  const def = getFeatureDef(featureKey);
  if (!def) {
    return { success: false, error: `Fitur "${featureKey}" tidak dikenal.` };
  }

  const channelsToDelete = await findFeatureChannels(guild, def);
  const deletedNames = [];

  for (const ch of channelsToDelete) {
    try {
      const name = ch.name;
      await ch.delete(`Fitur ${def.label} dinonaktifkan (OFF) oleh Admin`);
      deletedNames.push(name);
    } catch (err) {
      console.warn(`[FEATURE OFF] Gagal menghapus channel ${ch.name}:`, err.message);
    }
  }

  // Bersihkan ID channel di templateSetupHelper
  const cfg = getTemplateConfig(guild.id);
  const chCfg = { ...(cfg.channels || {}) };
  for (const idKey of def.configIds) {
    delete chCfg[idKey];
  }
  setTemplateConfig(guild.id, { channels: chCfg });

  // Bersihkan config spesifik masing-masing helper
  try {
    if (def.type === 'modular') {
      removeModularFeature(guild.id, def.key);
    }
    if (def.key === 'welcome') {
      const { setGuildConfig } = require('./welcomeHelper');
      setGuildConfig(guild.id, { welcomeChannel: null });
    } else if (def.key === 'leave') {
      const { setGuildConfig } = require('./welcomeHelper');
      setGuildConfig(guild.id, { leaveChannel: null });
    } else if (def.key === 'hd') {
      const { setHdConfig } = require('./imageHdHelper');
      setHdConfig(guild.id, { channelId: null });
    } else if (def.key === 'giveaway') {
      const { setGiveaway } = require('./giveawayHelper');
      setGiveaway(guild.id, { status: 'ended', channelId: null, messageId: null });
    } else if (def.key === 'level') {
      const { setLevelConfig } = require('./levelingHelper');
      setLevelConfig(guild.id, { levelUpChannel: null });
    } else if (def.key === 'sambungkata') {
      const { setGameConfig } = require('./gameHelper');
      setGameConfig(guild.id, { sambungKataChannelId: null });
    } else if (def.key === 'slot') {
      const { setGameConfig } = require('./gameHelper');
      setGameConfig(guild.id, { slotChannelId: null });
    }
  } catch (_) {}

  // Tandai fitur sebagai OFF agar tidak dimunculkan ulang saat auto-sync
  setFeatureDisabled(guild.id, def.key, true);

  return {
    success: true,
    feature: def,
    deletedNames,
  };
}

/**
 * MENYALAKAN (ON) satu fitur secara individual & memunculkan kembali channel + panelnya secara otomatis
 */
async function enableFeature(guild, featureKey) {
  const def = getFeatureDef(featureKey);
  if (!def) {
    return { success: false, error: `Fitur "${featureKey}" tidak dikenal.` };
  }

  // Hapus dari daftar disabled terlebih dahulu
  setFeatureDisabled(guild.id, def.key, false);

  let createdChannel = null;
  const cfg = getTemplateConfig(guild.id);
  const chCfg = { ...(cfg.channels || {}) };

  if (def.type === 'modular') {
    const res = await setupModularFeature(guild, def.key, null);
    createdChannel = res?.channel || null;
  } else if (def.key === 'welcome') {
    const category = await getOrCreateCategory(guild, 'NOTIFIKASI');
    createdChannel = await getOrCreateChannel(guild, {
      name: '👋︱welcome',
      type: ChannelType.GuildText,
      parentId: category.id,
    });
    chCfg.welcomeId = createdChannel.id;
    setTemplateConfig(guild.id, { channels: chCfg });
    const { setGuildConfig } = require('./welcomeHelper');
    setGuildConfig(guild.id, { welcomeChannel: createdChannel.id });
  } else if (def.key === 'hd') {
    const { setupHdChannel } = require('./imageHdHelper');
    const res = await setupHdChannel(guild);
    createdChannel = res?.channel || null;
    if (createdChannel) {
      chCfg.hdFotoId = createdChannel.id;
      setTemplateConfig(guild.id, { channels: chCfg });
    }
  } else if (def.key === 'giveaway') {
    const { setupGiveawayChannel } = require('./giveawayHelper');
    const res = await setupGiveawayChannel(guild, null);
    createdChannel = res?.channel || null;
    if (createdChannel) {
      chCfg.giveawayId = createdChannel.id;
      setTemplateConfig(guild.id, { channels: chCfg });
    }
  } else if (def.key === 'games') {
    const memberRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'member' && !r.managed) || {
      id: guild.roles.everyone.id,
    };
    const res = await setupMiniGamesTemplate(guild, { member: memberRole });
    chCfg.coinId = res.coinChannel.id;
    chCfg.numberId = res.numberChannel.id;
    chCfg.rpsId = res.rpsChannel.id;
    chCfg.slotId = res.slotChannel.id;
    chCfg.sambungKataId = res.sambungKataChannel.id;
    setTemplateConfig(guild.id, { channels: chCfg });
    createdChannel = res.coinChannel;
  } else if (def.key === 'level') {
    const category = await getOrCreateCategory(guild, 'NOTIFIKASI');
    createdChannel = await getOrCreateChannel(guild, {
      name: '📈︱level-up',
      type: ChannelType.GuildText,
      parentId: category.id,
    });
    chCfg.levelUpId = createdChannel.id;
    setTemplateConfig(guild.id, { channels: chCfg });
    const { setLevelConfig } = require('./levelingHelper');
    setLevelConfig(guild.id, { levelUpChannel: createdChannel.id });
  } else if (def.key === 'streamer') {
    const { ensureStreamerChannel } = require('./streamerHelper');
    createdChannel = await ensureStreamerChannel(guild);
    if (createdChannel) {
      chCfg.streamerId = createdChannel.id;
      setTemplateConfig(guild.id, { channels: chCfg });
    }
  } else if (def.key === 'ticket') {
    const category = await getOrCreateCategory(guild, 'OFFICIAL');
    createdChannel = await getOrCreateChannel(guild, {
      name: '📩︱ticket',
      type: ChannelType.GuildText,
      parentId: category.id,
    });
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Pusat Bantuan & Tiket Support')
      .setDescription('Klik tombol **Buat Tiket** di bawah ini untuk membuka ruang obrolan privat bersama tim Admin/Staff server.')
      .setFooter({ text: `${guild.name} • Sistem Tiket Otomatis` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_create_ticket').setLabel('Buat Tiket').setStyle(ButtonStyle.Primary)
    );
    await createdChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    chCfg.ticketId = createdChannel.id;
    setTemplateConfig(guild.id, { channels: chCfg });
    const { setGuildTicketConfig } = require('./ticketHelper');
    setGuildTicketConfig(guild.id, { panelChannelId: createdChannel.id });
  } else if (def.key === 'verif') {
    const category = await getOrCreateCategory(guild, 'Get Started');
    createdChannel = await getOrCreateChannel(guild, {
      name: '✅︱verifikasi',
      type: ChannelType.GuildText,
      parentId: category.id,
    });
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Verifikasi Akses Server • ${guild.name}`)
      .setDescription('Klik tombol **Verifikasi Sekarang** di bawah untuk mendapatkan akses penuh ke seluruh channel server.')
      .setFooter({ text: `${guild.name} • Verifikasi Otomatis` })
      .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('btn_do_verify').setLabel('Verifikasi Sekarang').setStyle(ButtonStyle.Success)
    );
    await createdChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
    chCfg.verifId = createdChannel.id;
    setTemplateConfig(guild.id, { channels: chCfg });
    const { setVerifConfig } = require('./verifHelper');
    setVerifConfig(guild.id, { verifChannelId: createdChannel.id });
  }

  return {
    success: true,
    feature: def,
    channel: createdChannel,
  };
}

/**
 * Mengambil status ON/OFF seluruh fitur di server
 */
async function getFeaturesOverview(guild) {
  const results = [];
  for (const def of FEATURE_CATALOG) {
    const disabled = isFeatureDisabled(guild.id, def.key);
    const channels = await findFeatureChannels(guild, def);
    const isOn = !disabled && channels.length > 0;
    results.push({
      key: def.key,
      label: def.label,
      isOn,
      channelCount: channels.length,
      firstChannelId: channels[0]?.id || null,
    });
  }
  return results;
}

module.exports = {
  FEATURE_CATALOG,
  getFeatureDef,
  isFeatureDisabled,
  setFeatureDisabled,
  disableFeature,
  enableFeature,
  getFeaturesOverview,
};
