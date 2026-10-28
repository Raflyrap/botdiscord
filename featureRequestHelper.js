const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const DATA_PATH = path.join(__dirname, 'featureRequests.json');

// Default ID Server Official
const DEFAULT_OFFICIAL_GUILD_ID = '1563902604394627074';

function isOfficialGuild(guildId) {
  if (!guildId) return false;
  const officialId = process.env.OFFICIAL_GUILD_ID || DEFAULT_OFFICIAL_GUILD_ID;
  const mainGuildId = process.env.GUILD_ID;
  return guildId === officialId || (!!mainGuildId && guildId === mainGuildId);
}

function loadRequestsData() {
  try {
    if (!fs.existsSync(DATA_PATH)) {
      const initial = { lastId: 0, requests: {}, channelId: null, panelMessageId: null };
      fs.writeFileSync(DATA_PATH, JSON.stringify(initial, null, 2), 'utf8');
      return initial;
    }
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw || '{}');
    if (!parsed.requests) parsed.requests = {};
    if (typeof parsed.lastId !== 'number') parsed.lastId = 0;
    return parsed;
  } catch (err) {
    console.error('[FEATURE REQUEST DATA ERROR]:', err.message);
    return { lastId: 0, requests: {}, channelId: null, panelMessageId: null };
  }
}

function saveRequestsData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[FEATURE REQUEST SAVE ERROR]:', err.message);
  }
}

/**
 * Membuat Embed dan Komponen untuk Panel Utama di Channel Request
 */
