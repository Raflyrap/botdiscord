const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { setGuildConfig } = require('./welcomeHelper');
const { setLevelConfig } = require('./levelingHelper');
const { setTempVoiceConfig } = require('./tempVoiceHelper');
const { setVerifConfig } = require('./verifHelper');
const { setGameConfig } = require('./gameHelper');
const { setGuildTicketConfig } = require('./ticketHelper');

const CONFIG_FILE = path.join(__dirname, 'serverTemplateConfig.json');

function loadTemplateConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({}, null, 2), 'utf-8');
      return {};
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8') || '{}');
  } catch {
    return {};
  }
}

function saveTemplateConfig(data) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saat menyimpan serverTemplateConfig.json:', err.message);
  }
}

function getTemplateConfig(guildId) {
  const all = loadTemplateConfig();
  return all[guildId] || {};
}

function setTemplateConfig(guildId, updates) {
  const all = loadTemplateConfig();
  all[guildId] = { ...(all[guildId] || {}), ...updates };
  saveTemplateConfig(all);
  return all[guildId];
}

// Helper untuk mencari atau membuat role
async function getOrCreateRole(guild, { name, color, hoist = true, mentionable = false }) {
  let role = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === name.toLowerCase() && !r.managed
  );
  if (!role) {
    try {
      role = await guild.roles.create({
        name,
        color,
        hoist,
        mentionable,
        reason: `Auto-setup role ${name}`,
      });
    } catch (err) {
      console.warn(`Gagal membuat role ${name}:`, err.message);
      role = guild.roles.cache.find((r) => r.id !== guild.id && !r.managed);
    }
  }
  return role;
}

// Helper untuk mencari atau membuat channel
async function getOrCreateChannel(guild, { name, type, parentId, permissionOverwrites, position }) {
  const channels = await guild.channels.fetch().catch(() => guild.channels.cache);
  let channel = channels.find((c) => {
    if (type === ChannelType.GuildCategory) {
      return c.type === ChannelType.GuildCategory && (c.name === name || c.name.toLowerCase().includes(name.toLowerCase().replace(/─/g, '').trim()));
    }
    const cleanSearch = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanActual = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return c.type === type && (c.name === name || (cleanActual && cleanActual === cleanSearch) || cleanActual.includes(cleanSearch));
  });

  if (!channel) {
    channel = await guild.channels.create({
      name,
      type,
      parent: parentId || undefined,
      permissionOverwrites: permissionOverwrites || undefined,
      position: position !== undefined ? position : undefined,
      reason: `Auto-setup channel ${name}`,
    });
  } else {
    // Update parent dan permissions jika diperlukan
    if (parentId && channel.parentId !== parentId) {
      await channel.setParent(parentId).catch(() => {});
    }
    if (permissionOverwrites) {
      await channel.permissionOverwrites.set(permissionOverwrites).catch(() => {});
    }
  }

  return channel;
}

/**
 * Setup 1: Get Started
 * Rules, Start Here (Verif), Select Roles (Gender)
 */
