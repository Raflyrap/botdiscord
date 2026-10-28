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
const {
  setGameConfig,
  getCoinGameRow,
  getRpsGameRow,
  getNumberGameRow,
  startNumberGuessing,
} = require('./gameHelper');
const { setGuildTicketConfig } = require('./ticketHelper');
const { setHdConfig } = require('./imageHdHelper');

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
    let isMatchingType;
    if (type === ChannelType.GuildForum) {
      isMatchingType = c.type === ChannelType.GuildForum;
    } else {
      isMatchingType = c.type === type;
    }
    return isMatchingType && (c.name === name || (cleanActual && cleanActual === cleanSearch) || cleanActual.includes(cleanSearch));
  });

  if (!channel) {
    try {
      channel = await guild.channels.create({
        name,
        type,
        parent: parentId || undefined,
        permissionOverwrites: permissionOverwrites || undefined,
        position: position !== undefined ? position : undefined,
        reason: `Auto-setup channel ${name}`,
      });
    } catch (createErr) {
      if (type === ChannelType.GuildForum) {
        console.warn(`Server ${guild.name} belum mengaktifkan Community, fallback channel ${name} ke Text:`, createErr.message);
        channel = await guild.channels.create({
          name,
          type: ChannelType.GuildText,
          parent: parentId || undefined,
          permissionOverwrites: permissionOverwrites || undefined,
          position: position !== undefined ? position : undefined,
          reason: `Auto-setup channel ${name} (Fallback Text Channel)`,
        });
      } else {
        throw createErr;
      }
    }
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

  return { category, announcement, officialEvent, helpCenter };
}

