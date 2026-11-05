const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const {
  getTemplateConfig,
  setTemplateConfig,
  getOrCreateChannel,
} = require('./templateSetupHelper');

/**
 * Helper untuk setup modular per fitur di server
 */

// Cari atau buat kategori wadah untuk fitur mandiri
async function getOrCreateModularCategory(guild, categoryName = 'FITUR FLYBOT') {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let category = channels.find(
    (c) => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes(categoryName.toLowerCase())
  );

  if (!category) {
    category = await guild.channels.create({
      name: categoryName,
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        },
      ],
      reason: `Auto-setup kategori ${categoryName}`,
    });
  }
  return category;
}

/**
 * Setup channel untuk fitur tertentu
 * @param {import('discord.js').Guild} guild 
 * @param {string} featureKey - 'pinterest' | 'removebg' | 'aigenerating' | 'aiprompt' | 'fanart' | 'games' | 'music'
 * @param {import('discord.js').TextChannel|null} targetChannel 
 */
async function setupModularFeature(guild, featureKey, targetChannel = null) {
  const currentCfg = getTemplateConfig(guild.id);
  const channelsCfg = { ...(currentCfg.channels || {}) };

  let channel = targetChannel;

  if (featureKey === 'pinterest') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'CINEMATOGRAPHY & DESAIN');
      channel = await getOrCreateChannel(guild, {
        name: '📌︱pinterest',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0xE60023)
        .setAuthor({ name: `${guild.name} • Galeri Pinterest`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Galeri Pencarian Gambar Pinterest')
        .setDescription(
          'Ketik kata kunci apa saja langsung di channel ini untuk mencari gambar & wallpaper estetik Pinterest secara otomatis!\n\n' +
          '• Contoh pencarian: `anime aesthetic`, `minimalist wallpaper`, `cyberpunk car`\n' +
          '• Navigasi: Gunakan tombol Sebelumnya / Berikutnya di bawah foto untuk melihat variasi gambar.\n' +
          '• Perintah manual: Anda juga dapat menggunakan `/pinterest [query]` di channel lain.'
        )
        .setFooter({ text: 'FlyBot Pinterest Search Explorer' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.pinterestId = channel.id;
  } else if (featureKey === 'removebg') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'CINEMATOGRAPHY & DESAIN');
      channel = await getOrCreateChannel(guild, {
        name: '✂️︱remove-bg',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `${guild.name} • Studio Remove-BG`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Studio Auto Remove-BG')
        .setDescription(
          'Kirim atau upload file foto langsung ke channel ini untuk memisahkan latar belakang secara instan menjadi transparan (PNG murni)!\n\n' +
          '• Format didukung: JPG, PNG, WEBP\n' +
          '• Otomatis: Tanpa perlu ketik perintah, cukup kirim gambar di sini.\n' +
          '• Perintah manual: Anda juga bisa menggunakan `/removebg` kapan saja.'
        )
        .setFooter({ text: 'FlyBot Instant Background Remover' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.removeBgId = channel.id;
  } else if (featureKey === 'hitamkan') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'CINEMATOGRAPHY & DESAIN');
      channel = await getOrCreateChannel(guild, {
        name: '⚫︱hitamkan',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setAuthor({ name: `${guild.name} • Studio Hitamkan`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Studio Auto-Hitamkan Foto')
        .setDescription(
          'Kirim atau upload file foto langsung ke channel ini untuk mengubah tone wajah/kulit menjadi hitam secara instan!\n\n' +
          '• Format didukung: JPG, PNG, WEBP\n' +
          '• Otomatis: Cukup upload atau kirim gambar wajah/orang di sini tanpa perlu mengetik perintah apa pun.\n' +
          '• Perintah manual: Anda juga dapat menggunakan `/hitamkan` di channel lain.'
        )
        .setFooter({ text: 'FlyBot Instant Melanin & Darken Studio' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.hitamkanId = channel.id;
  } else if (featureKey === 'aigenerating') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'AI INTELLIGENCE');
      channel = await getOrCreateChannel(guild, {
        name: '💻︱ai-generating',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `${guild.name} • AI Generating`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Ruang Obrolan & Generator AI')
        .setDescription(
          'Ketik pertanyaan, topik coding, tugas, atau ide kreatif langsung di channel ini untuk dijawab oleh FlyBot AI!\n\n' +
          '• Cukup ketik pesan di sini tanpa perintah apa pun.\n' +
          '• Atau gunakan perintah `/ai [prompt]` di mana saja.'
        )
        .setFooter({ text: 'FlyBot Neural Intelligence' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.aiGeneratingId = channel.id;
  } else if (featureKey === 'aiprompt') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'AI INTELLIGENCE');
      channel = await getOrCreateChannel(guild, {
        name: '💻︱ai-prompt',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({ name: `${guild.name} • AI Prompt Studio`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Studio Racik Prompt AI')
        .setDescription(
          'Kirimkan konsep, tema desain, atau deskripsi visual di channel ini. FlyBot AI akan meracik prompt bahasa Inggris berkualitas tinggi untuk Midjourney / Stable Diffusion.'
        )
        .setFooter({ text: 'FlyBot Prompt Engineering' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.aiPromptId = channel.id;
  } else if (featureKey === 'fanart') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'AI INTELLIGENCE');
      channel = await getOrCreateChannel(guild, {
        name: '💻︱ai-fanart',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setAuthor({ name: `${guild.name} • AI Fanart Concept`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Studio Konsep & Review Fanart AI')
        .setDescription(
          'Kirimkan nama karakter anime, game, atau referensi visual di sini untuk mendapatkan konsep fanart artistik dan ide ilustrasi.'
        )
        .setFooter({ text: 'FlyBot Fanart Studio' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.aiFanartId = channel.id;
  } else if (featureKey === 'music') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'MUSIC STUDIO');
      channel = await getOrCreateChannel(guild, {
        name: '🎵︱play-music',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setAuthor({ name: `${guild.name} • Music Studio`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Channel Khusus Pemutaran Musik')
        .setDescription(
          'Gunakan perintah `/play <judul/link>` di channel ini untuk memutar lagu berkualitas HD bersama di Voice Channel!\n\n' +
          '• Sumber didukung: Spotify, YouTube, SoundCloud\n' +
          '• Perintah pendukung: `/queue`, `/skip`, `/volume`, `/pause`, `/resume`, `/stop`'
        )
        .setFooter({ text: 'FlyBot HD Music Studio' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.playMusicId = channel.id;
  } else if (featureKey === 'stalk') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'COMMUNITY');
      channel = await getOrCreateChannel(guild, {
        name: '🔍︱stalk',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const guideEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `${guild.name} • Stalker Profil`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Channel Khusus Stalking Profil Akun')
        .setDescription(
          'Gunakan perintah `/stalk` di channel ini untuk melihat profil publik game dan media sosial secara instan & privat:\n\n' +
          '• Mobile Legends: `/stalk mlbb [user_id] [server_id]`\n' +
          '• Roblox: `/stalk roblox [username]`\n' +
          '• TikTok: `/stalk tiktok [username]`\n' +
          '• Discord: `/stalk discord [user_id]`\n' +
          '• GitHub: `/stalk github [username]`\n' +
          '• Twitter/X: `/stalk twitter [username]`\n' +
          '• Minecraft: `/stalk minecraft [username]`\n\n' +
          '*Respon bersifat privat (hanya kamu yang bisa melihat).*'
        )
        .setFooter({ text: 'FlyBot Multi Stalker' });

      await channel.send({ embeds: [guideEmbed] }).catch(() => {});
    }
    channelsCfg.stalkId = channel.id;
  } else if (featureKey === 'leave') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'NOTIFIKASI');
      channel = await getOrCreateChannel(guild, {
        name: '👋︱leave',
        type: ChannelType.GuildText,
        parentId: category.id,
      });
    }
    channelsCfg.leaveId = channel.id;
    const { setGuildConfig } = require('./welcomeHelper');
    setGuildConfig(guild.id, { leaveChannel: channel.id });
  } else if (featureKey === 'voicehub') {
    const category = await getOrCreateModularCategory(guild, 'VOICE LOUNGES');
    const voiceOverwrites = [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      },
      {
        id: guild.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
          PermissionFlagsBits.MoveMembers,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ];

    channel = await getOrCreateChannel(guild, {
      name: '➕︱Buat Room Voice',
      type: ChannelType.GuildVoice,
      parentId: category.id,
      permissionOverwrites: voiceOverwrites,
    });

    channelsCfg.hubVoiceId = channel.id;
    const { setTempVoiceConfig } = require('./tempVoiceHelper');
    setTempVoiceConfig(guild.id, channel.id, category.id);
  } else if (featureKey === 'sosmed') {
    const { setupSosmedConverter } = require('./templateSetupHelper');
    const role = guild.roles.cache.find(r => r.name.toLowerCase() === 'member' && !r.managed) || { id: guild.roles.everyone.id };
    const res = await setupSosmedConverter(guild, { member: role });
    channelsCfg.tiktokConvertId = res.tiktokConvert.id;
    channelsCfg.instagramConvertId = res.instagramConvert.id;
    channelsCfg.facebookConvertId = res.facebookConvert.id;
    channelsCfg.youtubeConvertId = res.youtubeConvert.id;
    channel = res.tiktokConvert;
  } else if (featureKey === 'sambungkata') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'MINI GAMES');
      channel = await getOrCreateChannel(guild, {
        name: '🔤︱sambung-kata',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const { getSambungKataPanelEmbed, getSambungKataActionRow } = require('./sambungKataHelper');
      await channel.send({
        embeds: [getSambungKataPanelEmbed(guild)],
        components: [getSambungKataActionRow()],
      }).catch(() => {});
    }
    channelsCfg.sambungKataId = channel.id;
    const { setGameConfig } = require('./gameHelper');
    setGameConfig(guild.id, { sambungKataChannelId: channel.id });
  } else if (featureKey === 'slot') {
    if (!channel) {
      const category = await getOrCreateModularCategory(guild, 'MINI GAMES');
      channel = await getOrCreateChannel(guild, {
        name: '🎰︱gacha-slot',
        type: ChannelType.GuildText,
        parentId: category.id,
      });

      const { getSlotChannelRow } = require('./gameHelper');
      const slotEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({ name: `${guild.name} • Arena Mini Games`, iconURL: guild.client.user.displayAvatarURL() })
        .setTitle('Arena Mesin Slot Buah 777')
        .setDescription(
          'Selamat datang di Arena Mesin Slot Buah.\n' +
          'Gunakan saldo koin hasil chat, klaim /daily, dan kemenangan game untuk memutar mesin slot buah dan raih JACKPOT 777 hingga 15x lipat!\n\n' +
          'Tabel Pembayaran Slot Buah:\n' +
          '• 3x 7️⃣ -- JACKPOT 777 15x Taruhan (+100 XP)\n' +
          '• 3x 🍒 -- Triple Ceri 10x Taruhan (+75 XP)\n' +
          '• 3x 🍇 -- Triple Anggur 7x Taruhan (+60 XP)\n' +
          '• 3x 🍉 -- Triple Semangka 5x Taruhan (+50 XP)\n' +
          '• 3x 🍊 -- Triple Jeruk 4x Taruhan (+40 XP)\n' +
          '• 3x 🍋 / 🍓 -- Triple Lemon/Stroberi 3x Taruhan (+30 XP)\n' +
          '• 2 Buah Kembar -- Match Dua Buah 1.5x Taruhan (+15 XP)\n' +
          '• Tidak Cocok -- Zonk (+5 XP Partisipasi)\n\n' +
          'Klik salah satu tombol taruhan di bawah atau ketik /slot untuk langsung memutar mesin slot!'
        )
        .setFooter({ text: 'FlyBot Gacha Slot 777' });

      await channel.send({
        embeds: [slotEmbed],
        components: [getSlotChannelRow()],
      }).catch(() => {});
    }
    channelsCfg.slotId = channel.id;
    const { setGameConfig } = require('./gameHelper');
    setGameConfig(guild.id, { slotChannelId: channel.id });
  }

  setTemplateConfig(guild.id, { channels: channelsCfg });
  return { success: true, channel };
}

/**
 * Menghapus konfigurasi channel fitur tertentu
 */
function removeModularFeature(guildId, featureKey) {
  const currentCfg = getTemplateConfig(guildId);
  const channelsCfg = { ...(currentCfg.channels || {}) };

  const keyMap = {
    pinterest: 'pinterestId',
    removebg: 'removeBgId',
    hitamkan: 'hitamkanId',
    aigenerating: 'aiGeneratingId',
    aiprompt: 'aiPromptId',
    fanart: 'aiFanartId',
    music: 'playMusicId',
    stalk: 'stalkId',
    leave: 'leaveId',
    voicehub: 'hubVoiceId',
    sambungkata: 'sambungKataId',
    slot: 'slotId',
  };

  const prop = keyMap[featureKey];
  if (prop && channelsCfg[prop]) {
    delete channelsCfg[prop];
    setTemplateConfig(guildId, { channels: channelsCfg });
    return true;
  }
  return false;
}

/**
 * Mengecek apakah suatu fitur sudah diaktifkan di server (lewat config ID atau nama channel)
 */
function isFeatureConfigured(guild, featureKey) {
  if (!guild) return false;
  const cfg = getTemplateConfig(guild.id);
  const chCfg = cfg?.channels || {};

  const nameKeywords = {
    pinterest: ['pinterest'],
    removebg: ['remove-bg', 'removebg'],
    hitamkan: ['hitamkan'],
    aigenerating: ['ai-generating', 'aigenerating'],
    aiprompt: ['ai-prompt', 'aiprompt'],
    fanart: ['ai-fanart', 'fanart'],
    music: ['play-music', 'playmusic', 'musik'],
    stalk: ['stalk'],
    leave: ['leave', 'left', 'goodbye', 'sampai-jumpa', 'keluar'],
    voicehub: ['buat-room-voice', 'buat room voice', 'room-voice'],
    sambungkata: ['sambung-kata', 'sambungkata'],
    slot: ['gacha-slot', 'slot'],
    sosmed: ['tiktok-convert', 'instagram-convert', 'facebook-convert', 'youtube-convert'],
  };

  const idMap = {
    pinterest: chCfg.pinterestId,
    removebg: chCfg.removeBgId,
    hitamkan: chCfg.hitamkanId,
    aigenerating: chCfg.aiGeneratingId,
    aiprompt: chCfg.aiPromptId,
    fanart: chCfg.aiFanartId,
    music: chCfg.playMusicId,
    stalk: chCfg.stalkId,
    leave: chCfg.leaveId,
    voicehub: chCfg.hubVoiceId,
    sambungkata: chCfg.sambungKataId,
    slot: chCfg.slotId,
    sosmed: chCfg.tiktokConvertId || chCfg.instagramConvertId,
  };

  const configuredId = idMap[featureKey];
  if (configuredId && guild.channels.cache.has(configuredId)) {
    return true;
  }

  const keywords = nameKeywords[featureKey] || [];
  return guild.channels.cache.some((c) => {
    const clean = c.name.toLowerCase();
    return keywords.some((kw) => clean.includes(kw));
  });
}

/**
 * Mendapatkan channel yang aktif untuk fitur tertentu
 */
function getActiveFeatureChannel(guild, featureKey) {
  if (!guild) return null;
  const cfg = getTemplateConfig(guild.id);
  const chCfg = cfg?.channels || {};

  const idMap = {
    pinterest: chCfg.pinterestId,
    removebg: chCfg.removeBgId,
    hitamkan: chCfg.hitamkanId,
    aigenerating: chCfg.aiGeneratingId,
    aiprompt: chCfg.aiPromptId,
    fanart: chCfg.aiFanartId,
    music: chCfg.playMusicId,
    stalk: chCfg.stalkId,
    leave: chCfg.leaveId,
    voicehub: chCfg.hubVoiceId,
    sambungkata: chCfg.sambungKataId,
    slot: chCfg.slotId,
    sosmed: chCfg.tiktokConvertId,
  };

  const configuredId = idMap[featureKey];
  if (configuredId) {
    const ch = guild.channels.cache.get(configuredId);
    if (ch) return ch;
  }

  const nameKeywords = {
    pinterest: ['pinterest'],
    removebg: ['remove-bg', 'removebg'],
    hitamkan: ['hitamkan'],
    aigenerating: ['ai-generating', 'aigenerating'],
    aiprompt: ['ai-prompt', 'aiprompt'],
    fanart: ['ai-fanart', 'fanart'],
    music: ['play-music', 'playmusic', 'musik'],
    stalk: ['stalk'],
    leave: ['leave', 'left', 'goodbye', 'sampai-jumpa', 'keluar'],
    voicehub: ['buat-room-voice', 'buat room voice', 'room-voice'],
    sambungkata: ['sambung-kata', 'sambungkata'],
    slot: ['gacha-slot', 'slot'],
    sosmed: ['tiktok-convert', 'instagram-convert', 'facebook-convert', 'youtube-convert'],
  };

  const keywords = nameKeywords[featureKey] || [];
  return guild.channels.cache.find((c) => {
    const clean = c.name.toLowerCase();
    return keywords.some((kw) => clean.includes(kw));
  }) || null;
}

module.exports = {
  setupModularFeature,
  removeModularFeature,
  isFeatureConfigured,
  getActiveFeatureChannel,
};

