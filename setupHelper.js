const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

const { setGuildConfig, getGuildConfig } = require('./welcomeHelper');
const { setVerifConfig, getVerifConfig, applyChannelLockdown } = require('./verifHelper');
const { setupMiniGames, getGameConfig } = require('./gameHelper');
const { setGuildTicketConfig, getGuildTicketConfig } = require('./ticketHelper');
const { enableServerStats, getStatsConfig } = require('./serverStatsHelper');
const { setTempVoiceConfig, getTempVoiceConfig } = require('./tempVoiceHelper');
const { setupAuditLog, getLogConfig } = require('./logHelper');
const { setupHdChannel, getHdConfig } = require('./imageHdHelper');

/**
 * 1. Setup Welcome & Leave Channels
 */
async function setupWelcomeAndLeave(guild) {
  // 1. Cari atau buat Kategori INFORMASI & WELCOME
  let category = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      (c.name.includes('WELCOME') || c.name.includes('INFORMASI') || c.name.includes('INFO'))
  );

  if (!category) {
    category = await guild.channels.create({
      name: '👋・INFORMASI & WELCOME',
      type: ChannelType.GuildCategory,
      reason: 'Auto-setup Welcome & Leave Category',
    });
  }

  const readOnlyOverwrites = [
    {
      id: guild.roles.everyone.id,
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
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  // 2. Cari atau buat channel #welcome
  let welcomeChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      (c.name.includes('welcome') || c.name.includes('sambutan') || c.name.includes('masuk'))
  );

  if (!welcomeChannel) {
    welcomeChannel = await guild.channels.create({
      name: '👋・welcome',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: readOnlyOverwrites,
      reason: 'Auto-setup Welcome Channel',
    });

    const infoEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
      .setTitle(`Selamat Datang di ${guild.name}`)
      .setDescription(
        `Halo semuanya! Channel ini adalah ruang sambutan resmi bagi setiap anggota baru yang bergabung ke server.\n\n` +
        `• Bot akan otomatis menyambut anggota baru dengan kartu sambutan visual.\n` +
        `• Silakan baca informasi dan patuhi peraturan server yang berlaku.`
      )
      .setFooter({ text: `${guild.name} • Sistem Sambutan Otomatis` })
      .setTimestamp();

    await welcomeChannel.send({ embeds: [infoEmbed] }).catch(() => {});
  }

  // 3. Cari atau buat channel #leave
  let leaveChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      (c.name.includes('leave') || c.name.includes('keluar') || c.name.includes('goodbye'))
  );

  if (!leaveChannel) {
    leaveChannel = await guild.channels.create({
      name: '🚪・leave',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: readOnlyOverwrites,
      reason: 'Auto-setup Leave Channel',
    });

    const leaveEmbed = new EmbedBuilder()
      .setColor(0x2b2d31)
      .setTitle(`Log Anggota Keluar • ${guild.name}`)
      .setDescription(
        `Channel ini akan otomatis mencatat riwayat anggota yang meninggalkan server beserta lama waktu bergabung mereka.`
      )
      .setFooter({ text: `${guild.name} • Sistem Notifikasi Keluar` })
      .setTimestamp();

    await leaveChannel.send({ embeds: [leaveEmbed] }).catch(() => {});
  }

  // Simpan konfigurasi
  setGuildConfig(guild.id, {
    welcomeChannel: welcomeChannel.id,
    leaveChannel: leaveChannel.id,
  });

  return {
    category,
    welcomeChannel,
    leaveChannel,
  };
}

/**
 * 2. Setup Verifikasi Akses Server
 */