/**
 * Setup 3: Notify
 * Welcome, Leave, Levels, Achievements
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

  const levels = await getOrCreateChannel(guild, {
    name: '🔝︱levels',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: readOnlyOverwrites,
  });

  const achievements = await getOrCreateChannel(guild, {
    name: '🏆︱achievements',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: readOnlyOverwrites,
  });

  // Sambungkan ke welcomeHelper
  setGuildConfig(guild.id, {
    welcomeChannel: welcome.id,
    leaveChannel: leave.id,
  });

  // Sambungkan channel notifikasi leveling & achievements
  setLevelConfig(guild.id, {
    levelUpChannel: levels.id,
    achievementChannel: achievements.id,
  });

  // Kirim panduan awal di levels jika belum ada
  const lvlMsgs = await levels.messages.fetch({ limit: 5 }).catch(() => null);
  if (!lvlMsgs || lvlMsgs.size === 0) {
    const lvlEmbed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🔝 Papan Notifikasi Naik Level (Level Up)')
      .setDescription(
        'Setiap pesan dan aktivitas kamu di server menghasilkan XP!\n' +
        'Notifikasi kenaikan level member akan disiarkan secara otomatis di channel ini.\n\n' +
        '• Cek profil & statistik level kamu: `/profile`\n' +
        '• Lihat peringkat leaderboard server: `/leaderboard`'
      )
      .setFooter({ text: 'Notifikasi Otomatis Leveling Server' });
    await levels.send({ embeds: [lvlEmbed] }).catch(() => {});
  }

  // Kirim panduan awal di achievements jika belum ada
  const achMsgs = await achievements.messages.fetch({ limit: 5 }).catch(() => null);
  if (!achMsgs || achMsgs.size === 0) {
    const achEmbed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle('🏆 Papan Notifikasi Pencapaian (Achievements)')
      .setDescription(
        'Raih berbagai badge dan prestasi unik dengan aktif mengobrol dan bermain mini games!\n' +
        'Setiap pencapaian baru yang kamu raih akan diumumkan di channel ini.\n\n' +
        'Koleksi seluruh achievement dan tunjukkan prestasimu!'
      )
      .setFooter({ text: 'Notifikasi Otomatis Achievements Server' });
    await achievements.send({ embeds: [achEmbed] }).catch(() => {});
  }

  return { category, welcome, leave, levels, achievements };
}

/**
 * Setup 4: Community
 * Newcomer chat, Ngobrol, Ngobrol 2, Media, Stalk, Report
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

  const category = await getOrCreateChannel(guild, {
    name: '───────Community───────',
    type: ChannelType.GuildCategory,
    position: 3,
    permissionOverwrites: standardOverwrites,
  });

  const ngobrol = await getOrCreateChannel(guild, {
    name: 'ngobrol',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  const stalk = await getOrCreateChannel(guild, {
    name: 'stalk',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: standardOverwrites,
  });

  // Kirim atau perbarui info penggunaan /stalk jika channel stalk masih kosong atau sudah ada pesan panduan lama
  const stalkEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle('Arena Khusus Stalk Profil Akun')
    .setDescription(
      'Perintah `/stalk` **hanya dapat digunakan di channel ini** untuk menjaga privasi dan ketertiban obrolan server.\n\n' +
      '**Platform yang Didukung:**\n' +
      '• **Mobile Legends (MLBB)**: Nickname akun, region server, status bundle & promo event top-up\n' +
      '• **Roblox**: Followers, teman, avatar headshot 3D, ID & status akun\n' +
      '• **GitHub**: Followers, total repo, bio, organisasi & link profil\n' +
      '• **Twitter / X**: Bio, followers, total postingan, media & banner\n' +
      '• **Minecraft**: UUID resmi, avatar skin 3D, & profil NameMC\n\n' +
      '*Hasil stalk bersifat privat (ephemeral) dan hanya bisa dilihat oleh kamu.*'
    )
    .setFooter({ text: 'Ketik /stalk untuk mulai mencari profil' });

  const stalkMsgs = await stalk.messages.fetch({ limit: 10 }).catch(() => null);
  const existingStalkMsg = stalkMsgs
    ? stalkMsgs.find(
        (m) =>
          m.author?.id === guild.client.user?.id &&
          m.embeds?.some((e) => e.title && e.title.includes('Arena Khusus Stalk'))
      )
    : null;

  if (existingStalkMsg) {
    await existingStalkMsg.edit({ embeds: [stalkEmbed] }).catch(() => {});
  } else if (!stalkMsgs || stalkMsgs.size === 0) {
    await stalk.send({ embeds: [stalkEmbed] }).catch(() => {});
  }

  return {
    category,
    ngobrol,
    stalk,
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

  const hdFoto = await getOrCreateChannel(guild, {
    name: '🖼️︱hd-foto',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Sambungkan ke hdChannelConfig
  setHdConfig(guild.id, {
    categoryId: category.id,
    channelId: hdFoto.id,
    enabled: true,
  });

  // Kirim panduan Auto-HD jika channel masih baru / kosong
  const hdMsgs = await hdFoto.messages.fetch({ limit: 5 }).catch(() => null);
  if (!hdMsgs || hdMsgs.size === 0) {
    const guideEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: `${guild.name} • Studio HD Foto`, iconURL: guild.client.user.displayAvatarURL() })
      .setTitle('Studio Auto-HD Foto')
      .setDescription(
        `Selamat datang di channel khusus Auto-HD!\n\n` +
        `**Cara Pakai (Otomatis & Cepat):**\n` +
        `• Cukup **kirim foto apa saja** ke channel ini, bot akan otomatis meningkatkan resolusi dan ketajamannya (Auto-HD 2x) tanpa perlu mengetik perintah apa pun.\n` +
        `• Ingin hasil 4x lebih besar? Ketik \`/hd 4x\` pada caption foto untuk pembesaran 4x Ultra HD.\n` +
        `• Kamu juga bisa me-reply foto di channel ini lalu ketik \`/hd\` atau \`!hd\`.\n\n` +
        `> 💡 **Tips Kejernihan Maksimal:**\n` +
        `> Discord mengecilkan tampilan gambar di chat. Klik foto hasil lalu pilih "Buka yang asli" di pojok kiri bawah untuk melihat kualitas foto penuh tanpa kompresi Discord!`
      )
      .setFooter({ text: 'FlyBot AI Super-Resolution Enhancer' })
      .setTimestamp();
    await hdFoto.send({ embeds: [guideEmbed] }).catch(() => {});
  }

  return { category, fotografi, videografi, hdFoto };
}

/**
 * Setup 6: Music
 * Kategori Music: play-music, sharelink-music
 */
