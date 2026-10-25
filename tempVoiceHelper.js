const fs = require('fs');
const path = require('path');
const {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  MessageFlags,
} = require('discord.js');

const configPath = path.join(__dirname, 'tempVoiceConfig.json');
const roomsPath = path.join(__dirname, 'tempVoiceRooms.json');

// Membaca file konfigurasi (hub & category)
function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error membaca tempVoiceConfig.json:', error);
    return {};
  }
}

// Menyimpan konfigurasi
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan tempVoiceConfig.json:', error);
  }
}

function getTempVoiceConfig(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

function setTempVoiceConfig(guildId, hubChannelId, categoryId) {
  const config = loadConfig();
  config[guildId] = { hubChannelId, categoryId };
  saveConfig(config);
  return config[guildId];
}

// Membaca daftar room sementara yang aktif
function loadRooms() {
  try {
    if (!fs.existsSync(roomsPath)) {
      fs.writeFileSync(roomsPath, JSON.stringify({}, null, 2));
      return new Map();
    }
    const data = fs.readFileSync(roomsPath, 'utf-8');
    const parsed = JSON.parse(data || '{}');
    const map = new Map();
    for (const [key, val] of Object.entries(parsed)) {
      map.set(key, {
        ...val,
        allowedUserIds: new Set(val.allowedUserIds || []),
        blockedUserIds: new Set(val.blockedUserIds || []),
      });
    }
    return map;
  } catch (err) {
    console.error('Error membaca tempVoiceRooms.json:', err);
    return new Map();
  }
}

// Menyimpan daftar room sementara
function saveRooms(map) {
  try {
    const obj = {};
    for (const [key, val] of map.entries()) {
      obj[key] = {
        ...val,
        allowedUserIds: Array.from(val.allowedUserIds || []),
        blockedUserIds: Array.from(val.blockedUserIds || []),
      };
    }
    fs.writeFileSync(roomsPath, JSON.stringify(obj, null, 2));
  } catch (err) {
    console.error('Error menyimpan tempVoiceRooms.json:', err);
  }
}

// Map memori untuk room sementara yang sedang aktif
const activeTempChannels = loadRooms();

function saveActiveRooms() {
  saveRooms(activeTempChannels);
}

// Helper: Membuat Tampilan Embed Panel Kontrol Voice Room
function createControlPanelEmbed(roomData, guild) {
  const isLocked = !!roomData.isLocked;
  const isHidden = !!roomData.isHidden;
  const userLimit = roomData.userLimit || 0;

  return new EmbedBuilder()
    .setColor(isLocked ? 0xed4245 : 0x5865f2)
    .setAuthor({
      name: 'Voice Room Manager',
      iconURL: guild.iconURL({ dynamic: true }) || undefined,
    })
    .setTitle(`Ruang Suara: ${roomData.baseName}`)
    .setDescription(
      `Gunakan tombol navigasi di bawah untuk mengelola ruang suara ini.\n\n` +
      `**Status Ruang**\n` +
      `• Akses: **${isLocked ? 'Privat (Terkunci)' : 'Publik (Terbuka)'}**\n` +
      `• Visibilitas: **${isHidden ? 'Tersembunyi' : 'Terlihat'}**\n` +
      `• Batas Member: **${userLimit === 0 ? 'Tanpa Batas' : `${userLimit} Anggota`}**\n` +
      `• Pemilik: <@${roomData.ownerId}>\n\n` +
      `*Ruang suara ini akan otomatis dihapus jika seluruh anggota telah keluar.*`
    )
    .setFooter({ text: `${guild.name}` })
    .setTimestamp();
}

// Helper: Membuat Komponen Tombol Panel Kontrol
function createControlPanelComponents(roomData) {
  const isLocked = !!roomData.isLocked;
  const isHidden = !!roomData.isHidden;

  // Baris 1: Akses & Visibilitas
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_vc_lock')
      .setLabel('Kunci Room')
      .setStyle(isLocked ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_unlock')
      .setLabel('Buka Room')
      .setStyle(!isLocked ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_hide')
      .setLabel('Sembunyikan')
      .setStyle(isHidden ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_unhide')
      .setLabel('Tampilkan')
      .setStyle(!isHidden ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  // Baris 2: Pengaturan Anggota (Tanpa Ubah Nama)
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_vc_limit')
      .setLabel('Batas Member')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_permit')
      .setLabel('Izinkan Teman')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('btn_vc_kick')
      .setLabel('Keluarkan Member')
      .setStyle(ButtonStyle.Danger)
  );

  // Baris 3: Manajemen & Kontrol
  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_vc_mute_all')
      .setLabel('Mute Semua')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_transfer')
      .setLabel('Alihkan Host')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('btn_vc_delete')
      .setLabel('Hapus Room')
      .setStyle(ButtonStyle.Danger)
  );

  return [row1, row2, row3];
}

// Helper: Menerapkan Hak Akses / Permission Overwrites ke Voice Channel
async function applyRoomPermissions(channel, roomData, guild) {
  const overwrites = [];

  // 1. @everyone Role
  if (roomData.isLocked) {
    overwrites.push({
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.Connect],
      allow: roomData.isHidden ? [] : [PermissionFlagsBits.ViewChannel],
    });
  } else {
    overwrites.push({
      id: guild.roles.everyone.id,
      allow: roomData.isHidden
        ? [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
        : [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
      deny: roomData.isHidden ? [PermissionFlagsBits.ViewChannel] : [],
    });
  }

  // 2. Pemilik Room (Host)
  overwrites.push({
    id: roomData.ownerId,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
    ],
  });

  // 3. Client Bot (Selalu bisa masuk & kelola)
  overwrites.push({
    id: guild.client.user.id,
    allow: [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.Connect,
      PermissionFlagsBits.Speak,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.MoveMembers,
    ],
  });

  // 4. Teman yang di-whitelist (Diberi izin akses connect)
  if (roomData.allowedUserIds) {
    for (const allowedId of roomData.allowedUserIds) {
      if (allowedId === roomData.ownerId) continue;
      overwrites.push({
        id: allowedId,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
          PermissionFlagsBits.Speak,
        ],
      });
    }
  }

  // 5. User yang di-blokir / kick
  if (roomData.blockedUserIds) {
    for (const blockedId of roomData.blockedUserIds) {
      overwrites.push({
        id: blockedId,
        deny: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.Connect,
        ],
      });
    }
  }

  await channel.permissionOverwrites.set(overwrites).catch((err) => {
    console.warn('[TEMP VOICE] Gagal update permission overwrites voice channel:', err.message);
  });
}

// Helper: Update Pesan Panel Kontrol di Chat Voice Room
async function updatePanelMessage(voiceChannel, roomData, guild) {
  const targetId = roomData.channelId || voiceChannel?.id;
  const panelMsgId = roomData.panelMessageId || roomData.voicePanelMessageId;
  if (!targetId || !panelMsgId) return;

  const embed = createControlPanelEmbed(roomData, guild);
  const components = createControlPanelComponents(roomData);

  try {
    const vCh = voiceChannel || guild.channels.cache.get(targetId) || await guild.channels.fetch(targetId).catch(() => null);
    if (vCh) {
      const vMsg = await vCh.messages.fetch(panelMsgId).catch(() => null);
      if (vMsg) {
        await vMsg.edit({ embeds: [embed], components: components }).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[TEMP VOICE] Gagal memperbarui pesan panel voice:', err.message);
  }
}

// Handler event voiceStateUpdate untuk Join-to-Create dan auto-delete voice channel sementara
async function handleVoiceStateUpdate(oldState, newState) {
  const guild = newState.guild || oldState.guild;
  if (!guild) return;

  const config = getTempVoiceConfig(guild.id);
  const hubChannelId = config?.hubChannelId;
  const joinedChannel = newState.channel || (newState.channelId ? await guild.channels.fetch(newState.channelId).catch(() => null) : null);
  const chNameLower = joinedChannel?.name?.toLowerCase() || '';

  const isTriggerChannel =
    (hubChannelId && newState.channelId === hubChannelId) ||
    chNameLower.includes('buat room') ||
    chNameLower.includes('join to create') ||
    chNameLower.startsWith('➕');

  // 1. Jika user bergabung ke channel trigger (➕︱Buat Room Voice) di server mana pun
  if (isTriggerChannel && newState.channelId) {
    const member = newState.member;
    if (!member) return;
    const rawParentId = joinedChannel?.parentId || config?.categoryId;

    // Simpan konfigurasi hub channel secara otomatis jika belum tersimpan
    if (!hubChannelId || hubChannelId !== newState.channelId) {
      setTempVoiceConfig(guild.id, newState.channelId, rawParentId);
    }

    try {
      // Pastikan kategori induk dapat dilihat oleh member pembuat room & everyone
      let validParentId = null;
      if (rawParentId) {
        const cat = guild.channels.cache.get(rawParentId) || await guild.channels.fetch(rawParentId).catch(() => null);
        if (cat && cat.type === ChannelType.GuildCategory) {
          validParentId = cat.id;
          await cat.permissionOverwrites.edit(member.id, {
            ViewChannel: true,
          }).catch(() => {});
          await cat.permissionOverwrites.edit(guild.roles.everyone.id, {
            ViewChannel: true,
          }).catch(() => {});
        }
      }

      const baseName = member.displayName || member.user.username;
      const channelName = `${baseName}'s Lounge`;

      // Overwrites untuk voice channel (Gunakan permission dasar agar tidak ditolak Discord jika bot bukan Admin)
      const voiceOverwrites = [
        {
          id: guild.roles.everyone.id,
          allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ViewChannel],
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ViewChannel,
          ],
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.MoveMembers,
          ],
        },
      ];

      // A. Buat voice channel baru untuk member tersebut dengan fallback
      let tempChannel = null;
      try {
        tempChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
          parent: validParentId,
          permissionOverwrites: voiceOverwrites,
        });
      } catch (err) {
        console.warn('[TEMP VOICE] Gagal buat voice channel dengan parent/overwrites, mencoba fallback:', err.message);
        tempChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildVoice,
        });
      }

      // B. Simpan data room baru (Panel kontrol langsung di dalam chat voice channel)
      const roomData = {
        channelId: tempChannel.id,
        textChannelId: null,
        guildId: guild.id,
        ownerId: member.id,
        isLocked: false,
        isHidden: false,
        baseName: baseName,
        userLimit: 0,
        allowedUserIds: new Set([member.id]),
        blockedUserIds: new Set(),
        panelMessageId: null,
      };

      activeTempChannels.set(tempChannel.id, roomData);
      saveActiveRooms();

      // C. Pindahkan user ke voice channel yang baru dibuat
      await member.voice.setChannel(tempChannel).catch((err) => {
        console.warn('[TEMP VOICE] Gagal memindahkan user ke temp channel baru:', err.message);
      });
      console.log(`[TEMP VOICE] Dibuat: ${channelName} untuk ${member.user.tag}`);

      // D. Kirim panel kontrol interaktif langsung ke dalam obrolan teks room voice (Chat Voice)
      const panelMsg = await tempChannel.send({
        content: `Halo <@${member.id}>, gunakan panel kontrol di bawah ini untuk mengatur room suara kamu:`,
        embeds: [createControlPanelEmbed(roomData, guild)],
        components: createControlPanelComponents(roomData),
      }).catch((err) => {
        console.warn('[TEMP VOICE] Gagal mengirim pesan panel ke voice channel chat:', err.message);
        return null;
      });

      if (panelMsg) {
        roomData.panelMessageId = panelMsg.id;
        saveActiveRooms();
      }
    } catch (error) {
      console.error('Error saat membuat temp voice channel:', error);
    }
  }

  // 2. Jika user meninggalkan voice channel sementara (Otomatis hilang jika kosong)
  if (oldState.channelId) {
    let targetRoomId = null;
    let targetRoomData = null;

    for (const [vId, rData] of activeTempChannels.entries()) {
      if (vId === oldState.channelId) {
        targetRoomId = vId;
        targetRoomData = rData;
        break;
      }
    }

    if (targetRoomData) {
      const oldChannel = oldState.channel || (oldState.channelId ? await guild.channels.fetch(oldState.channelId).catch(() => null) : null);
      if (oldChannel && oldChannel.members?.size === 0) {
        try {
          activeTempChannels.delete(targetRoomId);
          saveActiveRooms();

          // 1. Hapus channel teks kontrol-voice otomatis
          if (targetRoomData.textChannelId) {
            const txtCh = guild.channels.cache.get(targetRoomData.textChannelId) || await guild.channels.fetch(targetRoomData.textChannelId).catch(() => null);
            if (txtCh) await txtCh.delete('Voice room telah kosong').catch(() => {});
          }

          // 2. Hapus voice channel otomatis
          await oldChannel.delete('Voice room sementara telah kosong').catch(() => {});
          console.log(`[TEMP VOICE] Dihapus otomatis: ${oldChannel.name} beserta channel kontrol-voice (karena sudah kosong)`);
        } catch (error) {
          console.error('Error saat menghapus temp voice channel kosong:', error);
        }
      }
    }
  }
}