function createMainPanelEmbed() {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('Kotak Saran & Request Fitur FlyBot')
    .setDescription(
      `Punya ide atau saran fitur baru untuk pengembangan FlyBot?\n` +
      `Sampaikan usulan kamu langsung di channel ini!\n\n` +
      `**Ketentuan & Cara Kerja:**\n` +
      `• Setiap usulan akan ditinjau langsung oleh tim developer FlyBot.\n` +
      `• Member lain dapat memberikan dukungan suara (voting) menggunakan tombol dukung.\n` +
      `• Bot otomatis menyediakan thread diskusi di setiap usulan agar komunitas bisa berdiskusi.\n\n` +
      `**Cara Mengajukan:**\n` +
      `Klik tombol **Buat Request Fitur** di bawah untuk mengisi formulir usulan kamu.`
    )
    .setFooter({ text: 'FlyBot Official Development • Khusus Server Official' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId('btn_open_request_modal')
    .setLabel('Buat Request Fitur')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  return { embed, row };
}

/**
 * Menghasilkan Modal Form Pengajuan Request Fitur
 */
function createRequestModal() {
  const modal = new ModalBuilder()
    .setCustomId('modal_feature_request_submit')
    .setTitle('Formulir Request Fitur FlyBot');

  const titleInput = new TextInputBuilder()
    .setCustomId('request_title')
    .setLabel('Judul Fitur')
    .setPlaceholder('Contoh: Sistem Notifikasi Jadwal Sholat Otomatis')
    .setStyle(TextInputStyle.Short)
    .setMinLength(5)
    .setMaxLength(100)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('request_desc')
    .setLabel('Penjelasan Ide & Manfaat Fitur')
    .setPlaceholder('Jelaskan cara kerja fitur, perintah yang diinginkan, dan kenapa fitur ini bermanfaat...')
    .setStyle(TextInputStyle.Paragraph)
    .setMinLength(15)
    .setMaxLength(1500)
    .setRequired(true);

  const row1 = new ActionRowBuilder().addComponents(titleInput);
  const row2 = new ActionRowBuilder().addComponents(descInput);

  modal.addComponents(row1, row2);
  return modal;
}

/**
 * Status color mapping
 */
function getStatusColor(status) {
  switch (status) {
    case 'Diterima':
      return 0x57F287; // Green
    case 'Sedang Dikerjakan':
      return 0xFEE75C; // Yellow
    case 'Selesai & Dirilis':
      return 0x2ECC71; // Dark Green
    case 'Ditolak':
      return 0xED4245; // Red
    default:
      return 0x5865F2; // Blurple (Menunggu Review)
  }
}

/**
 * Membuat Embed dan Tombol Aksi untuk Kartu Usulan Fitur
 */
function createRequestCard(req) {
  const votesCount = Array.isArray(req.votes) ? req.votes.length : 0;
  const color = getStatusColor(req.status);

  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({
      name: `${req.authorTag || 'Member FlyBot'}`,
      iconURL: req.authorAvatar || undefined,
    })
    .setTitle(`[#REQ-${req.id}] ${req.title}`)
    .setDescription(`>>> ${req.description}`)
    .addFields(
      { name: 'Status', value: `**${req.status}**`, inline: true },
      { name: 'Dukungan Komunitas', value: `**${votesCount} Suara**`, inline: true },
      { name: 'Pengusul', value: `<@${req.authorId}>`, inline: true }
    )
    .setFooter({ text: 'Gunakan tombol di bawah untuk memberikan dukungan atau mengelola usulan' })
    .setTimestamp(req.createdAt ? new Date(req.createdAt) : new Date());

  const voteBtn = new ButtonBuilder()
    .setCustomId(`btn_req_vote_${req.id}`)
    .setLabel(`Dukung Fitur (${votesCount})`)
    .setStyle(ButtonStyle.Success);

  const statusBtn = new ButtonBuilder()
    .setCustomId(`btn_req_status_${req.id}`)
    .setLabel('Kelola Status')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(voteBtn, statusBtn);

  return { embed, row };
}

/**
 * Memastikan channel request-fitur dan panelnya tersedia di Server Official
 * @param {import('discord.js').Client} client
 */
async function ensureFeatureRequestChannel(client) {
  try {
    const officialGuildId = process.env.OFFICIAL_GUILD_ID || DEFAULT_OFFICIAL_GUILD_ID;
    const guild = client.guilds.cache.get(officialGuildId) || (await client.guilds.fetch(officialGuildId).catch(() => null));
    if (!guild) return null;

    const data = loadRequestsData();

    // 1. Cari kategori atau buat
    let category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && (c.name.toLowerCase().includes('feedback') || c.name.toLowerCase().includes('request') || c.name.toLowerCase().includes('informasi'))
    );

    // 2. Cari channel request-fitur
    let reqChannel = null;
    if (data.channelId) {
      reqChannel = guild.channels.cache.get(data.channelId) || (await guild.channels.fetch(data.channelId).catch(() => null));
    }

    if (!reqChannel) {
      reqChannel = guild.channels.cache.find(
        (c) => c.type === ChannelType.GuildText && c.name.toLowerCase() === 'request-fitur'
      );
    }

    if (!reqChannel) {
      reqChannel = await guild.channels.create({
        name: 'request-fitur',
        type: ChannelType.GuildText,
        parent: category ? category.id : null,
        topic: 'Channel khusus request fitur dan voting fitur baru FlyBot (Khusus Server Official)',
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.SendMessagesInThreads,
              PermissionFlagsBits.CreatePublicThreads,
            ],
          },
        ],
        reason: 'Setup channel request fitur server official',
      });
      console.log(`[FEATURE REQUEST] Channel #${reqChannel.name} berhasil dibuat di server official.`);
    }

    data.channelId = reqChannel.id;

    // 3. Pastikan Pinned Panel Utama Ada
    const { embed, row } = createMainPanelEmbed();
    let panelMsg = null;

    if (data.panelMessageId) {
      panelMsg = await reqChannel.messages.fetch(data.panelMessageId).catch(() => null);
    }

    if (panelMsg) {
      await panelMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
    } else {
      // Periksa pesan pin yang sudah ada
      let existingPin = null;
      try {
        const pinnedMessages = await reqChannel.messages.fetchPinned().catch(() => null);
        if (pinnedMessages) {
          const list = Array.from(pinnedMessages.values ? pinnedMessages.values() : pinnedMessages);
          existingPin = list.find((m) => m.author?.id === client.user.id && m.embeds?.[0]?.title?.includes('Kotak Saran'));
        }
      } catch (pinErr) {}

      if (existingPin) {
        panelMsg = existingPin;
        await panelMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
      } else {
        panelMsg = await reqChannel.send({ embeds: [embed], components: [row] });
        await panelMsg.pin().catch(() => {});
      }
      data.panelMessageId = panelMsg.id;
    }

    saveRequestsData(data);
    return reqChannel;
  } catch (err) {
    console.error('[FEATURE REQUEST ENSURE ERROR]:', err.message);
    return null;
  }
}