async function setupMusic(guild, roles) {
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
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '───────Music───────',
    type: ChannelType.GuildCategory,
    position: 5,
    permissionOverwrites: memberOverwrites,
  });

  const playMusic = await getOrCreateChannel(guild, {
    name: 'play-music',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Bersihkan channel teks sharelink-music lama jika ada (agar digantikan oleh Forum)
  const allChannels = await guild.channels.fetch().catch(() => guild.channels.cache);
  const oldTextShare = allChannels?.find((c) => {
    if (!c || c.type === ChannelType.GuildCategory) return false;
    const clean = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return clean === 'sharelinkmusic' && c.type === ChannelType.GuildText;
  });
  if (oldTextShare) {
    console.log(`[SETUP MUSIC] Menghapus channel teks lama #${oldTextShare.name} untuk digantikan Forum di ${guild.name}`);
    await oldTextShare.delete('Upgrade channel sharelink-music menjadi Forum').catch(() => {});
  }

  const sharelinkMusic = await getOrCreateChannel(guild, {
    name: 'sharelink-music',
    type: ChannelType.GuildForum,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Kirim panduan di play-music jika channel masih kosong
  const playMsgs = await playMusic.messages.fetch({ limit: 5 }).catch(() => null);
  if (!playMsgs || playMsgs.size === 0) {
    const playEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Arena Pemutar Musik')
      .setDescription(
        `Selamat datang di channel resmi pemutar musik **${guild.name}**!\n\n` +
        `**Aturan Memutar Musik:**\n` +
        `• Di server ini, seluruh perintah memutar lagu (\`/play\`) **wajib** dijalankan di channel ini.\n` +
        `• Pastikan kamu sudah bergabung ke salah satu Voice Channel sebelum memutar lagu.\n` +
        `• Gunakan perintah \`/play <judul lagu / link>\` untuk mulai mendengarkan.\n` +
        `• Untuk berbagi playlist atau rekomendasi lagu ke teman-teman, gunakan forum <#${sharelinkMusic.id}>.`
      )
      .setFooter({ text: 'FlyBot HD Audio Engine' })
      .setTimestamp();
    await playMusic.send({ embeds: [playEmbed] }).catch(() => {});
  }

  // Sambutan di forum sharelink-music jika forum masih kosong
  if (sharelinkMusic.type === ChannelType.GuildForum) {
    const activeThreads = await sharelinkMusic.threads.fetchActive().catch(() => null);
    if (!activeThreads || activeThreads.threads.size === 0) {
      await sharelinkMusic.threads.create({
        name: 'Rekomendasi & Diskusi Playlist Musik',
        message: {
          embeds: [
            new EmbedBuilder()
              .setColor(0x5865F2)
              .setTitle('Forum Berbagi Link Musik & Playlist Komunitas')
              .setDescription(
                `Selamat datang di Forum Musik **${guild.name}**!\n\n` +
                `Di sini kamu bisa membuat postingan/thread baru untuk:\n` +
                `• Berbagi link playlist Spotify, YouTube Music, SoundCloud, atau Apple Music\n` +
                `• Berbagi rekomendasi lagu favorit berdasarkan genre atau mood\n` +
                `• Diskusi rilisan album baru, musisi, dan instrumen favorit\n\n` +
                `Klik **Postingan Baru (New Post)** di atas untuk mulai membuat thread playlist atau lagu kamu!`
              )
              .setFooter({ text: 'FlyBot Music Community' })
              .setTimestamp(),
          ],
        },
      }).catch(() => {});
    }
  } else {
    const shareMsgs = await sharelinkMusic.messages.fetch({ limit: 5 }).catch(() => null);
    if (!shareMsgs || shareMsgs.size === 0) {
      const shareEmbed = new EmbedBuilder()
        .setColor(0x1DB954)
        .setTitle('Berbagi Link Musik & Rekomendasi Lagu')
        .setDescription(
          `Ruang khusus berbagi link lagu, album, dan playlist favorit sesama anggota **${guild.name}**!\n\n` +
          `• Bagikan link Spotify, YouTube Music, SoundCloud, atau Apple Music kamu di sini.\n` +
          `• Temukan musik baru dari rekomendasi teman-teman satu server.\n` +
          `• Untuk langsung memutar lagu ke Voice Channel, gunakan channel <#${playMusic.id}>.`
        )
        .setFooter({ text: 'FlyBot Music Community' })
        .setTimestamp();
      await sharelinkMusic.send({ embeds: [shareEmbed] }).catch(() => {});
    }
  }

  return { category, playMusic, sharelinkMusic };
}

/**
 * Setup 7: Entertainment
 * AI Fanart, AI Generating, AI Prompt
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
    position: 6,
    permissionOverwrites: memberOverwrites,
  });

  const aiFanart = await getOrCreateChannel(guild, {
    name: 'ai-fanart',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const aiGenerating = await getOrCreateChannel(guild, {
    name: 'ai-generating',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  const aiPrompt = await getOrCreateChannel(guild, {
    name: 'ai-prompt',
    type: ChannelType.GuildText,
    parentId: category.id,
    permissionOverwrites: memberOverwrites,
  });

  // Kirim guide embed di ai-fanart jika channel masih kosong
  const fanartAiMsgs = await aiFanart.messages.fetch({ limit: 5 }).catch(() => null);
  if (!fanartAiMsgs || fanartAiMsgs.size === 0) {
    const aiFanartEmbed = new EmbedBuilder()
      .setColor(0xEB459E)
      .setTitle('Studio AI Fanart & Review Seni Visual')
      .setDescription(
        `Selamat datang di studio visual & kurasi seni AI **${guild.name}**!\n\n` +
        `**Fitur Interaktif:**\n` +
        `• **Kirim Gambar / Fanart**: AI Bot Fly akan langsung membedah karya senimu (komposisi, pencahayaan, harmoni warna, ekspresi) dan memberikan saran estetik kreatif.\n` +
        `• **Minta Ide / Konsep Visual**: Ceritakan ide karakter atau tema yang ingin dibuat, AI akan merancang konsep visual yang epik.\n\n` +
        `*Setiap pesan dan karya kamu di channel ini akan langsung direspons oleh AI.*`
      )
      .setFooter({ text: 'Fly AI Visual Art Reviewer' });
    await aiFanart.send({ embeds: [aiFanartEmbed] }).catch(() => {});
  }

  // Kirim guide embed di ai-generating jika channel masih kosong
  const genMsgs = await aiGenerating.messages.fetch({ limit: 5 }).catch(() => null);
  if (!genMsgs || genMsgs.size === 0) {
    const aiGenEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Studio AI Generating Serba Bisa')
      .setDescription(
        `Selamat datang di ruang text generation cerdas BotFly AI **${guild.name}**!\n\n` +
        `**Kamu bisa minta apa saja:**\n` +
        `• Bikin cerita fiksi, skrip dialog, atau puisi\n` +
        `• Buat kode program, perbaiki error kode, dan rancang algoritma\n` +
        `• Brainstorming ide konten, rangkuman materi, dan riset cepat\n\n` +
        `*Cukup ketik pesanmu langsung di channel ini, BotFly AI akan langsung membalas secara privat.*`
      )
      .setFooter({ text: 'BotFly Neural Intelligence • Copyright © BotFly' });
    await aiGenerating.send({ embeds: [aiGenEmbed] }).catch(() => {});
  }

  // Kirim guide embed di ai-prompt jika channel masih kosong
  const promptMsgs = await aiPrompt.messages.fetch({ limit: 5 }).catch(() => null);
  if (!promptMsgs || promptMsgs.size === 0) {
    const aiPromptEmbed = new EmbedBuilder()
      .setColor(0x57F287)
      .setTitle('Studio Prompt Engineering AI')
      .setDescription(
        `Selamat datang di studio peracikan prompt generative AI tingkat master **${guild.name}**!\n\n` +
        `**Cara Pakai:**\n` +
        `• Ketik ide visual atau konsep yang ingin kamu buat gambar/teksnya\n` +
        `• BotFly AI akan otomatis meracik **Prompt Utama Bahasa Inggris**, **Negative Prompt**, dan **Parameter Kamera / Render Engine** siap pakai untuk mesin generator visual kamu.\n\n` +
        `*Tinggal salin kode prompt dari kotak kode ke generator AI kamu!*`
      )
      .setFooter({ text: 'BotFly Master Prompt Studio • Copyright © BotFly' });
    await aiPrompt.send({ embeds: [aiPromptEmbed] }).catch(() => {});
  }

  return { category, aiFanart, aiGenerating, aiPrompt };
}

/**
 * Setup 7: Sosmed Converter & Downloader
 * TikTok, Instagram, Facebook, YouTube (Konversi Link Otomatis ke Media Video & Foto)
 */
async function setupSosmedConverter(guild, roles) {
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
        PermissionFlagsBits.ManageMessages,
      ],
    },
  ];

  const category = await getOrCreateChannel(guild, {
    name: '──────Sosmed-Converter──────',
    type: ChannelType.GuildCategory,
    position: 6,
    permissionOverwrites: memberOverwrites,
  });

  // 1. TikTok Convert
  const tiktokConvert = await getOrCreateChannel(guild, {
    name: 'tiktok-convert',
    type: ChannelType.GuildText,
    parentId: category.id,
    topic: 'Kirim link TikTok dari PC/Mobile, bot otomatis konversi jadi video tanpa watermark atau foto! Chat otomatis dihapus setelah 1 hari (24 jam).',
  });

  // 2. Instagram Convert
  const instagramConvert = await getOrCreateChannel(guild, {
    name: 'instagram-convert',
    type: ChannelType.GuildText,
    parentId: category.id,
    topic: 'Kirim link Reels, Postingan, atau Carousel Instagram untuk diunduh otomatis! Chat otomatis dihapus setelah 1 hari (24 jam).',
  });

  // 3. Facebook Convert
  const facebookConvert = await getOrCreateChannel(guild, {
    name: 'facebook-convert',
    type: ChannelType.GuildText,
    parentId: category.id,
    topic: 'Kirim link video / reels Facebook untuk dikonversi menjadi video langsung! Chat otomatis dihapus setelah 1 hari (24 jam).',
  });

  // 4. YouTube Convert
  const youtubeConvert = await getOrCreateChannel(guild, {
    name: 'youtube-convert',
    type: ChannelType.GuildText,
    parentId: category.id,
    topic: 'Kirim link YouTube Shorts atau video YouTube untuk dikonversi langsung! Chat otomatis dihapus setelah 1 hari (24 jam).',
  });

  // Guide embed TikTok
  const ttMsgs = await tiktokConvert.messages.fetch({ limit: 5 }).catch(() => null);
  if (!ttMsgs || ttMsgs.size === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFE2C55)
      .setTitle('TikTok Converter & Downloader No Watermark')
      .setDescription(
        `Selamat datang di channel **TikTok Converter**!\n\n` +
        `**Cara Pakai:**\n` +
        `• Cukup **salin link TikTok** (video atau foto slideshow) dari HP atau browser PC kamu.\n` +
        `• **Kirim link-nya ke channel ini**, bot FlyBot akan otomatis mengonversi dan mengirimkan videonya tanpa watermark atau galeri foto ke chat ini!\n\n` +
        `> Catatan: Chat di channel ini otomatis dibersihkan setiap 1 hari (24 jam) agar selalu rapi. Khusus link TikTok.`
      )
      .setFooter({ text: 'FlyBot Sosmed Downloader • Auto-Clean 24 Jam' })
      .setTimestamp();
    const sent = await tiktokConvert.send({ embeds: [embed] }).catch(() => {});
    if (sent) await sent.pin().catch(() => {});
  }

  // Guide embed Instagram
  const igMsgs = await instagramConvert.messages.fetch({ limit: 5 }).catch(() => null);
  if (!igMsgs || igMsgs.size === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xE1306C)
      .setTitle('Instagram Reels & Post Converter')
      .setDescription(
        `Selamat datang di channel **Instagram Converter**!\n\n` +
        `**Cara Pakai:**\n` +
        `• Salin link **Reels**, **Postingan Feed**, atau **Foto Carousel** Instagram publik.\n` +
        `• Kirim link ke channel ini, bot akan langsung mengunduh dan menyajikannya di chat!\n\n` +
        `> Catatan: Chat di channel ini otomatis dibersihkan setiap 1 hari (24 jam) agar selalu rapi. Khusus link Instagram publik.`
      )
      .setFooter({ text: 'FlyBot Sosmed Downloader • Auto-Clean 24 Jam' })
      .setTimestamp();
    const sent = await instagramConvert.send({ embeds: [embed] }).catch(() => {});
    if (sent) await sent.pin().catch(() => {});
  }

  // Guide embed Facebook
  const fbMsgs = await facebookConvert.messages.fetch({ limit: 5 }).catch(() => null);
  if (!fbMsgs || fbMsgs.size === 0) {
    const embed = new EmbedBuilder()
      .setColor(0x1877F2)
      .setTitle('Facebook Video & Reels Converter')
      .setDescription(
        `Selamat datang di channel **Facebook Converter**!\n\n` +
        `**Cara Pakai:**\n` +
        `• Salin link video, watch, atau reels dari Facebook publik.\n` +
        `• Kirim link ke sini untuk dikonversi menjadi video langsung!\n\n` +
        `> Catatan: Chat di channel ini otomatis dibersihkan setiap 1 hari (24 jam) agar selalu rapi. Khusus link video Facebook.`
      )
      .setFooter({ text: 'FlyBot Sosmed Downloader • Auto-Clean 24 Jam' })
      .setTimestamp();
    const sent = await facebookConvert.send({ embeds: [embed] }).catch(() => {});
    if (sent) await sent.pin().catch(() => {});
  }

  // Guide embed YouTube
  const ytMsgs = await youtubeConvert.messages.fetch({ limit: 5 }).catch(() => null);
  if (!ytMsgs || ytMsgs.size === 0) {
    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('YouTube & Shorts Converter')
      .setDescription(
        `Selamat datang di channel **YouTube Converter**!\n\n` +
        `**Cara Pakai:**\n` +
        `• Salin link **YouTube Shorts** atau video YouTube.\n` +
        `• Kirim link ke channel ini, bot akan otomatis mengonversi video & menyediakan link download resolusi penuh!\n\n` +
        `> Catatan: Chat di channel ini otomatis dibersihkan setiap 1 hari (24 jam) agar selalu rapi. Khusus link YouTube.`
      )
      .setFooter({ text: 'FlyBot Sosmed Downloader • Auto-Clean 24 Jam' })
      .setTimestamp();
    const sent = await youtubeConvert.send({ embeds: [embed] }).catch(() => {});
    if (sent) await sent.pin().catch(() => {});
  }

  return { category, tiktokConvert, instagramConvert, facebookConvert, youtubeConvert };
}