// Handler jika voice channel dihapus secara manual, bersihkan juga channel teksnya
async function handleChannelDelete(deletedChannel) {
  for (const [vId, rData] of activeTempChannels.entries()) {
    if (vId === deletedChannel.id) {
      activeTempChannels.delete(vId);
      saveActiveRooms();
      if (rData.textChannelId) {
        const txtCh = deletedChannel.guild?.channels.cache.get(rData.textChannelId);
        if (txtCh) await txtCh.delete('Voice channel telah dihapus').catch(() => {});
      }
      break;
    }
  }
}

// Handler interaksi UI (Button, Modal, SelectMenu) untuk kontrol room suara
async function handleVoiceControlInteraction(interaction) {
  const customId = interaction.customId;
  if (!customId) return false;

  const isVoiceButton = [
    'btn_vc_lock',
    'btn_vc_unlock',
    'btn_vc_hide',
    'btn_vc_unhide',
    'btn_vc_rename',
    'btn_vc_limit',
    'btn_vc_permit',
    'btn_vc_kick',
    'btn_vc_mute_all',
    'btn_vc_transfer',
    'btn_vc_delete',
  ].includes(customId);

  const isVoiceModal = ['modal_vc_rename', 'modal_vc_limit'].includes(customId);
  const isVoiceSelect = ['select_vc_permit', 'select_vc_kick', 'select_vc_transfer'].includes(customId);

  if (!isVoiceButton && !isVoiceModal && !isVoiceSelect) {
    return false;
  }

  // Cari room terkait baik dari interaction channelId maupun voice channelId
  let roomData = null;
  for (const [, r] of activeTempChannels.entries()) {
    if (r.channelId === interaction.channelId || r.textChannelId === interaction.channelId) {
      roomData = r;
      break;
    }
  }

  if (!roomData && interaction.member?.voice?.channelId) {
    roomData = activeTempChannels.get(interaction.member.voice.channelId);
  }

  if (!roomData) {
    await interaction.reply({
      content: 'Room suara ini sudah tidak aktif atau sudah ditutup.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  const voiceChannel = interaction.guild.channels.cache.get(roomData.channelId);
  if (!voiceChannel) {
    activeTempChannels.delete(roomData.channelId);
    saveActiveRooms();
    if (roomData.textChannelId) {
      const txtCh = interaction.guild.channels.cache.get(roomData.textChannelId);
      if (txtCh) txtCh.delete().catch(() => {});
    }
    await interaction.reply({
      content: 'Channel room tidak ditemukan di server.',
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // Verifikasi Hak Kontrol: Hanya Pemilik Room (Host), Owner Server, atau Administrator
  const isOwner = interaction.user.id === roomData.ownerId;
  const isGuildOwner = interaction.user.id === interaction.guild.ownerId;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) || false;

  if (!isOwner && !isGuildOwner && !isAdmin) {
    await interaction.reply({
      content: `Hanya pembuat room (<@${roomData.ownerId}>) atau Administrator yang dapat mengatur room ini.`,
      flags: MessageFlags.Ephemeral,
    });
    return true;
  }

  // === 1. BUTTON INTERACTIONS ===
  if (interaction.isButton()) {
    // A. Kunci Room (Privat)
    if (customId === 'btn_vc_lock') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (roomData.isLocked) {
        return interaction.editReply({ content: 'Room sudah dalam keadaan terkunci (Privat).' });
      }

      roomData.isLocked = true;
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: 'Room berhasil dikunci (Privat). Hanya kamu, Owner server, dan teman terdaftar yang dapat bergabung.',
      });
    }

    // B. Buka Room (Publik)
    if (customId === 'btn_vc_unlock') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!roomData.isLocked) {
        return interaction.editReply({ content: 'Room sudah dalam keadaan terbuka (Publik).' });
      }

      roomData.isLocked = false;
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: 'Room berhasil dibuka (Publik). Semua anggota server sekarang dapat bergabung.',
      });
    }

    // C. Sembunyikan Room
    if (customId === 'btn_vc_hide') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (roomData.isHidden) {
        return interaction.editReply({ content: 'Room sudah dalam keadaan tersembunyi.' });
      }

      roomData.isHidden = true;
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: 'Room berhasil disembunyikan dari daftar saluran server.',
      });
    }

    // D. Tampilkan Room
    if (customId === 'btn_vc_unhide') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      if (!roomData.isHidden) {
        return interaction.editReply({ content: 'Room sudah dalam keadaan terlihat di daftar saluran.' });
      }

      roomData.isHidden = false;
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: 'Room berhasil ditampilkan kembali di daftar saluran server.',
      });
    }

    // F. Batasi Jumlah Member (Buka Modal langsung)
    if (customId === 'btn_vc_limit') {
      const modal = new ModalBuilder()
        .setCustomId('modal_vc_limit')
        .setTitle('Batas Maksimal Member');

      const limitInput = new TextInputBuilder()
        .setCustomId('vc_limit_input')
        .setLabel('Jumlah Member (0 = Tanpa Batas, Maks 99)')
        .setStyle(TextInputStyle.Short)
        .setValue(String(roomData.userLimit || 0))
        .setPlaceholder('0 - 99 (Contoh: 2 untuk Duo, 5 untuk Squad)')
        .setMaxLength(2)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
      return interaction.showModal(modal);
    }

    // G. Izinkan Teman (User Select Menu)
    if (customId === 'btn_vc_permit') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('select_vc_permit')
        .setPlaceholder('Pilih teman yang ingin diizinkan join...')
        .setMinValues(1)
        .setMaxValues(5);

      const row = new ActionRowBuilder().addComponents(userSelect);
      return interaction.reply({
        content: '**Izinkan Teman Bergabung (Whitelist)**\nPilih hingga 5 teman untuk diberi izin masuk meskipun room dalam keadaan dikunci:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // H. Kick / Blokir Member (User Select Menu)
    if (customId === 'btn_vc_kick') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('select_vc_kick')
        .setPlaceholder('Pilih member yang ingin dikeluarkan/diblokir...')
        .setMinValues(1)
        .setMaxValues(5);

      const row = new ActionRowBuilder().addComponents(userSelect);
      return interaction.reply({
        content: '**Keluarkan & Blokir Member**\nPilih member yang ingin kamu keluarkan dari room dan dicegah masuk kembali:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // I. Mute Semua Member (Speaker Mode)
    if (customId === 'btn_vc_mute_all') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      let count = 0;
      for (const [, voiceMember] of voiceChannel.members) {
        if (voiceMember.id !== roomData.ownerId && voiceMember.id !== interaction.client.user.id) {
          const currentlyMuted = voiceMember.voice.serverMute;
          await voiceMember.voice.setMute(!currentlyMuted).catch(() => {});
          count++;
        }
      }

      return interaction.editReply({
        content: `**Mode Hening Diperbarui**\nBerhasil mengubah status mikrofon untuk **${count} member** di dalam room ini.`,
      });
    }

    // J. Transfer Host (User Select Menu)
    if (customId === 'btn_vc_transfer') {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId('select_vc_transfer')
        .setPlaceholder('Pilih member untuk menjadi pemilik baru...')
        .setMinValues(1)
        .setMaxValues(1);

      const row = new ActionRowBuilder().addComponents(userSelect);
      return interaction.reply({
        content: '**Transfer Kepemilikan Room**\nPilih salah satu member untuk dijadikan Host/Pemilik baru room ini:',
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // K. Hapus Room Manual
    if (customId === 'btn_vc_delete') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      activeTempChannels.delete(voiceChannel.id);
      saveActiveRooms();

      await interaction.editReply({
        content: 'Menghapus voice room dan panel kontrol...',
      });

      if (roomData.textChannelId) {
        const txtCh = interaction.guild.channels.cache.get(roomData.textChannelId);
        if (txtCh) await txtCh.delete('Dihapus oleh host').catch(() => {});
      }
      await voiceChannel.delete('Dihapus oleh host').catch(() => {});
      return true;
    }
  }

  // === 2. MODAL SUBMISSIONS ===
  if (interaction.isModalSubmit()) {
    if (customId === 'modal_vc_limit') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const rawLimit = interaction.fields.getTextInputValue('vc_limit_input') || '0';
      const parsedLimit = parseInt(rawLimit.trim(), 10);

      if (isNaN(parsedLimit) || parsedLimit < 0 || parsedLimit > 99) {
        return interaction.editReply({
          content: 'Batas member harus berupa angka antara 0 sampai 99 (0 = tanpa batas).',
        });
      }

      roomData.userLimit = parsedLimit;
      saveActiveRooms();

      await voiceChannel.setUserLimit(parsedLimit).catch((err) => {
        console.warn('[TEMP VOICE] Gagal atur user limit:', err.message);
      });
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: `Batas maksimal member room berhasil diatur ke: **${parsedLimit === 0 ? 'Tanpa Batas' : parsedLimit + ' Orang'}**.`,
      });
    }
  }

  // === 3. USER SELECT MENU SUBMISSIONS ===
  if (interaction.isUserSelectMenu()) {
    // Whitelist Teman
    if (customId === 'select_vc_permit') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const users = interaction.values;
      for (const uId of users) {
        roomData.allowedUserIds.add(uId);
        roomData.blockedUserIds.delete(uId);
      }
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      const userPings = users.map((id) => `<@${id}>`).join(', ');
      return interaction.editReply({
        content: `Berhasil mengizinkan ${userPings} untuk bergabung ke voice room meskipun sedang dikunci.`,
      });
    }

    // Kick / Blokir Member
    if (customId === 'select_vc_kick') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const users = interaction.values;
      for (const uId of users) {
        if (uId === roomData.ownerId || uId === interaction.client.user.id) continue;
        roomData.allowedUserIds.delete(uId);
        roomData.blockedUserIds.add(uId);

        // Tendang keluar jika member sedang ada di dalam voice channel
        const memberInVoice = voiceChannel.members.get(uId);
        if (memberInVoice) {
          await memberInVoice.voice.disconnect('Ditendang dari room oleh Host').catch(() => {});
        }
      }
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);
      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      const userPings = users.map((id) => `<@${id}>`).join(', ');
      return interaction.editReply({
        content: `Berhasil mengeluarkan dan memblokir ${userPings} dari room ini.`,
      });
    }

    // Transfer Host
    if (customId === 'select_vc_transfer') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const newOwnerId = interaction.values[0];
      if (newOwnerId === interaction.client.user.id) {
        return interaction.editReply({
          content: 'Bot tidak bisa dijadikan Host room suara.',
        });
      }

      roomData.ownerId = newOwnerId;
      roomData.allowedUserIds.add(newOwnerId);
      saveActiveRooms();

      await applyRoomPermissions(voiceChannel, roomData, interaction.guild);

      // Berikan akses kontrol-voice ke pemilik baru
      if (roomData.textChannelId) {
        const txtCh = interaction.guild.channels.cache.get(roomData.textChannelId);
        if (txtCh) {
          await txtCh.permissionOverwrites.edit(newOwnerId, {
            ViewChannel: true,
            ReadMessageHistory: true,
            SendMessages: false,
          }).catch(() => {});
        }
      }

      updatePanelMessage(voiceChannel, roomData, interaction.guild).catch(() => {});

      return interaction.editReply({
        content: `Kamu telah berhasil mengalihkan kepemilikan room ini ke <@${newOwnerId}>.`,
      });
    }
  }

  return true;
}

module.exports = {
  getTempVoiceConfig,
  setTempVoiceConfig,
  activeTempChannels,
  handleVoiceStateUpdate,
  handleChannelDelete,
  handleVoiceControlInteraction,
  createControlPanelEmbed,
  createControlPanelComponents,
};