async function setupVerification(guild) {
  // 1. Cari atau buat Role Member (Terverifikasi)
  let memberRole = guild.roles.cache.find(
    (r) =>
      r.name.toLowerCase() === 'member' ||
      r.name.toLowerCase() === 'verified' ||
      r.name.toLowerCase() === 'warga'
  );

  if (!memberRole) {
    try {
      memberRole = await guild.roles.create({
        name: 'Member',
        color: 0x57f287,
        reason: 'Role otomatis hasil verifikasi server',
      });
    } catch (e) {
      console.warn('Gagal membuat role Member verif:', e.message);
      memberRole = guild.roles.cache.find((r) => r.id !== guild.id && !r.managed);
    }
  }

  // 2. Cari atau buat Kategori VERIFIKASI
  let category = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      (c.name.includes('VERIF') || c.name.includes('GATEWAY') || c.name.includes('WELCOME'))
  );

  if (!category) {
    category = await guild.channels.create({
      name: '🔐・VERIFIKASI',
      type: ChannelType.GuildCategory,
      position: 0,
      reason: 'Auto-setup Kategori Verifikasi',
    });
  }

  // 3. Cari atau buat channel verifikasi
  let verifChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      (c.name.includes('verif') || c.name.includes('verify'))
  );

  const verifOverwrites = [
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ManageRoles,
      ],
    },
  ];

  if (memberRole) {
    // Sembunyikan channel verifikasi dari yang sudah memiliki role verifikasi
    verifOverwrites.push({
      id: memberRole.id,
      deny: [PermissionFlagsBits.ViewChannel],
    });
  }

  if (!verifChannel) {
    verifChannel = await guild.channels.create({
      name: '✅・verifikasi',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: verifOverwrites,
      reason: 'Auto-setup Channel Verifikasi',
    });
  } else {
    // Update permission agar tersembunyi bagi yang sudah verif
    await verifChannel.permissionOverwrites.set(verifOverwrites).catch(() => {});
  }

  // 4. Kirim Panel Verifikasi
  const panelEmbed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
    .setTitle(`Verifikasi Akses Server  •  ${guild.name}`)
    .setDescription(
      `Selamat datang di **${guild.name}**!\n\n` +
      `Seluruh channel di server ini dilindungi untuk kenyamanan dan keamanan komunitas.\n` +
      `Untuk membuka seluruh channel dan mendapatkan role ${memberRole ? `<@&${memberRole.id}>` : '**Member**'}, silakan klik tombol hijau di bawah ini.`
    )
    .addFields(
      { name: 'Role Diterima', value: memberRole ? `<@&${memberRole.id}>` : 'Member', inline: true },
      { name: 'Sistem', value: 'Verifikasi Mandiri 1-Klik', inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
    .setFooter({ text: `${guild.name} • Verifikasi Otomatis FlyBot` })
    .setTimestamp();

  const verifyBtn = new ButtonBuilder()
    .setCustomId('btn_do_verify')
    .setLabel('Verifikasi Sekarang')
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(verifyBtn);

  await verifChannel.send({ embeds: [panelEmbed], components: [row] }).catch(() => {});

  // 5. Simpan konfigurasi verifikasi
  setVerifConfig(guild.id, {
    verifiedRoleId: memberRole ? memberRole.id : null,
    roleId: memberRole ? memberRole.id : null,
    channelId: verifChannel.id,
    enabled: true,
  });

  // 6. Kunci channel lainnya agar tertutup bagi yang belum verifikasi
  let lockedCount = 0;
  if (memberRole) {
    lockedCount = await applyChannelLockdown(guild, {
      verifChannelId: verifChannel.id,
      verifiedRoleId: memberRole.id,
      unverifiedRoleId: null,
    }).catch(() => 0);
  }

  return {
    category,
    channel: verifChannel,
    role: memberRole,
    lockedCount,
  };
}

/**
 * 3. Setup Mini Games Arena
 */
async function setupGames(guild) {
  return await setupMiniGames(guild);
}

/**
 * 4. Setup Support / Tiket Bantuan
 */
async function setupSupportTicket(guild, staffRoleId = null) {
  // 1. Cari atau buat Kategori SUPPORT
  let category = guild.channels.cache.find(
    (c) => c.type === ChannelType.GuildCategory && (c.name.includes('SUPPORT') || c.name.includes('TIKET') || c.name.includes('BANTUAN'))
  );

  if (!category) {
    category = await guild.channels.create({
      name: '🎫・SUPPORT & TIKET',
      type: ChannelType.GuildCategory,
      reason: 'Auto-setup Kategori Support Ticket',
    });
  }

  // 2. Cari atau buat Channel #tiket-bantuan
  let panelChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      (c.name.includes('tiket') || c.name.includes('bantuan') || c.name.includes('support'))
  );

  const panelOverwrites = [
    {
      id: guild.roles.everyone.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
      deny: [PermissionFlagsBits.SendMessages],
    },
    {
      id: guild.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        PermissionFlagsBits.ManageChannels,
      ],
    },
  ];

  if (!panelChannel) {
    panelChannel = await guild.channels.create({
      name: '📩・tiket-bantuan',
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: panelOverwrites,
      reason: 'Auto-setup Channel Tiket Bantuan',
    });
  }

  // 3. Kirim Panel Tiket
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setAuthor({
      name: `${guild.name}  •  Pusat Bantuan`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle('Customer Service & Tiket Bantuan')
    .setDescription(
      `Butuh bantuan teknis, ada kendala, laporan server, atau ingin berdiskusi privat dengan pengelola server?\n\n` +
      `Klik tombol **Buat Tiket** di bawah untuk membuka ruang percakapan privat baru yang hanya bisa dilihat oleh kamu dan Admin/Staff.`
    )
    .addFields(
      { name: 'Privasi', value: 'Khusus Kamu & Staff', inline: true },
      { name: 'Layanan', value: 'Bantuan Privat 24 Jam', inline: true },
    )
    .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
    .setFooter({ text: `${guild.name}  •  Sistem Tiket Otomatis FlyBot` })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('btn_create_ticket')
    .setLabel('Buat Tiket')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  const sentMessage = await panelChannel.send({
    embeds: [embed],
    components: [row],
  });

  // 4. Simpan konfigurasi
  const currentCfg = getGuildTicketConfig(guild.id);
  setGuildTicketConfig(guild.id, {
    panelChannelId: panelChannel.id,
    categoryId: category.id,
    supportRoleId: staffRoleId || currentCfg.supportRoleId || null,
    messageId: sentMessage.id,
    enabled: true,
  });

  return {
    category,
    channel: panelChannel,
  };
}

/**
 * 5. Setup Server Stats Realtime (Voice Channels)
 */
async function setupServerStats(guild) {
  return await enableServerStats(guild);
}

/**
 * 6. Setup Voice Hub (Join-to-Create Voice Room)
 */
async function setupVoiceHub(guild) {
  // 1. Cari atau buat Kategori VOICE LOUNGES
  let category = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildCategory &&
      (c.name.includes('VOICE') || c.name.includes('LOUNGE') || c.name.includes('SUARA'))
  );

  if (!category) {
    category = await guild.channels.create({
      name: '🔊・VOICE LOUNGES',
      type: ChannelType.GuildCategory,
      reason: 'Auto-setup Voice Lounge Category',
    });
  }

  // 2. Cari atau buat voice channel pemicu (+・Buat Room Voice)
  let hubChannel = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildVoice &&
      c.parentId === category.id &&
      (c.name.includes('Buat Room') || c.name.includes('Join to Create') || c.name.includes('➕'))
  );

  if (!hubChannel) {
    hubChannel = await guild.channels.create({
      name: '➕・Buat Room Voice',
      type: ChannelType.GuildVoice,
      parent: category.id,
      permissionOverwrites: [
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
      ],
      reason: 'Auto-setup Trigger Voice Hub',
    });
  }

  // 3. Buat companion text channel untuk ngobrol
  let textChat = guild.channels.cache.find(
    (c) =>
      c.type === ChannelType.GuildText &&
      c.parentId === category.id &&
      (c.name.includes('voice-chat') || c.name.includes('obrolan-voice'))
  );

  if (!textChat) {
    textChat = await guild.channels.create({
      name: '💬・voice-chat',
      type: ChannelType.GuildText,
      parent: category.id,
      reason: 'Auto-setup Voice Text Companion',
    });

    const guideEmbed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`Voice Room Mandiri  •  ${guild.name}`)
      .setDescription(
        `Masuk ke voice channel <#${hubChannel.id}> di atas untuk **otomatis dibuatkan voice room pribadi**!\n\n` +
        `• Kamu mendapatkan hak kelola penuh atas room yang kamu buat.\n` +
        `• Saat semua orang keluar dari room, room tersebut akan otomatis terhapus secara bersih.`
      )
      .setFooter({ text: 'Sistem Voice Room Otomatis' })
      .setTimestamp();

    await textChat.send({ embeds: [guideEmbed] }).catch(() => {});
  }

  // 4. Simpan konfigurasi
  setTempVoiceConfig(guild.id, hubChannel.id, category.id);

  return {
    category,
    hubChannel,
    textChat,
  };
}