/**
 * Handler Modal Submit Pengajuan Usulan Fitur
 */
async function handleFeatureRequestModal(interaction) {
  if (!interaction.isModalSubmit() || interaction.customId !== 'modal_feature_request_submit') {
    return false;
  }

  if (!isOfficialGuild(interaction.guildId)) {
    return interaction.reply({
      content: 'Fitur request fitur hanya tersedia di server official FlyBot.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const title = interaction.fields.getTextInputValue('request_title').trim();
  const desc = interaction.fields.getTextInputValue('request_desc').trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const data = loadRequestsData();
  const newId = (data.lastId || 0) + 1;
  data.lastId = newId;

  const reqItem = {
    id: newId,
    title: title,
    description: desc,
    authorId: interaction.user.id,
    authorTag: interaction.user.tag || interaction.user.username,
    authorAvatar: interaction.user.displayAvatarURL(),
    guildId: interaction.guildId,
    status: 'Menunggu Review',
    votes: [interaction.user.id], // Pengusul otomatis memberi 1 dukungan awal
    createdAt: Date.now(),
    messageId: null,
    threadId: null,
  };

  const { embed, row } = createRequestCard(reqItem);

  let targetChannel = interaction.channel;
  if (!targetChannel || targetChannel.name !== 'request-fitur') {
    if (data.channelId) {
      targetChannel = interaction.guild.channels.cache.get(data.channelId) || (await interaction.guild.channels.fetch(data.channelId).catch(() => null));
    }
  }

  if (!targetChannel) {
    return interaction.editReply({
      content: 'Gagal mengirim usulan karena channel request-fitur tidak ditemukan.',
    });
  }

  const sentMessage = await targetChannel.send({
    embeds: [embed],
    components: [row],
  });

  reqItem.messageId = sentMessage.id;
  reqItem.channelId = targetChannel.id;

  // Buat Thread Diskusi Otomatis
  try {
    const threadName = `Diskusi REQ-${newId}: ${title}`.slice(0, 95);
    const thread = await sentMessage.startThread({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: `Thread diskusi untuk usulan fitur #${newId}`,
    });
    reqItem.threadId = thread.id;

    await thread.send({
      content:
        `Thread diskusi resmi untuk usulan fitur **#REQ-${newId}** dari <@${interaction.user.id}>.\n` +
        `Silakan berikan tanggapan, ide pengembangan, atau saran tambahan di sini.`,
    });
  } catch (threadErr) {
    console.warn('[FEATURE REQUEST THREAD WARN]:', threadErr.message);
  }

  data.requests[newId] = reqItem;
  saveRequestsData(data);

  return interaction.editReply({
    content: `Usulan fitur kamu berhasil diajukan dengan ID #REQ-${newId}! Cek channel <#${targetChannel.id}> untuk melihat kartu usulan kamu.`,
  });
}

/**
 * Handler Voting Dukungan Fitur
 */
async function handleFeatureRequestVote(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('btn_req_vote_')) {
    return false;
  }

  const reqId = parseInt(interaction.customId.replace('btn_req_vote_', ''), 10);
  const data = loadRequestsData();
  const reqItem = data.requests[reqId];

  if (!reqItem) {
    return interaction.reply({
      content: 'Data usulan fitur ini tidak ditemukan dalam sistem.',
      flags: MessageFlags.Ephemeral,
    });
  }

  if (!Array.isArray(reqItem.votes)) {
    reqItem.votes = [];
  }

  const userId = interaction.user.id;
  const alreadyVoted = reqItem.votes.includes(userId);

  if (alreadyVoted) {
    // Cabut vote
    reqItem.votes = reqItem.votes.filter((id) => id !== userId);
    saveRequestsData(data);

    const { embed, row } = createRequestCard(reqItem);
    await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});

    return interaction.reply({
      content: 'Dukungan suara kamu telah dicabut dari usulan fitur ini.',
      flags: MessageFlags.Ephemeral,
    });
  } else {
    // Tambah vote
    reqItem.votes.push(userId);
    saveRequestsData(data);

    const { embed, row } = createRequestCard(reqItem);
    await interaction.message.edit({ embeds: [embed], components: [row] }).catch(() => {});

    return interaction.reply({
      content: 'Terima kasih! Dukungan suara kamu berhasil ditambahkan ke usulan fitur ini.',
      flags: MessageFlags.Ephemeral,
    });
  }
}