/**
 * Setup 8: Mini Games
 * Tebak Koin, Tebak Angka, Suit Jepang (Lengkap dengan Tombol & Game Langsung Aktif)
 */
async function setupMiniGamesTemplate(guild, roles) {
  const botOverwrites = {
    id: guild.client.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
      PermissionFlagsBits.AttachFiles,
      PermissionFlagsBits.ReadMessageHistory,
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.ManageChannels,
    ],
  };

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
        PermissionFlagsBits.AddReactions,
      ],
    },
    botOverwrites,
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

  // Helper untuk memastikan pesan panel & tombol game aktif selalu tersedia
  async function ensurePanel(channel, embed, row) {
    try {
      const msgs = await channel.messages.fetch({ limit: 10 }).catch(() => null);
      const existing = msgs ? msgs.find((m) => m.author.id === guild.client.user.id && m.components.length > 0) : null;
      if (!existing) {
        const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
        if (sent) await sent.pin().catch(() => {});
      }
    } catch (e) {
      console.warn(`[GAME SETUP] Gagal kirim panel di ${channel.name}:`, e.message);
    }
  }

  // 1. Panel & Tombol Tebak Koin
  const coinEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `${guild.name} • Arena Mini Games`, iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('🪙 Arena Tebak Koin')
    .setDescription(
      `Selamat datang di Arena Tebak Koin.\n` +
      `Uji insting dan tebakan kamu di sini dan menangkan koin serta XP!\n\n` +
      `**Panduan Permainan:**\n` +
      `1. Tentukan pilihan tebakan kamu: **Gambar** atau **Angka**.\n` +
      `2. Klik tombol di bawah atau ketik kata **gambar** / **angka** di chat untuk melempar koin.\n` +
      `3. Bot akan mengocok koin dan mengumumkan hasilnya.\n` +
      `4. Kamu juga bisa klik tombol **Lempar Acak** untuk sekadar mengocok koin.`
    )
    .addFields(
      { name: 'Pilihan Sisi', value: 'Gambar  |  Angka', inline: true },
      { name: 'Peluang', value: '50% : 50%', inline: true },
      { name: 'Hadiah Kemenangan', value: '+50 Koin & +30 XP', inline: true }
    )
    .setFooter({ text: 'Klik tombol di bawah atau ketik di chat untuk bermain!' })
    .setTimestamp();

  await ensurePanel(coinChannel, coinEmbed, getCoinGameRow());

  // 2. Panel & Tombol Tebak Angka
  const numberEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `${guild.name} • Arena Mini Games`, iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('🔢 Arena Tebak Angka (1 - 100)')
    .setDescription(
      `Selamat datang di Arena Tebak Angka.\n` +
      `Tebak angka rahasia antara 1 sampai 100 yang disimpan oleh sistem dan raih jackpot hadiah!\n\n` +
      `**Panduan Permainan:**\n` +
      `1. Angka rahasia (1-100) langsung aktif dan siap ditebak kapan saja.\n` +
      `2. Ketik angka tebakan kamu (contoh: 50) langsung di chat channel ini.\n` +
      `3. Bot akan memberikan petunjuk arah:\n` +
      `   • [Terlalu KECIL] Angka rahasia lebih besar dari tebakanmu\n` +
      `   • [Terlalu BESAR] Angka rahasia lebih kecil dari tebakanmu\n` +
      `4. Member yang berhasil menebak dengan tepat dinyatakan sebagai juara!`
    )
    .addFields(
      { name: 'Rentang Angka', value: '1 sampai 100', inline: true },
      { name: 'Mode', value: 'Multiplayer Komunitas', inline: true },
      { name: 'Hadiah Juara', value: 'Hingga +200 Koin & +100 XP', inline: true }
    )
    .setFooter({ text: 'Ketik angka tebakanmu (1-100) langsung di channel ini!' })
    .setTimestamp();

  await ensurePanel(numberChannel, numberEmbed, getNumberGameRow());

  // Mulai ronde tebak angka secara otomatis agar langsung aktif
  startNumberGuessing(guild.id, guild.client.user.id);

  // 3. Panel & Tombol Suit Jepang
  const rpsEmbed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({ name: `${guild.name} • Arena Mini Games`, iconURL: guild.client.user.displayAvatarURL() })
    .setTitle('✌️ Arena Suit Jepang (Gunting Batu Kertas)')
    .setDescription(
      `Tantang FlyBot dalam adu pilihan klasik dan dapatkan koin serta XP!\n\n` +
      `**Aturan Permainan:**\n` +
      `• Batu mengalahkan Gunting\n` +
      `• Gunting mengalahkan Kertas\n` +
      `• Kertas mengalahkan Batu\n\n` +
      `Klik tombol pilihan di bawah atau ketik **batu**, **gunting**, atau **kertas** di chat untuk duel!`
    )
    .addFields(
      { name: 'Lawan', value: 'FlyBot AI (Acak)', inline: true },
      { name: 'Sistem', value: 'Respons Instan', inline: true },
      { name: 'Hadiah', value: 'Menang: +50 Koin | Seri: +20 Koin', inline: false }
    )
    .setFooter({ text: 'Pilih Batu, Kertas, atau Gunting di bawah untuk bermain!' })
    .setTimestamp();

  await ensurePanel(rpsChannel, rpsEmbed, getRpsGameRow());

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
 * Hanya Buat Room Voice (Trigger Join-to-Create Room Mandiri dengan Panel Interaktif)
 */
