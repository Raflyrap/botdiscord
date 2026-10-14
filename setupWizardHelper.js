const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const { setTempVoiceConfig } = require('./tempVoiceHelper');
const { setGuildConfig } = require('./welcomeHelper');
const { setAutoRole } = require('./autoRoleHelper');
const fs = require('fs');
const path = require('path');

const MODLOG_CONFIG_FILE = path.join(__dirname, 'modLogConfig.json');

function loadModLogConfig() {
  try {
    if (fs.existsSync(MODLOG_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(MODLOG_CONFIG_FILE, 'utf-8') || '{}');
    }
  } catch (err) {
    console.error('Error loadModLogConfig:', err);
  }
  return {};
}

function saveModLogConfig(config) {
  try {
    fs.writeFileSync(MODLOG_CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saveModLogConfig:', err);
  }
}

function getModLogChannel(guildId) {
  const cfg = loadModLogConfig();
  return cfg[guildId] || null;
}

function setModLogChannel(guildId, channelId) {
  const cfg = loadModLogConfig();
  cfg[guildId] = channelId;
  saveModLogConfig(cfg);
}

/**
 * Panel utama Owner Wizard tanpa emoji
 */
function createSetupWizardPanel(user) {
  const userMention = user ? `<@${user.id}>` : '@Owner';

  const embed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('Pusat Persiapan Server (Owner Wizard)')
    .setDescription(
      `Halo ${userMention}! Selamat datang di wizard persiapan server.\n` +
      `Cukup tap tombol di bawah untuk mengatur server secara bertahap atau **1-Klik Otomatis**:\n\n` +
      `**Setup Lengkap 1-Klik** — Pasang SEMUA (channel, role, verifikasi, self-role, welcome, log)\n` +
      `**1. Desain Server** — Buat channel & kategori otomatis sesuai tema\n` +
      `**2. Pasang Verifikasi** — Pasang sistem proteksi tombol verifikasi\n` +
      `**3. Panel Role** — Buat tombol bagi-bagi role untuk member\n` +
      `**4. Set Sambutan** — Jadikan channel ini sebagai penyapa member baru\n` +
      `**5. Log Moderasi** — Aktifkan channel pemantau keamanan #mod-log\n\n` +
      `Ketik \`!setuplengkap\` atau \`!setup auto\` jika ingin langsung eksekusi tanpa klik tombol.`
    );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_btn_1click')
      .setLabel('Setup Lengkap 1-Klik')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('setup_btn_design')
      .setLabel('1. Desain Server')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_btn_verify')
      .setLabel('2. Pasang Verifikasi')
      .setStyle(ButtonStyle.Success)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('setup_btn_roles')
      .setLabel('3. Panel Ambil Role')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_btn_welcome')
      .setLabel('4. Set Sambutan')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('setup_btn_modlog')
      .setLabel('5. Pasang Log Moderasi')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [row1, row2] };
}

/**
 * 1. Desain Server: Sesuai struktur gambar referensi
 * (Get Started, Official, Community, Motion Forum Showdown, Cinematography, Entertainment)
 */