async function setupGetStarted(guild, roles) {
  const everyoneOverwrites = [
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Get Started───────',
    type: ChannelType.GuildCategory,
    position: 0,
    permissionOverwrites: everyoneOverwrites,
  });

  // 1. Channel Rules
  const rulesChannel = await getOrCreateChannel(guild, {
    name: '📜︱rules',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: roles.member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: guild.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
      },
    ],
  });

  // Kirim embed Peraturan Resmi Bahasa Indonesia jika belum ada
  const rulesMsgs = await rulesChannel.messages.fetch({ limit: 5 }).catch(() => null);
  if (!rulesMsgs || rulesMsgs.size === 0) {
    const rulesEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `${guild.name} • Peraturan Resmi`, iconURL: guild.iconURL() || undefined })
      .setTitle('📜 TATA TERTIB & PERATURAN SERVER')
      .setDescription(
        `Selamat datang di **${guild.name}**!\n` +
        `Demi kenyamanan, keamanan, dan keharmonisan bersama seluruh anggota komunitas, mohon patuhi peraturan berikut:\n\n` +
        `**1. SALING MENGHARGAI & SOPAN SANTUN**\n` +
        `> Gunakan bahasa yang sopan dan hargai sesama anggota tanpa memandang suku, agama, ras, dan latar belakang. Dilarang keras melakukan ujaran kebencian (*hate speech*), pelecehan (*harassment*), perundungan (*bullying*), maupun provokasi.\n\n` +
        `**2. DILARANG SPAM & FLOODING**\n` +
        `> Dilarang mengirim pesan berulang-ulang, spam stiker/emoji, tag/mention massal tanpa izin, serta membuat kebisingan (*ear-rape*) pada voice channel.\n\n` +
        `**3. KONTEN AMAN & NYAMAN (SFW ONLY)**\n` +
        `> Dilarang membagikan konten berbau pornografi, NSFW, kekerasan grafis (*gore*), maupun konten sensitif lainnya di seluruh channel server.\n\n` +
        `**4. DILARANG PROMOSI ILEGAL (NO SELF-PROMO)**\n` +
        `> Dilarang membagikan link server Discord lain, jualan/promosi tanpa izin pengelola, atau mengirim pesan promosi melalui Direct Message (DM) ke anggota server.\n\n` +
        `**5. KEAMANAN AKUN & PRIVASI**\n` +
        `> Jaga privasi diri sendiri dan orang lain (dilarang *doxxing*). Waspadai link *phishing* atau penipuan. Bot & Staff tidak akan pernah meminta password akun Anda.\n\n` +
        `**6. GUNAKAN CHANNEL SESUAI FUNGSI**\n` +
        `> Kirim pesan dan media di channel yang sesuai (misal: meme di #meme, foto di #fotografi, obrolan santai di #ngobrol).\n\n` +
        `**7. KEPUTUSAN STAFF & MODERATOR**\n` +
        `> Keputusan Staff & Moderator bersifat objektif demi ketertiban server. Jika mendapati pelanggaran, laporkan melalui channel <#report> atau tiket bantuan.\n\n` +
        `*Dengan bergabung dan berinteraksi di server ini, Anda dianggap telah membaca, memahami, dan menyetujui seluruh tata tertib yang berlaku.*`
      )
      .setFooter({ text: `${guild.name} • Safe & Friendly Community` })
      .setTimestamp();

    const agreeBtn = new ButtonBuilder()
      .setCustomId('rule_agree_btn')
      .setLabel('Saya Menyetujui Peraturan')
      .setStyle(ButtonStyle.Success);

    const agreeRow = new ActionRowBuilder().addComponents(agreeBtn);
    await rulesChannel.send({ embeds: [rulesEmbed], components: [agreeRow] }).catch(() => {});
  }

  // 2. Channel Start Here (Verifikasi)
  const startHereChannel = await getOrCreateChannel(guild, {
    name: '🌟︱start-here',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: roles.member.id,
        deny: [PermissionFlagsBits.ViewChannel], // Sembunyikan setelah member verif lengkap
      },
      {
        id: guild.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
      },
    ],
  });

  // Kirim panel verifikasi di start-here jika belum ada
  const startHereMsgs = await startHereChannel.messages.fetch({ limit: 5 }).catch(() => null);
  if (!startHereMsgs || startHereMsgs.size === 0) {
    const verifEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
      .setTitle(`Verifikasi Akses Server  •  ${guild.name}`)
      .setDescription(
        `Selamat datang di **${guild.name}**!\n\n` +
        `Seluruh channel di server ini dilindungi untuk menjaga kenyamanan komunitas.\n` +
        `Untuk membuka seluruh channel server, ikuti 2 langkah mudah:\n\n` +
        `1. Klik tombol hijau **Verifikasi Sekarang** di bawah ini\n` +
        `2. Buka channel select-roles lalu pilih role gender kamu (👦 Laki-laki / 👧 Perempuan)\n\n` +
        `*Setelah kedua langkah selesai, seluruh kategori dan channel akan otomatis terbuka penuh!*`
      )
      .addFields(
        { name: 'Role Diterima', value: `<@&${roles.member.id}>`, inline: true },
        { name: 'Sistem', value: 'Anti-Bot & Verifikasi 1-Klik', inline: true },
      )
      .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
      .setFooter({ text: `${guild.name} • Verifikasi Otomatis FlyBot` })
      .setTimestamp();

    const verifyBtn = new ButtonBuilder()
      .setCustomId('btn_do_verify')
      .setLabel('Verifikasi Sekarang')
      .setStyle(ButtonStyle.Success);

    const verifRow = new ActionRowBuilder().addComponents(verifyBtn);
    await startHereChannel.send({ embeds: [verifEmbed], components: [verifRow] }).catch(() => {});
  }

  // 3. Channel Select Roles (Gender Selection)
  const selectRolesChannel = await getOrCreateChannel(guild, {
    name: '👑︱select-roles',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: roles.member.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
        deny: [PermissionFlagsBits.SendMessages],
      },
      {
        id: guild.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks],
      },
    ],
  });

  // Kirim panel select roles jika belum ada
  const roleMsgs = await selectRolesChannel.messages.fetch({ limit: 5 }).catch(() => null);
  if (!roleMsgs || roleMsgs.size === 0) {
    const roleEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `${guild.name} • Identitas Server`, iconURL: guild.iconURL() || undefined })
      .setTitle('Pilih Role Gender Kamu')
      .setDescription(
        `Silakan pilih salah satu role gender di bawah ini untuk melengkapi identitas profil kamu di server:\n\n` +
        `• 👦 **Laki-laki** — <@&${roles.male.id}>\n` +
        `• 👧 **Perempuan** — <@&${roles.female.id}>\n\n` +
        `*Catatan: Kamu hanya dapat memilih salah satu role gender. Kamu dapat mengubah pilihanmu sewaktu-waktu dengan menekan tombol kembali.*`
      )
      .setFooter({ text: 'Klik salah satu tombol di bawah untuk memilih' })
      .setTimestamp();

    const maleBtn = new ButtonBuilder()
      .setCustomId('role_gender_male')
      .setLabel('👦 Laki-laki')
      .setStyle(ButtonStyle.Primary);

    const femaleBtn = new ButtonBuilder()
      .setCustomId('role_gender_female')
      .setLabel('👧 Perempuan')
      .setStyle(ButtonStyle.Secondary);

    const genderRow = new ActionRowBuilder().addComponents(maleBtn, femaleBtn);
    await selectRolesChannel.send({ embeds: [roleEmbed], components: [genderRow] }).catch(() => {});
  }

  // Simpan konfigurasi verifikasi
  setVerifConfig(guild.id, {
    verifiedRoleId: roles.member.id,
    roleId: roles.member.id,
    channelId: startHereChannel.id,
    enabled: true,
  });

  return {
    category,
    rulesChannel,
    startHereChannel,
    selectRolesChannel,
  };
}