/**
 * Handler Kelola Status Usulan (Khusus Admin / Tim Developer)
 */
async function handleFeatureRequestStatusButton(interaction) {
  if (!interaction.isButton() || !interaction.customId.startsWith('btn_req_status_')) {
    return false;
  }

  const isOwner = interaction.user.id === process.env.OWNER_ID;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: 'Hanya Administrator atau tim developer yang memiliki akses untuk mengubah status usulan fitur.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const reqId = parseInt(interaction.customId.replace('btn_req_status_', ''), 10);
  const data = loadRequestsData();
  const reqItem = data.requests[reqId];

  if (!reqItem) {
    return interaction.reply({
      content: 'Data usulan fitur tidak ditemukan.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`select_req_status_${reqId}`)
    .setPlaceholder('Pilih status baru untuk usulan ini...')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Menunggu Review')
        .setDescription('Usulan sedang dalam antrean evaluasi')
        .setValue('Menunggu Review'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Diterima')
        .setDescription('Usulan disetujui dan masuk rencana pengembangan')
        .setValue('Diterima'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Sedang Dikerjakan')
        .setDescription('Fitur sedang aktif dalam tahap pengerjaan (coding)')
        .setValue('Sedang Dikerjakan'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Selesai & Dirilis')
        .setDescription('Fitur telah selesai dibuat dan sudah aktif di bot')
        .setValue('Selesai & Dirilis'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Ditolak')
        .setDescription('Usulan belum dapat diimplementasikan saat ini')
        .setValue('Ditolak')
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return interaction.reply({
    content: `Silakan pilih status baru untuk usulan **#REQ-${reqId}: ${reqItem.title}**:`,
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handler Pemilihan Status dari Select Menu
 */
async function handleFeatureRequestStatusSelect(interaction) {
  if (!interaction.isStringSelectMenu() || !interaction.customId.startsWith('select_req_status_')) {
    return false;
  }

  const isOwner = interaction.user.id === process.env.OWNER_ID;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);

  if (!isOwner && !isAdmin) {
    return interaction.reply({
      content: 'Hanya Administrator atau tim developer yang dapat mengubah status.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const reqId = parseInt(interaction.customId.replace('select_req_status_', ''), 10);
  const newStatus = interaction.values[0];

  const data = loadRequestsData();
  const reqItem = data.requests[reqId];

  if (!reqItem) {
    return interaction.reply({
      content: 'Data usulan tidak ditemukan.',
      flags: MessageFlags.Ephemeral,
    });
  }

  const oldStatus = reqItem.status;
  reqItem.status = newStatus;
  saveRequestsData(data);

  // Update kartu pesan asli
  try {
    const channel = interaction.guild.channels.cache.get(reqItem.channelId) || (await interaction.guild.channels.fetch(reqItem.channelId).catch(() => null));
    if (channel && reqItem.messageId) {
      const msg = await channel.messages.fetch(reqItem.messageId).catch(() => null);
      if (msg) {
        const { embed, row } = createRequestCard(reqItem);
        await msg.edit({ embeds: [embed], components: [row] });
      }
    }
  } catch (updateErr) {
    console.warn('[FEATURE REQUEST CARD UPDATE WARN]:', updateErr.message);
  }

  // Kirim notifikasi ke thread diskusi jika ada
  try {
    if (reqItem.threadId) {
      const thread = interaction.guild.channels.cache.get(reqItem.threadId) || (await interaction.guild.channels.fetch(reqItem.threadId).catch(() => null));
      if (thread) {
        await thread.send({
          content: `Pemberitahuan: Status usulan fitur telah diubah dari **${oldStatus}** menjadi **${newStatus}** oleh <@${interaction.user.id}>.`,
        });
      }
    }
  } catch (threadNoticeErr) {
    console.warn('[FEATURE REQUEST THREAD NOTICE WARN]:', threadNoticeErr.message);
  }

  return interaction.update({
    content: `Status usulan **#REQ-${reqId}** berhasil diperbarui menjadi **${newStatus}**.`,
    components: [],
  });
}

/**
 * Handler jika ada member mengirim pesan teks langsung di channel request-fitur
 * Pesan teks otomatis dikonversi menjadi kartu usulan resmi dan pesan aslinya dihapus
 * @param {import('discord.js').Message} message
 */
async function handleRawMessageInRequestChannel(message) {
  if (!message || message.author.bot || !message.guild) return false;
  if (!isOfficialGuild(message.guild.id)) return false;

  const data = loadRequestsData();
  const isTargetChannel = (data.channelId && message.channel.id === data.channelId) || message.channel.name.toLowerCase() === 'request-fitur';
  if (!isTargetChannel) return false;

  // Jangan sentuh pesan di dalam thread
  if (message.channel.isThread()) return false;

  const content = message.content.trim();
  if (content.length < 10) {
    await message.delete().catch(() => {});
    const tempReply = await message.channel.send({
      content: `<@${message.author.id}>, untuk mengajukan request fitur silakan gunakan tombol **Buat Request Fitur** pada panel di atas atau tuliskan penjelasan usulan kamu secara detail minimal 10 karakter.`,
    });
    setTimeout(() => tempReply.delete().catch(() => {}), 8000);
    return true;
  }

  // Pisahkan baris pertama sebagai judul jika ada
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  let title = lines[0].slice(0, 95);
  let desc = lines.length > 1 ? lines.slice(1).join('\n') : content;
  if (title.length < 5) title = `Usulan dari ${message.author.username}`;

  // Hapus pesan teks asli agar channel tetap rapi
  await message.delete().catch(() => {});

  const newId = (data.lastId || 0) + 1;
  data.lastId = newId;

  const reqItem = {
    id: newId,
    title: title,
    description: desc,
    authorId: message.author.id,
    authorTag: message.author.tag || message.author.username,
    authorAvatar: message.author.displayAvatarURL(),
    guildId: message.guild.id,
    status: 'Menunggu Review',
    votes: [message.author.id],
    createdAt: Date.now(),
    messageId: null,
    threadId: null,
  };

  const { embed, row } = createRequestCard(reqItem);
  const sentMessage = await message.channel.send({
    embeds: [embed],
    components: [row],
  });

  reqItem.messageId = sentMessage.id;
  reqItem.channelId = message.channel.id;

  try {
    const threadName = `Diskusi REQ-${newId}: ${title}`.slice(0, 95);
    const thread = await sentMessage.startThread({
      name: threadName,
      autoArchiveDuration: 1440,
      reason: `Thread diskusi usulan #${newId}`,
    });
    reqItem.threadId = thread.id;

    await thread.send({
      content:
        `Thread diskusi resmi untuk usulan fitur **#REQ-${newId}** dari <@${message.author.id}>.\n` +
        `Silakan berikan tanggapan, ide perbaikan, atau saran tambahan di sini.`,
    });
  } catch (err) {
    console.warn('[FEATURE REQUEST THREAD WARN]:', err.message);
  }

  data.requests[newId] = reqItem;
  saveRequestsData(data);
  return true;
}

module.exports = {
  isOfficialGuild,
  ensureFeatureRequestChannel,
  createRequestModal,
  handleFeatureRequestModal,
  handleFeatureRequestVote,
  handleFeatureRequestStatusButton,
  handleFeatureRequestStatusSelect,
  handleRawMessageInRequestChannel,
};