/**
 * 7. Setup Audit Log Server
 */
async function setupAuditLogServer(guild) {
  return await setupAuditLog(guild);
}

/**
 * 8. Setup Auto-HD Studio
 */
async function setupHdStudio(guild) {
  return await setupHdChannel(guild);
}

/**
 * 9. Master Setup: ALL IN ONE (Menjalankan semua setup secara otomatis)
 */
async function setupAll(guild) {
  const summary = {
    welcome: null,
    verif: null,
    game: null,
    ticket: null,
    stats: null,
    voice: null,
    log: null,
    hd: null,
    errors: [],
  };

  // 1. Setup Welcome & Leave
  try {
    summary.welcome = await setupWelcomeAndLeave(guild);
  } catch (err) {
    console.error('Error setup welcome:', err);
    summary.errors.push(`Welcome & Leave: ${err.message}`);
  }

  // 2. Setup Verifikasi
  try {
    summary.verif = await setupVerification(guild);
  } catch (err) {
    console.error('Error setup verif:', err);
    summary.errors.push(`Verifikasi: ${err.message}`);
  }

  // 3. Setup Mini Games
  try {
    summary.game = await setupGames(guild);
  } catch (err) {
    console.error('Error setup games:', err);
    summary.errors.push(`Mini Games: ${err.message}`);
  }

  // 4. Setup Support Ticket
  try {
    summary.ticket = await setupSupportTicket(guild);
  } catch (err) {
    console.error('Error setup ticket:', err);
    summary.errors.push(`Support Ticket: ${err.message}`);
  }

  // 5. Setup Server Stats
  try {
    summary.stats = await setupServerStats(guild);
  } catch (err) {
    console.error('Error setup server stats:', err);
    summary.errors.push(`Server Stats: ${err.message}`);
  }

  // 6. Setup Voice Hub
  try {
    summary.voice = await setupVoiceHub(guild);
  } catch (err) {
    console.error('Error setup voice hub:', err);
    summary.errors.push(`Voice Hub: ${err.message}`);
  }

  // 7. Setup Audit Log
  try {
    summary.log = await setupAuditLogServer(guild);
  } catch (err) {
    console.error('Error setup audit log:', err);
    summary.errors.push(`Audit Log: ${err.message}`);
  }

  // 8. Setup HD Studio
  try {
    summary.hd = await setupHdStudio(guild);
  } catch (err) {
    console.error('Error setup HD studio:', err);
    summary.errors.push(`HD Studio: ${err.message}`);
  }

  return summary;
}

module.exports = {
  setupWelcomeAndLeave,
  setupVerification,
  setupGames,
  setupSupportTicket,
  setupServerStats,
  setupVoiceHub,
  setupAuditLogServer,
  setupHdStudio,
  setupAll,
};