async function executeDesignServer(guild, progressCallback = null) {
  const created = {
    categories: [],
    channels: [],
  };

  const update = async (text) => {
    if (typeof progressCallback === 'function') {
      await progressCallback(text).catch(() => {});
    }
  };

  // --- KATEGORI 1: Get Started ---
  await update('Membuat kategori Get Started...');
  const catGetStarted = await guild.channels.create({
    name: 'Get Started',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catGetStarted);

  const chRules = await guild.channels.create({
    name: 'rules',
    type: ChannelType.GuildText,
    parent: catGetStarted.id,
  });
  created.channels.push(chRules);

  const chStartHere = await guild.channels.create({
    name: 'start-here',
    type: ChannelType.GuildText,
    parent: catGetStarted.id,
  });
  created.channels.push(chStartHere);

  const chIdentify = await guild.channels.create({
    name: 'identify-yourself',
    type: ChannelType.GuildText,
    parent: catGetStarted.id,
  });
  created.channels.push(chIdentify);

  const chSelectRoles = await guild.channels.create({
    name: 'select-roles',
    type: ChannelType.GuildText,
    parent: catGetStarted.id,
  });
  created.channels.push(chSelectRoles);

  // --- KATEGORI 2: Official ---
  await update('Membuat kategori Official...');
  const catOfficial = await guild.channels.create({
    name: 'Official',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catOfficial);

  const chAnnouncement = await guild.channels.create({
    name: 'announcement',
    type: ChannelType.GuildText,
    parent: catOfficial.id,
  });
  created.channels.push(chAnnouncement);

  const chOfficialEvent = await guild.channels.create({
    name: 'official-event',
    type: ChannelType.GuildText,
    parent: catOfficial.id,
  });
  created.channels.push(chOfficialEvent);

  const chSocialMedia = await guild.channels.create({
    name: 'social-media',
    type: ChannelType.GuildText,
    parent: catOfficial.id,
  });
  created.channels.push(chSocialMedia);

  const chHelpCenter = await guild.channels.create({
    name: 'help-center',
    type: ChannelType.GuildText,
    parent: catOfficial.id,
  });
  created.channels.push(chHelpCenter);

  // --- KATEGORI 3: Community ---
  await update('Membuat kategori Community...');
  const catCommunity = await guild.channels.create({
    name: 'Community',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catCommunity);

  const chNewcomer = await guild.channels.create({
    name: 'newcomer-chat',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chNewcomer);

  // Otomatis tautkan welcome ke newcomer-chat
  setGuildConfig(guild.id, { welcomeChannel: chNewcomer.id, leaveChannel: chNewcomer.id });

  const chNgobrol = await guild.channels.create({
    name: 'ngobrol',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chNgobrol);

  const chNgobrol2 = await guild.channels.create({
    name: 'ngobrol-2',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chNgobrol2);

  const chMedia = await guild.channels.create({
    name: 'media',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chMedia);

  const chLevels = await guild.channels.create({
    name: 'levels',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chLevels);

  const chReport = await guild.channels.create({
    name: 'report',
    type: ChannelType.GuildText,
    parent: catCommunity.id,
  });
  created.channels.push(chReport);

  const chFemaleVerify = await guild.channels.create({
    name: 'Female Verification',
    type: ChannelType.GuildVoice,
    parent: catCommunity.id,
  });
  created.channels.push(chFemaleVerify);

  // --- KATEGORI 4: Motion Forum Showdown ---
  await update('Membuat kategori Motion Forum Showdown...');
  const catMotion = await guild.channels.create({
    name: 'Motion Forum Showdown',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catMotion);

  const chMotionAnnounce = await guild.channels.create({
    name: 'announcement',
    type: ChannelType.GuildText,
    parent: catMotion.id,
  });
  created.channels.push(chMotionAnnounce);

  const chLobby = await guild.channels.create({
    name: 'lobby',
    type: ChannelType.GuildText,
    parent: catMotion.id,
  });
  created.channels.push(chLobby);

  const chInfoScrim = await guild.channels.create({
    name: 'info-scrim',
    type: ChannelType.GuildText,
    parent: catMotion.id,
  });
  created.channels.push(chInfoScrim);

  // --- KATEGORI 5: Cinematography ---
  await update('Membuat kategori Cinematography...');
  const catCinema = await guild.channels.create({
    name: 'Cinematography',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catCinema);

  const chFotografi = await guild.channels.create({
    name: 'fotografi',
    type: ChannelType.GuildText,
    parent: catCinema.id,
  });
  created.channels.push(chFotografi);

  const chVideografi = await guild.channels.create({
    name: 'videografi',
    type: ChannelType.GuildText,
    parent: catCinema.id,
  });
  created.channels.push(chVideografi);

  // --- KATEGORI 6: Entertainment & Voice ---
  await update('Membuat kategori Entertainment...');
  const catEntertainment = await guild.channels.create({
    name: 'Entertainment',
    type: ChannelType.GuildCategory,
  });
  created.categories.push(catEntertainment);

  const chMeme = await guild.channels.create({
    name: 'meme',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chMeme);

  const chFanart = await guild.channels.create({
    name: 'fanart',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chFanart);

  const chAiFanart = await guild.channels.create({
    name: 'ai-fanart',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chAiFanart);

  const chAiGenerating = await guild.channels.create({
    name: 'ai-generating',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chAiGenerating);

  const chAiPrompt = await guild.channels.create({
    name: 'ai-prompt',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chAiPrompt);

  const chShowcase = await guild.channels.create({
    name: 'showcase-gaming',
    type: ChannelType.GuildText,
    parent: catEntertainment.id,
  });
  created.channels.push(chShowcase);

  // Voice Hub: Production Room (Join-to-Create)
  const chProdRoom = await guild.channels.create({
    name: 'Production Room',
    type: ChannelType.GuildVoice,
    parent: catEntertainment.id,
  });
  created.channels.push(chProdRoom);

  // Hubungkan ke Temp Voice helper
  setTempVoiceConfig(guild.id, chProdRoom.id, catEntertainment.id);

  const chLiveRoom = await guild.channels.create({
    name: 'Live Room',
    type: ChannelType.GuildVoice,
    parent: catEntertainment.id,
  });
  created.channels.push(chLiveRoom);

  return {
    created,
    catGetStarted,
    chRules,
    chStartHere,
    chSelectRoles,
    catCommunity,
    chNewcomer,
    catEntertainment,
    chProdRoom,
  };
}

/**
 * 2. Pasang Verifikasi: Taruh panel verifikasi di channel start-here / rules
 */
async function executeSetupVerification(guild, targetChannel = null) {
  let memberRole = guild.roles.cache.find((r) => r.name.toLowerCase() === 'member');
  if (!memberRole) {
    memberRole = await guild.roles.create({
      name: 'Member',
      color: 0x57F287,
      reason: 'Role verifikasi otomatis',
    });
  }

  setAutoRole(guild.id, memberRole.id);

  let ch = targetChannel;
  if (!ch) {
    ch = guild.channels.cache.find(
      (c) => c.name === 'start-here' || c.name === 'rules' || c.name === 'verifikasi'
    );
  }

  if (!ch) {
    ch = await guild.channels.create({
      name: 'start-here',
      type: ChannelType.GuildText,
    });
  }

  const verifyEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('Verifikasi Server')
    .setDescription(
      `Selamat datang di **${guild.name}**!\n\n` +
      `Untuk membuka seluruh channel komunitas dan mulai berinteraksi, silakan tekan tombol **Verifikasi Sekarang** di bawah ini.`
    )
    .setFooter({ text: 'Sistem Verifikasi Otomatis' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_do_verify')
      .setLabel('Verifikasi Sekarang')
      .setStyle(ButtonStyle.Success)
  );

  await ch.send({ embeds: [verifyEmbed], components: [row] });
  return { chVerify: ch, memberRole };
}

/**
 * 3. Panel Ambil Role (Self-Role) di channel select-roles
 */
async function executeSetupRolePanel(guild, channel = null) {
  const roleNames = [
    { name: 'Pengumuman Ping', color: 0x5865F2, customId: 'selfrole_announcement' },
    { name: 'Update Event', color: 0xFEE75C, customId: 'selfrole_event' },
    { name: 'Gamers', color: 0xEB459E, customId: 'selfrole_gamers' },
  ];

  const createdRoles = [];
  for (const item of roleNames) {
    let r = guild.roles.cache.find((x) => x.name.toLowerCase() === item.name.toLowerCase());
    if (!r) {
      r = await guild.roles.create({
        name: item.name,
        color: item.color,
        reason: 'Self-role member',
      });
    }
    createdRoles.push({ ...item, role: r });
  }

  let targetChannel = channel;
  if (!targetChannel) {
    targetChannel = guild.channels.cache.find(
      (c) => c.name === 'select-roles' || c.name.includes('role')
    );
    if (!targetChannel) {
      targetChannel = await guild.channels.create({
        name: 'select-roles',
        type: ChannelType.GuildText,
      });
    }
  }

  const roleEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('Panel Pemilihan Role Mandiri')
    .setDescription(
      `Pilih role yang kamu inginkan dengan menekan tombol di bawah ini.\n` +
      `Tekan sekali untuk mengambil role, dan tekan kembali jika ingin mencabutnya:\n\n` +
      createdRoles.map((item) => `**${item.name}** — Notifikasi seputar ${item.name}`).join('\n')
    )
    .setFooter({ text: 'Sistem Role Mandiri' });

  const buttons = createdRoles.map((item) =>
    new ButtonBuilder()
      .setCustomId(item.customId)
      .setLabel(item.name)
      .setStyle(ButtonStyle.Secondary)
  );

  const row = new ActionRowBuilder().addComponents(buttons);
  await targetChannel.send({ embeds: [roleEmbed], components: [row] });
  return { targetChannel, createdRoles };
}

/**
 * 4. Set Sambutan
 */
async function executeSetupWelcome(guild, designatedChannel = null) {
  let ch = designatedChannel;
  if (!ch) {
    ch = guild.channels.cache.find(
      (c) => c.name === 'newcomer-chat' || c.name.toLowerCase().includes('welcome')
    );
    if (!ch) {
      ch = await guild.channels.create({
        name: 'newcomer-chat',
        type: ChannelType.GuildText,
      });
    }
  }

  setGuildConfig(guild.id, { welcomeChannel: ch.id, leaveChannel: ch.id });
  return ch;
}

/**
 * 5. Log Moderasi
 */
async function executeSetupModLog(guild) {
  let modLogCh = guild.channels.cache.find((c) => c.name.toLowerCase() === 'mod-log');
  if (!modLogCh) {
    modLogCh = await guild.channels.create({
      name: 'mod-log',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.EmbedLinks,
          ],
        },
      ],
    });
  }

  setModLogChannel(guild.id, modLogCh.id);

  const logEmbed = new EmbedBuilder()
    .setColor(0x2B2D31)
    .setTitle('Log Moderasi Aktif')
    .setDescription(
      `Channel ini telah ditetapkan sebagai pusat catatan keamanan dan moderasi server.\n` +
      `Seluruh aktivitas keamanan, auto-moderasi, dan pelanggaran akan dicatat di channel ini.`
    )
    .setTimestamp();

  await modLogCh.send({ embeds: [logEmbed] });
  return modLogCh;
}

/**
 * Setup Lengkap 1-Klik dengan live progress loading dan finishing embed
 */
async function executeFullSetupWithProgress(guild, progressCallback = null) {
  const update = async (text) => {
    if (typeof progressCallback === 'function') {
      await progressCallback(text).catch(() => {});
    }
  };

  await update('Langkah 1/5: Sedang mendesain kategori dan channel server...');
  const design = await executeDesignServer(guild, update);

  await update('Langkah 2/5: Memasang sistem proteksi verifikasi di #start-here...');
  const verify = await executeSetupVerification(guild, design.chStartHere);

  await update('Langkah 3/5: Membuat tombol pembagian role di #select-roles...');
  const rolePanel = await executeSetupRolePanel(guild, design.chSelectRoles);

  await update('Langkah 4/5: Menghubungkan sistem penyambutan member baru di #newcomer-chat...');
  const welcome = await executeSetupWelcome(guild, design.chNewcomer);

  await update('Langkah 5/5: Mengaktifkan channel keamanan dan log moderasi #mod-log...');
  const modLog = await executeSetupModLog(guild);

  return {
    design,
    verify,
    rolePanel,
    welcome,
    modLog,
  };
}

/**
 * Embed hasil finishing setelah setup selesai
 */
function createFinishingEmbed(result, guild) {
  return new EmbedBuilder()
    .setColor(0x57F287)
    .setTitle('Setup Server Selesai!')
    .setDescription(
      `Semua kategori, channel, sistem verifikasi, role, dan log berhasil dikonfigurasi secara rapi:\n\n` +
      `**Get Started:**\n` +
      `• <#${result.design.chRules.id}> (Rules & Tata Tertib)\n` +
      `• <#${result.design.chStartHere.id}> (Verifikasi Member Baru)\n` +
      `• <#${result.design.chSelectRoles.id}> (Panel Ambil Role Mandiri)\n\n` +
      `**Official:**\n` +
      `• #announcement | #official-event | #social-media | #help-center\n\n` +
      `**Community:**\n` +
      `• <#${result.welcome.id}> (Penyambutan Member Baru)\n` +
      `• #ngobrol | #ngobrol-2 | #media | #levels | #report\n\n` +
      `**Motion Forum Showdown:**\n` +
      `• #announcement | #lobby | #info-scrim\n\n` +
      `**Cinematography & Entertainment:**\n` +
      `• #fotografi | #videografi | #meme | #fanart | #ai-fanart\n` +
      `• <#${result.design.chProdRoom.id}> (Voice Hub: Klik untuk buat voice room pribadi)\n\n` +
      `**Keamanan & Moderasi:**\n` +
      `• <#${result.modLog.id}> (Channel rahasia log keamanan server)`
    )
    .setFooter({ text: `${guild.name} • Setup Wizard Otomatis` })
    .setTimestamp();
}

/**
 * Helper kirim pesan log moderasi ke channel mod-log jika tersedia
 */
async function sendModLog(guild, title, description) {
  try {
    const channelId = getModLogChannel(guild.id);
    if (!channelId) return;
    const channel = guild.channels.cache.get(channelId) || await guild.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle(title)
      .setDescription(description)
      .setTimestamp();

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    console.error('Error sendModLog:', err);
  }
}

module.exports = {
  createSetupWizardPanel,
  executeDesignServer,
  executeSetupVerification,
  executeSetupRolePanel,
  executeSetupWelcome,
  executeSetupModLog,
  executeFullSetupWithProgress,
  createFinishingEmbed,
  getModLogChannel,
  setModLogChannel,
  sendModLog,
};