async function setupVoiceLounges(guild, roles) {
  const voiceOverwrites = [
    {
      id: guild.roles.everyone.id,
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

  if (roles?.member?.id) {
    voiceOverwrites.push({
      id: roles.member.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.Connect,
        PermissionFlagsBits.Speak,
      ],
    });
  }

  const category = await getOrCreateChannel(guild, {
    name: '───────Voice Lounges───────',
    type: ChannelType.GuildCategory,
    position: 7, // Paling bawah
    permissionOverwrites: voiceOverwrites,
  });

  // Pastikan izin kategori diperbarui jika kategori sudah ada sebelumnya
  await category.permissionOverwrites.set(voiceOverwrites).catch((err) => {
    console.warn('[SETUP VOICE] Gagal update permissions kategori:', err.message);
  });

  // Channel Trigger Buat Room Voice (Satu-satunya channel di kategori ini)
  const hubChannel = await getOrCreateChannel(guild, {
    name: '➕︱Buat Room Voice',
    type: ChannelType.GuildVoice,
    parentId: category.id,
    permissionOverwrites: voiceOverwrites,
  });

  // Sambungkan ke tempVoiceHelper
  setTempVoiceConfig(guild.id, hubChannel.id, category.id);

  return { category, hubChannel };
}

/**
 * MASTER SETUP: Bangun Seluruh Template Lengkap Sesuai Gambar
 */
async function setupFullTemplate(guild) {
  // 0. Auto-cleanup channel usang / tidak terpakai jika ada di server
  const allChannels = await guild.channels.fetch().catch(() => guild.channels.cache);
  if (allChannels) {
    for (const [, ch] of allChannels) {
      if (!ch || ch.type === ChannelType.GuildCategory) continue;
      const clean = ch.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      // Lindungi channel penting agar tidak terhapus
      if (clean.includes('aifanart') || clean.includes('fotografi') || clean.includes('videografi') || clean.includes('converter')) {
        continue;
      }
      const isObsolete =
        clean === 'report' || clean.endsWith('report') ||
        clean === 'media' || clean.endsWith('media') ||
        clean === 'meme' || clean.endsWith('meme') ||
        clean === 'fanart' || clean.endsWith('fanart') ||
        clean.includes('playlistmusic') ||
        clean.includes('showcasegaming') ||
        clean.includes('gamingsetup') ||
        clean.includes('ngobrol2') ||
        clean.includes('newcomerchat') ||
        clean.includes('socialmedia');

      if (isObsolete) {
        console.log(`[AUTO-CLEANUP] Menghapus channel tidak terpakai: #${ch.name} di ${guild.name}`);
        await ch.delete('Auto-cleanup channel template yang sudah dihapus').catch(() => {});
      }
    }
  }

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

  // Inisialisasi awal role level dan achievement (Level 1 s/d MAX, Achievement 1/100 s/d MAX)
  const { setupProgressionRolesTemplate } = require('./levelRoleHelper');
  await setupProgressionRolesTemplate(guild).catch(() => {});

  // 2. Setup Kategori 1: Get Started
  const getStarted = await setupGetStarted(guild, roles);

  // 3. Setup Kategori 2: Official
  const official = await setupOfficial(guild, roles);

  // 4. Setup Kategori 3: Notify (Welcome & Leave)
  const notify = await setupNotify(guild, roles);

  // 5. Setup Kategori 4: Community
  const community = await setupCommunity(guild, roles);

  // 6. Setup Kategori 5: Cinematography (Termasuk hd-foto)
  const cinematography = await setupCinematography(guild, roles);

  // 7. Setup Kategori 6: Music (play-music & sharelink-music)
  const music = await setupMusic(guild, roles);

  // 8. Setup Kategori 7: Entertainment (AI Rooms)
  const entertainment = await setupEntertainment(guild, roles);

  // 9. Setup Kategori 8: Sosmed Converter (TikTok, Instagram, Facebook, YouTube)
  const sosmedConverter = await setupSosmedConverter(guild, roles);

  // 10. Setup Kategori 9: Mini Games
  const miniGames = await setupMiniGamesTemplate(guild, roles);

  // 11. Setup Kategori 10: Voice Lounges (Paling Bawah)
  const voiceLounges = await setupVoiceLounges(guild, roles);

  // 12. Simpan konfigurasi server
  setTemplateConfig(guild.id, {
    allInOneConfigured: true,
    templateVersion: 4,
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
      levelsId: notify.levels.id,
      achievementsId: notify.achievements.id,
      stalkId: community.stalk.id,
      hdFotoId: cinematography.hdFoto.id,
      playMusicId: music.playMusic.id,
      sharelinkMusicId: music.sharelinkMusic.id,
      aiFanartId: entertainment.aiFanart.id,
      aiGeneratingId: entertainment.aiGenerating.id,
      aiPromptId: entertainment.aiPrompt.id,
      tiktokConvertId: sosmedConverter.tiktokConvert.id,
      instagramConvertId: sosmedConverter.instagramConvert.id,
      facebookConvertId: sosmedConverter.facebookConvert.id,
      youtubeConvertId: sosmedConverter.youtubeConvert.id,
      coinId: miniGames.coinChannel.id,
      numberId: miniGames.numberChannel.id,
      rpsId: miniGames.rpsChannel.id,
      hubVoiceId: voiceLounges.hubChannel.id,
    },
    categories: {
      getStartedId: getStarted.category.id,
      officialId: official.category.id,
      notifyId: notify.category.id,
      communityId: community.category.id,
      cinematographyId: cinematography.category.id,
      musicId: music.category.id,
      entertainmentId: entertainment.category.id,
      sosmedConverterId: sosmedConverter.category.id,
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
    music,
    entertainment,
    sosmedConverter,
    miniGames,
    voiceLounges,
  };
}

/**
 * Auto-Sync Server Setup:
 * Menyelaraskan struktur server yang sudah pernah disetup sebelumnya tanpa perlu delete & setup ulang!
 */
async function syncServerTemplate(guild) {
  try {
    return await setupFullTemplate(guild);
  } catch (err) {
    console.error(`[SYNC TEMPLATE ERROR] Gagal menyinkronkan ${guild.name}:`, err);
    throw err;
  }
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
      content: `Role **${targetRole.name}** berhasil dipasang!\nKamu sudah terverifikasi, sehingga **seluruh kategori dan channel server sekarang telah terbuka penuh**! Selamat berinteraksi!`,
      flags: 64, // Ephemeral
    });
  } else {
    return interaction.reply({
      content: `Role **${targetRole.name}** berhasil dipasang!\n**Tinggal 1 langkah lagi**: Silakan tekan tombol **Verifikasi Sekarang** di ${startHereMention} untuk membuka seluruh kategori dan channel server!`,
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
      content: `**Selamat!** Kamu telah terverifikasi dan telah memiliki role gender.\n**Seluruh kategori dan channel server sekarang telah terbuka penuh untukmu!** Selamat bergabung di ${guild.name}!`,
      flags: 64, // Ephemeral
    });
  } else {
    // Tandai bahwa member sudah menekan tombol verifikasi
    await member.roles.add(verifiedRole).catch(console.error);

    return interaction.reply({
      content: `**Verifikasi Langkah 1 Berhasil!**\n**Wajib Memilih Role Gender**: Silakan buka channel ${selectRolesMention} lalu pilih role gender kamu (Laki-laki / Perempuan) untuk otomatis membuka seluruh channel server!`,
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
  setupMusic,
  setupEntertainment,
  setupSosmedConverter,
  setupMiniGamesTemplate,
  setupVoiceLounges,
  setupFullTemplate,
  syncServerTemplate,
  handleGenderRoleSelection,
  handleVerificationButton,
};