/**
 * Setup 2: Official
 * Announcement, Official Event, Social Media, Help Center (Ticket)
 */
async function setupOfficial(guild, roles) {
  const memberOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Official───────',
    type: ChannelType.GuildCategory,
    position: 1,
    permissionOverwrites: memberOverwrites,
  });

  const announcement = await getOrCreateChannel(guild, {
    name: '📢︱announcement',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const officialEvent = await getOrCreateChannel(guild, {
    name: '✨︱official-event',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const socialMedia = await getOrCreateChannel(guild, {
    name: '🎉︱social-media',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const helpCenter = await getOrCreateChannel(guild, {
    name: '❓︱help-center',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Kirim panel bantuan & tiket di help-center jika belum ada
  const helpMsgs = await helpCenter.messages.fetch({ limit: 5 }).catch(() => null);
  if (!helpMsgs || helpMsgs.size === 0) {
    const helpEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `${guild.name} • Help Center`, iconURL: guild.iconURL() || undefined })
      .setTitle('Pusat Bantuan & Layanan Server')
      .setDescription(
        `Butuh bantuan teknis, ingin menyampaikan laporan, konsultasi, atau berdiskusi privat dengan Admin & Owner?\n\n` +
        `Klik tombol **Buat Tiket** di bawah untuk membuka ruang percakapan privat baru yang hanya bisa dilihat oleh kamu dan tim Staff/Admin.`
      )
      .addFields(
        { name: 'Privasi', value: 'Khusus Kamu & Staff', inline: true },
        { name: 'Layanan', value: 'Customer Service 24/7', inline: true },
      )
      .setFooter({ text: `${guild.name} • Sistem Tiket Bantuan` })
      .setTimestamp();

    const ticketBtn = new ButtonBuilder()
      .setCustomId('btn_create_ticket')
      .setLabel('Buat Tiket')
      .setStyle(ButtonStyle.Primary);

    const ticketRow = new ActionRowBuilder().addComponents(ticketBtn);
    const sentMsg = await helpCenter.send({ embeds: [helpEmbed], components: [ticketRow] }).catch(() => null);

    if (sentMsg) {
      setGuildTicketConfig(guild.id, {
        panelChannelId: helpCenter.id,
        categoryId: category.id,
        messageId: sentMsg.id,
        enabled: true,
      });
    }
  }

  // Kirim pesan sambutan resmi di announcement jika masih kosong
  const annMsgs = await announcement.messages.fetch({ limit: 5 }).catch(() => null);
  if (!annMsgs || annMsgs.size === 0) {
    const annEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Papan Pengumuman Resmi • ${guild.name}`)
      .setDescription(
        `Selamat datang di channel pengumuman resmi **${guild.name}**!\n\n` +
        `Seluruh pembaruan, informasi penting, dan pengumuman komunitas akan disiarkan di channel ini.\n` +
        `Pastikan untuk menyalakan notifikasi channel ini agar tidak ketinggalan berita terbaru!`
      )
      .setTimestamp();
    await announcement.send({ embeds: [annEmbed] }).catch(() => {});
  }

  return { category, announcement, officialEvent, socialMedia, helpCenter };
}

/**
 * Setup 3: Notify
 * Welcome & Leave
 */
async function setupNotify(guild, roles) {
  const readOnlyOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Notify───────',
    type: ChannelType.GuildCategory,
    position: 2,
    permissionOverwrites: readOnlyOverwrites,
  });

  const welcome = await getOrCreateChannel(guild, {
    name: '👋︱welcome',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: readOnlyOverwrites,
  });

  const leave = await getOrCreateChannel(guild, {
    name: '🚪︱leave',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: readOnlyOverwrites,
  });

  // Sambungkan ke welcomeHelper
  setGuildConfig(guild.id, {
    welcomeChannel: welcome.id,
    leaveChannel: leave.id,
  });

  return { category, welcome, leave };
}

/**
 * Setup 4: Community
 * Newcomer chat, Ngobrol, Ngobrol 2, Media, Levels, Achievements, Report
 */
async function setupCommunity(guild, roles) {
  const standardOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const botOnlyPostOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Community───────',
    type: ChannelType.GuildCategory,
    position: 3,
    permissionOverwrites: standardOverwrites,
  });

  const newcomerChat = await getOrCreateChannel(guild, {
    name: '👋︱newcomer-chat',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  const ngobrol = await getOrCreateChannel(guild, {
    name: '💭︱ngobrol',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  const ngobrol2 = await getOrCreateChannel(guild, {
    name: '💭︱ngobrol-2',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  const media = await getOrCreateChannel(guild, {
    name: '📷︱media',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  const levels = await getOrCreateChannel(guild, {
    name: '🔝︱levels',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: botOnlyPostOverwrites,
  });

  const achievements = await getOrCreateChannel(guild, {
    name: '🏆︱achievements',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: botOnlyPostOverwrites,
  });

  const report = await getOrCreateChannel(guild, {
    name: '🚨︱report',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  // Sambungkan channel notifikasi leveling & achievements
  setLevelConfig(guild.id, {
    levelUpChannel: levels.id,
    achievementChannel: achievements.id,
  });

  return {
    category,
    newcomerChat,
    ngobrol,
    ngobrol2,
    media,
    levels,
    achievements,
    report,
  };
}

/**
 * Setup 5: Cinematography
 * Fotografi, Videografi
 */
async function setupCinematography(guild, roles) {
  const memberOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Cinematography───────',
    type: ChannelType.GuildCategory,
    position: 4,
    permissionOverwrites: memberOverwrites,
  });

  const fotografi = await getOrCreateChannel(guild, {
    name: '📷︱fotografi',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const videografi = await getOrCreateChannel(guild, {
    name: '🎥︱videografi',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  return { category, fotografi, videografi };
}

/**
 * Setup 6: Entertainment
 * Meme, Fanart, AI Fanart, AI Generating, AI Prompt, Showcase Gaming Setup
 */
async function setupEntertainment(guild, roles) {
  const memberOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.AttachFiles,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.AttachFiles,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Entertainment───────',
    type: ChannelType.GuildCategory,
    position: 5,
    permissionOverwrites: memberOverwrites,
  });

  const meme = await getOrCreateChannel(guild, {
    name: '🗿︱meme',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const fanart = await getOrCreateChannel(guild, {
    name: '🎨︱fanart',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const aiFanart = await getOrCreateChannel(guild, {
    name: '💻︱ai-fanart',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const aiGenerating = await getOrCreateChannel(guild, {
    name: '💻︱ai-generating',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const aiPrompt = await getOrCreateChannel(guild, {
    name: '💻︱ai-prompt',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const gamingSetup = await getOrCreateChannel(guild, {
    name: '🎮︱showcase-gaming-setup',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  return { category, meme, fanart, aiFanart, aiGenerating, aiPrompt, gamingSetup };
}

/**
 * Setup 7: Mini Games
 * Tebak Koin, Tebak Angka, Suit Jepang
 */
async function setupMiniGamesTemplate(guild, roles) {
  const memberOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Mini Games───────',
    type: ChannelType.GuildCategory,
    position: 6,
    permissionOverwrites: memberOverwrites,
  });

  const coinChannel = await getOrCreateChannel(guild, {
    name: '🪙︱tebak-koin',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const numberChannel = await getOrCreateChannel(guild, {
    name: '🔢︱tebak-angka',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const rpsChannel = await getOrCreateChannel(guild, {
    name: '✌️︱suit-jepang',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Kirim panel game jika belum ada
  const msgs = await coinChannel.messages.fetch({ limit: 5 }).catch(() => null);
  if (!msgs || msgs.size === 0) {
    const coinEmbed = new EmbedBuilder()
      .setColor(0xf1c40f)
      .setTitle('🪙 Tebak Koin (Gambar / Angka)')
      .setDescription(
        'Tebak sisi koin yang akan keluar saat bot melempar koin virtual!\n\n' +
        '• **Gambar (Heads)**\n' +
        '• **Angka (Tails)**\n\n' +
        'Setiap tebakan benar akan memberikan koin dan XP ke akun kamu.'
      );
    const coinRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('game_coin_heads').setLabel('Gambar (Heads)').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('game_coin_tails').setLabel('Angka (Tails)').setStyle(ButtonStyle.Secondary)
    );
    await coinChannel.send({ embeds: [coinEmbed], components: [coinRow] }).catch(() => {});
  }

  setGameConfig(guild.id, {
    categoryId: category.id,
    coinChannelId: coinChannel.id,
    numberChannelId: numberChannel.id,
    rpsChannelId: rpsChannel.id,
    enabled: true,
  });

  return { category, coinChannel, numberChannel, rpsChannel };
}

/**
 * Setup 8: Voice Lounges (At the Bottom!)
 * Buat Room Voice (Trigger), Production Room, General Voice, Music Lounge, Companion Chat
 */
async function setupVoiceLounges(guild, roles) {
  const voiceOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel],
    },
    {
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
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

  const category = await getOrCreateChannel(guild, {
    name: '───────Voice Lounges───────',
    type: ChannelType.GuildCategory,
    position: 7, // Paling bawah
    permissionOverwrites: voiceOverwrites,
  });

  // 1. Channel Trigger Buat Room Voice
  const hubChannel = await getOrCreateChannel(guild, {
    name: '➕︱Buat Room Voice',
    type: ChannelType.GuildVoice,
    parentId: category.id,
    permissionOverwrites: voiceOverwrites,
  });

  // 2. Production Room
  const productionRoom = await getOrCreateChannel(guild, {
    name: '🚀︱Production Room',
    type: ChannelType.GuildVoice,
    parentId: category.id,
    permissionOverwrites: voiceOverwrites,
  });

  // 3. General Voice
  const generalVoice = await getOrCreateChannel(guild, {
    name: '🔊︱General Voice',
    type: ChannelType.GuildVoice,
    parentId: category.id,
    permissionOverwrites: voiceOverwrites,
  });

  // 4. Music Lounge
  const musicLounge = await getOrCreateChannel(guild, {
    name: '🎵︱Music Lounge',
    type: ChannelType.GuildVoice,
    parentId: category.id,
    permissionOverwrites: voiceOverwrites,
  });

  // 5. Companion Text
  const voiceChat = await getOrCreateChannel(guild, {
    name: '💬︱voice-chat',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: roles.member.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: guild.client.user.id,
        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
      },
    ],
  });

  // Sambungkan ke tempVoiceHelper
  setTempVoiceConfig(guild.id, hubChannel.id, category.id);

  return { category, hubChannel, productionRoom, generalVoice, musicLounge, voiceChat };
}

/**
 * MASTER SETUP: Bangun Seluruh Template Lengkap Sesuai Gambar
 */
async function setupFullTemplate(guild) {
  // 1. Inisialisasi Role
  const memberRole = await getOrCreateRole(guild, {
    name: 'Member',
    color: 0x57f287,
    hoist: true,
  });

  const maleRole = await getOrCreateRole(guild, {
    name: 'Laki-laki',
    color: 0x3498db,
    hoist: true,
  });

  const femaleRole = await getOrCreateRole(guild, {
    name: 'Perempuan',
    color: 0xe91e63,
    hoist: true,
  });

  const verifiedRole = await getOrCreateRole(guild, {
    name: 'Terverifikasi',
    color: 0x95a5a6,
    hoist: false,
  });

  const roles = {
    member: memberRole,
    male: maleRole,
    female: femaleRole,
    verified: verifiedRole,
  };

  // 2. Setup Kategori 1: Get Started
  const getStarted = await setupGetStarted(guild, roles);

  // 3. Setup Kategori 2: Official
  const official = await setupOfficial(guild, roles);

  // 4. Setup Kategori 3: Notify (Welcome & Leave)
  const notify = await setupNotify(guild, roles);

  // 5. Setup Kategori 4: Community (Termasuk Achievements)
  const community = await setupCommunity(guild, roles);

  // 6. Setup Kategori 5: Cinematography
  const cinematography = await setupCinematography(guild, roles);

  // 7. Setup Kategori 6: Entertainment
  const entertainment = await setupEntertainment(guild, roles);

  // 8. Setup Kategori 7: Mini Games
  const miniGames = await setupMiniGamesTemplate(guild, roles);

  // 9. Setup Kategori 8: Voice Lounges (Paling Bawah)
  const voiceLounges = await setupVoiceLounges(guild, roles);

  // 10. Simpan konfigurasi server
  setTemplateConfig(guild.id, {
    roles: {
      memberId: memberRole.id,
      maleId: maleRole.id,
      femaleId: femaleRole.id,
      verifiedId: verifiedRole.id,
    },
    channels: {
      rulesId: getStarted.rulesChannel.id,
      startHereId: getStarted.startHereChannel.id,
      selectRolesId: getStarted.selectRolesChannel.id,
      welcomeId: notify.welcome.id,
      leaveId: notify.leave.id,
      levelsId: community.levels.id,
      achievementsId: community.achievements.id,
      hubVoiceId: voiceLounges.hubChannel.id,
    },
    categories: {
      getStartedId: getStarted.category.id,
      officialId: official.category.id,
      notifyId: notify.category.id,
      communityId: community.category.id,
      cinematographyId: cinematography.category.id,
      entertainmentId: entertainment.category.id,
      miniGamesId: miniGames.category.id,
      voiceLoungesId: voiceLounges.category.id,
    },
    updatedAt: Date.now(),
  });

  return {
    roles,
    getStarted,
    official,
    notify,
    community,
    cinematography,
    entertainment,
    miniGames,
    voiceLounges,
  };
}

/**
 * Handler Pemilihan Role Gender (Laki-laki / Perempuan)
 */
async function handleGenderRoleSelection(interaction, chosenGender) {
  const guild = interaction.guild;
  const member = interaction.member;

  const maleRole = await getOrCreateRole(guild, { name: 'Laki-laki', color: 0x3498db });
  const femaleRole = await getOrCreateRole(guild, { name: 'Perempuan', color: 0xe91e63 });
  const memberRole = await getOrCreateRole(guild, { name: 'Member', color: 0x57f287 });
  const verifiedRole = await getOrCreateRole(guild, { name: 'Terverifikasi', color: 0x95a5a6, hoist: false });

  const targetRole = chosenGender === 'male' ? maleRole : femaleRole;
  const oppositeRole = chosenGender === 'male' ? femaleRole : maleRole;

  // Cabut role gender yang berlawanan jika sudah punya (hanya boleh pilih salah 1)
  if (member.roles.cache.has(oppositeRole.id)) {
    await member.roles.remove(oppositeRole).catch(console.error);
  }

  // Pasang role yang dipilih
  await member.roles.add(targetRole).catch(console.error);

  // Cek apakah member sudah terverifikasi (memiliki role Terverifikasi atau Member)
  const isVerified = member.roles.cache.has(verifiedRole.id) || member.roles.cache.has(memberRole.id);

  const cfg = getTemplateConfig(guild.id);
  const startHereMention = cfg?.channels?.startHereId ? `<#${cfg.channels.startHereId}>` : 'channel verifikasi (#start-here)';

  if (isVerified) {
    // Jika sudah verifikasi, pastikan role Member aktif (buka seluruh channel server)
    if (!member.roles.cache.has(memberRole.id)) {
      await member.roles.add(memberRole).catch(console.error);
    }

    return interaction.reply({
      content: `✅ Role **${targetRole.name}** berhasil dipasang!\n🎉 Kamu sudah terverifikasi, sehingga **seluruh kategori dan channel server sekarang telah terbuka penuh**! Selamat berinteraksi! 🚀`,
      flags: 64, // Ephemeral
    });
  } else {
    return interaction.reply({
      content: `✅ Role **${targetRole.name}** berhasil dipasang!\n⚠️ **Tinggal 1 langkah lagi**: Silakan tekan tombol **Verifikasi Sekarang** di ${startHereMention} untuk membuka seluruh kategori dan channel server!`,
      flags: 64, // Ephemeral
    });
  }
}

/**
 * Handler Tombol Verifikasi (btn_do_verify di start-here)
 */
async function handleVerificationButton(interaction) {
  const guild = interaction.guild;
  const member = interaction.member;

  const maleRole = await getOrCreateRole(guild, { name: 'Laki-laki', color: 0x3498db });
  const femaleRole = await getOrCreateRole(guild, { name: 'Perempuan', color: 0xe91e63 });
  const memberRole = await getOrCreateRole(guild, { name: 'Member', color: 0x57f287 });
  const verifiedRole = await getOrCreateRole(guild, { name: 'Terverifikasi', color: 0x95a5a6, hoist: false });

  // Cek apakah member sudah memilih role gender
  const hasGenderRole = member.roles.cache.has(maleRole.id) || member.roles.cache.has(femaleRole.id);

  const cfg = getTemplateConfig(guild.id);
  const selectRolesMention = cfg?.channels?.selectRolesId ? `<#${cfg.channels.selectRolesId}>` : 'channel #select-roles';

  if (hasGenderRole) {
    // Sudah verifikasi + sudah pilih gender: Buka seluruh channel server!
    await member.roles.add(memberRole).catch(console.error);
    if (!member.roles.cache.has(verifiedRole.id)) {
      await member.roles.add(verifiedRole).catch(console.error);
    }

    // Sembunyikan channel start-here dari member ini
    if (interaction.channel?.permissionOverwrites) {
      await interaction.channel.permissionOverwrites.edit(member.id, {
        ViewChannel: false,
      }).catch(() => null);
    }

    return interaction.reply({
      content: `🎉 **Selamat!** Kamu telah terverifikasi dan telah memiliki role gender.\n**Seluruh kategori dan channel server sekarang telah terbuka penuh untukmu!** Selamat bergabung di ${guild.name}! 🚀`,
      flags: 64, // Ephemeral
    });
  } else {
    // Tandai bahwa member sudah menekan tombol verifikasi
    await member.roles.add(verifiedRole).catch(console.error);

    return interaction.reply({
      content: `✅ **Verifikasi Langkah 1 Berhasil!**\n⚠️ **Wajib Memilih Role Gender**: Silakan buka channel ${selectRolesMention} lalu pilih role gender kamu (**👦 Laki-laki** / **👧 Perempuan**) untuk otomatis membuka seluruh channel server!`,
      flags: 64, // Ephemeral
    });
  }
}

module.exports = {
  getTemplateConfig,
  setTemplateConfig,
  getOrCreateRole,
  getOrCreateChannel,
  setupGetStarted,
  setupOfficial,
  setupNotify,
  setupCommunity,
  setupCinematography,
  setupEntertainment,
  setupMiniGamesTemplate,
  setupVoiceLounges,
  setupFullTemplate,
  handleGenderRoleSelection,
  handleVerificationButton,
};
