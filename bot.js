// Memuat variabel lingkungan dari file .env
require('dotenv').config();

// Mencegah bot crash saat terjadi unhandled rejection atau network/voice error
process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED REJECTION]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});

const fs = require('fs');
const path = require('path');
const {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
  Events,
  EmbedBuilder,
  MessageFlags,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require('discord.js');
const { initLavalink } = require('./lavalinkHelper');
// Hook Module loader agar setiap panggilan ke @discordjs/voice selalu join dengan selfDeaf: false sejak awal.
// Ini mencegah bot terkena status deafen dan mencegah pemanggilan rejoin() di tengah pemutaran yang merusak stream UDP audio.
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  const mod = originalRequire.apply(this, arguments);
  if ((id === '@discordjs/voice' || (typeof id === 'string' && id.includes('@discordjs/voice'))) && mod && mod.joinVoiceChannel) {
    if (mod.__isVoicePatched) return mod;
    return new Proxy(mod, {
      get(target, prop) {
        if (prop === 'joinVoiceChannel') {
          return function(options) {
            return target.joinVoiceChannel({
              selfDeaf: false,
              selfMute: false,
              ...options,
            });
          };
        }
        if (prop === '__isVoicePatched') return true;
        return target[prop];
      },
    });
  }
  return mod;
};

// Load voice encryption & audio encoding
try { require('@noble/ciphers'); } catch (e) {}
try { require('libsodium-wrappers'); } catch (e) {}
try { require('opusscript'); } catch (e) {}
const { resolveChannel, createWelcomeEmbed, createLeaveEmbed } = require('./welcomeHelper');
const { handleVoiceStateUpdate, handleVoiceControlInteraction, handleChannelDelete: handleVoiceChannelDelete } = require('./tempVoiceHelper');
const { updateServerStats } = require('./serverStatsHelper');
const { getAutoRole } = require('./autoRoleHelper');
const { handleMenuInteraction } = require('./menuInteractionHandler');
const { processMessage } = require('./levelingHelper');
const { askAI, askEntertainmentAI } = require('./aiHelper');
const { isPrivateAiChannel, unregisterPrivateChannel } = require('./privateAiHelper');
const { getAfk, removeAfk } = require('./afkHelper');
const { checkPhishing, checkToxic } = require('./autoModHelper');
const { isPatroliActive, getPatroliConfig, getAllPatroliConfigs, joinPatroliChannel, schedulePatroliReconnect, cancelPatroliReconnect } = require('./patroliHelper');
const { enhanceImage, extractImageUrlFromMessage, isHdChannel, setupHdChannel } = require('./imageHdHelper');
const {
  handleGuildCreate,
  handleGuildDelete,
  initBotMonitoring,
  recordCommandExecution,
} = require('./botMonitoringHelper');
const {
  isBotOwner,
  getMaintenanceConfig,
  applyBotPresence,
  getOfficialInviteUrl,
  getOfficialWebsiteUrl,
} = require('./ownerHelper');
const {
  ensureFeatureRequestChannel,
  createRequestModal,
  handleFeatureRequestModal,
  handleFeatureRequestVote,
  handleFeatureRequestStatusButton,
  handleFeatureRequestStatusSelect,
  handleRawMessageInRequestChannel,
} = require('./featureRequestHelper');

// Inisialisasi client Discord dengan intent Guilds, GuildVoiceStates, GuildMembers, dan DirectMessages
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates, // Untuk bot musik mendeteksi voice channel user
    GatewayIntentBits.GuildMembers,     // Wajib untuk mendeteksi event member join & leave
    GatewayIntentBits.GuildMessages,    // Untuk mendeteksi pesan chat (XP leveling)
    GatewayIntentBits.MessageContent,   // Untuk membaca konten pesan
    GatewayIntentBits.DirectMessages,   // Untuk mendeteksi pesan DM pribadi
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Koleksi untuk menyimpan command yang terdaftar di bot
client.commands = new Collection();

// Storage sementara untuk respon AI privat (Ephemeral: Only you can see this) di channel entertainment
const entertainmentAiStorage = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of entertainmentAiStorage.entries()) {
    if (now - val.createdAt > 30 * 60 * 1000) {
      entertainmentAiStorage.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Membaca file command secara otomatis dari folder commands/
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[LOAD] Command loaded: /${command.data.name}`);
  } else {
    console.warn(`[PERINGATAN] File ${file} tidak memiliki properti "data" atau "execute" yang diperlukan.`);
  }
}

// Inisialisasi Lavalink v4 Engine
client.lavalink = initLavalink(client);

// Forwarding paket raw voice Discord Gateway ke LavalinkManager
client.on('raw', (d) => {
  client.lavalink?.sendRawData(d);
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[ONLINE] Bot siap melayani sebagai ${readyClient.user.tag}`);

  // Inisialisasi LavalinkManager v4
  try {
    await client.lavalink.init({ id: readyClient.user.id, username: readyClient.user.username });
    console.log('[LAVALINK v4] LavalinkManager siap melayani pemutaran audio.');
  } catch (err) {
    console.error('[LAVALINK v4] Gagal inisialisasi node:', err.message);
  }

  // Auto-sync slash command global & ke setiap server (agar langsung aktif instan tanpa delay cache)
  (async () => {
    try {
      const body = [...client.commands.values()].map((c) => c.data.toJSON());
      const synced = await readyClient.application.commands.set(body);
      console.log(`[SYNC] ${synced.size} slash command berhasil disinkronkan secara global`);

      // Daftarkan juga langsung ke setiap server yang bot ikuti agar instan muncul di Discord (0 delay)
      for (const [, guild] of readyClient.guilds.cache) {
        await guild.commands.set(body).catch((e) => console.warn(`[SYNC GUILD] ${guild.name}:`, e.message));
      }
      console.log(`[SYNC] Berhasil disinkronkan langsung ke ${readyClient.guilds.cache.size} server`);
    } catch (err) {
      console.error('[SYNC] Gagal sinkron slash command:', err.message);
    }
  })();

  // Inisialisasi dan perbarui statistik server berkala (setiap 10 menit)
  for (const [, guild] of readyClient.guilds.cache) {
    updateServerStats(guild).catch(console.error);
  }
  setInterval(() => {
    for (const [, guild] of client.guilds.cache) {
      updateServerStats(guild).catch(console.error);
    }
  }, 10 * 60 * 1000);

  // Inisialisasi pengingat waktu (reminders)
  try {
    const { initReminders } = require('./reminderHelper');
    initReminders(readyClient);
  } catch (err) {
    console.error('[REMINDER INIT] Error:', err.message);
  }

  // Auto-Update Setup Server untuk seluruh guild yang telah disetup All-in-One
  try {
    const { getTemplateConfig, syncServerTemplate } = require('./templateSetupHelper');
    for (const [, guild] of readyClient.guilds.cache) {
      (async () => {
        try {
          await guild.channels.fetch().catch(() => {});
          const cfg = getTemplateConfig(guild.id);
          const hasTemplateCat = guild.channels.cache.some(
            (c) => c.type === ChannelType.GuildCategory && (
              c.name.toLowerCase().includes('get started') ||
              c.name.toLowerCase().includes('entertainment') ||
              c.name.toLowerCase().includes('mini games') ||
              c.name.toLowerCase().includes('community') ||
              c.name.toLowerCase().includes('music') ||
              c.name.toLowerCase().includes('sosmed') ||
              c.name.toLowerCase().includes('converter')
            )
          );
          if (cfg?.allInOneConfigured || hasTemplateCat) {
            console.log(`[AUTO-UPDATE SETUP] Menyinkronkan update template untuk server: ${guild.name}...`);
            await syncServerTemplate(guild);
            console.log(`[AUTO-UPDATE SETUP] Sukses menyinkronkan template server: ${guild.name}`);
          }
        } catch (err) {
          console.warn(`[AUTO-UPDATE SETUP] Gagal sinkron ${guild.name}:`, err.message);
        }
      })();
    }
  } catch (err) {
    console.error('[AUTO-UPDATE SETUP] Error:', err.message);
  }

  // Inisialisasi Pembersih Chat Otomatis 1 Hari di Channel AI Entertainment
  try {
    const { initAiChannelCleaner } = require('./aiChatCleanupHelper');
    initAiChannelCleaner(readyClient);
  } catch (err) {
    console.error('[AI CLEANUP INIT] Error:', err.message);
  }

  // Inisialisasi Monitoring Realtime Server Official FlyBot
  try {
    initBotMonitoring(readyClient);
  } catch (err) {
    console.error('[BOT MONITOR INIT] Error:', err.message);
  }

  // Terapkan Status Custom Presence Bot
  try {
    applyBotPresence(readyClient);
  } catch (err) {
    console.error('[BOT PRESENCE INIT] Error:', err.message);
  }

  // Inisialisasi Channel Request Fitur Server Official
  try {
    ensureFeatureRequestChannel(readyClient);
  } catch (err) {
    console.error('[FEATURE REQUEST INIT] Error:', err.message);
  }

  // Auto-resume patroli voice untuk guild yang patrolinya masih aktif sebelum restart
  setTimeout(async () => {
    try {
      const allPatroli = getAllPatroliConfigs();
      for (const guildId of Object.keys(allPatroli)) {
        const cfg = allPatroli[guildId];
        if (!cfg || !cfg.voiceChannelId) continue;
        const guild = readyClient.guilds.cache.get(guildId);
        if (!guild) continue;
        const voiceChannel = guild.channels.cache.get(cfg.voiceChannelId);
        if (!voiceChannel) continue;

        console.log(`[PATROLI RESUME] Melanjutkan patroli di ${guild.name} -> voice: ${voiceChannel.name}`);
        try {
          joinPatroliChannel(voiceChannel);
        } catch (err) {
          console.error(`[PATROLI RESUME ERROR] Gagal melanjutkan patroli di ${guild.name}:`, err.message);
        }
      }
    } catch (e) {
      console.error('[PATROLI RESUME] Error:', e.message);
    }
  }, 5000);
});

// Event saat ada interaksi (Slash Command, Button, Modal)
client.on(Events.InteractionCreate, async (interaction) => {
  // Handler untuk Menu Dashboard interaktif
  await handleMenuInteraction(interaction).catch(console.error);

  // Handler interaktif Panel Kontrol Voice Room
  try {
    const handledVoice = await handleVoiceControlInteraction(interaction);
    if (handledVoice) return;
  } catch (err) {
    console.error('Error saat handleVoiceControlInteraction:', err);
  }

  // Handler tombol restart bot (Triggered via /update button)
  if (interaction.isButton() && interaction.customId === 'btn_trigger_bot_restart') {
    const { isBotOwner } = require('./ownerHelper');
    const isOwner = await isBotOwner(interaction);
    if (!isOwner) {
      return interaction.reply({
        content: 'Hanya Owner Bot yang dapat me-restart bot.',
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.reply({
      content: 'Memulai ulang proses bot dalam 2 detik. Server Pterodactyl akan menyalakan bot kembali...',
      flags: MessageFlags.Ephemeral,
    });
    setTimeout(() => {
      process.exit(0);
    }, 2000);
    return;
  }

  // Handler interaktif Fitur Request Fitur (Khusus Server Official - Dynamic Require)
  try {
    const fr = require('./featureRequestHelper');
    if (interaction.isButton() && interaction.customId === 'btn_open_request_modal') {
      const modal = fr.createRequestModal();
      await interaction.showModal(modal);
      return;
    }
    if (await fr.handleFeatureRequestVote(interaction)) return;
    if (await fr.handleFeatureRequestStatusButton(interaction)) return;
    if (await fr.handleFeatureRequestStatusSelect(interaction)) return;
    if (await fr.handleFeatureRequestModal(interaction)) return;
  } catch (err) {
    console.error('Error saat handle interaksi request fitur:', err);
  }

  // Handler dropdown menu setup
  if (interaction.isStringSelectMenu() && interaction.customId === 'menu_setup_select') {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const chosen = interaction.values[0] || 'all';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const { executeSetupAction, createResultEmbed } = require('./commands/setup');
      const result = await executeSetupAction(chosen, interaction.guild);
      const embed = createResultEmbed(chosen, result, interaction.guild);
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      return interaction.editReply({ content: `Gagal menjalankan setup: ${err.message}` });
    }
  }

  // Handler dropdown menu delete
  if (interaction.isStringSelectMenu() && interaction.customId === 'menu_delete_choice') {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const { wipeAllChannels, deleteCategoryAndChildren } = require('./commands/delete');
    const val = interaction.values[0];
    if (val === 'semuanya') {
      await interaction.reply({
        content: '⏳ Menghapus SELURUH channel dan kategori sampai kosong...',
        flags: MessageFlags.Ephemeral,
      });
      await wipeAllChannels(interaction.guild, { keepGeneral: false, interactionChannelId: interaction.channel.id });
      return;
    }
    if (val === 'semua_plus_general') {
      await interaction.reply({
        content: '⏳ Menghapus semua channel lama dan membuat 1 channel #general baru...',
        flags: MessageFlags.Ephemeral,
      });
      await wipeAllChannels(interaction.guild, { keepGeneral: true, interactionChannelId: interaction.channel.id });
      return;
    }
    if (val === 'this_channel') {
      await interaction.reply({
        content: `🗑️ Menghapus channel **#${interaction.channel.name}**...`,
        flags: MessageFlags.Ephemeral,
      });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 1500);
      return;
    }
    if (val === 'this_category') {
      const parent = interaction.channel.parent;
      if (!parent) return interaction.reply({ content: 'Channel ini tidak berada di dalam kategori.', flags: MessageFlags.Ephemeral });
      await interaction.reply({ content: `⏳ Menghapus kategori **${parent.name}** beserta isinya...`, flags: MessageFlags.Ephemeral });
      await deleteCategoryAndChildren(parent);
      return;
    }
  }

  // Handler untuk klik tombol (Button)
  if (interaction.isButton()) {
    if (interaction.customId === 'btn_delete_confirm_all') {
      const hasPerm =
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.guild?.ownerId === interaction.user.id;
      if (!hasPerm) return interaction.reply({ content: 'Hanya Administrator yang bisa mengeksekusi ini.', flags: MessageFlags.Ephemeral });

      await interaction.reply({ content: '⏳ Menghapus seluruh channel dan kategori sampai kosong bersih...', flags: MessageFlags.Ephemeral });
      const { wipeAllChannels } = require('./commands/delete');
      await wipeAllChannels(interaction.guild, { keepGeneral: false, interactionChannelId: interaction.channel.id });
      return;
    }

    if (interaction.customId === 'btn_delete_confirm_clean') {
      const hasPerm =
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.guild?.ownerId === interaction.user.id;
      if (!hasPerm) return interaction.reply({ content: 'Hanya Administrator yang bisa mengeksekusi ini.', flags: MessageFlags.Ephemeral });

      await interaction.reply({ content: '⏳ Menghapus semua channel lama & membuat channel #general baru...', flags: MessageFlags.Ephemeral });
      const { wipeAllChannels } = require('./commands/delete');
      await wipeAllChannels(interaction.guild, { keepGeneral: true, interactionChannelId: interaction.channel.id });
      return;
    }

    if (interaction.customId === 'btn_delete_cancel') {
      return interaction.reply({ content: 'Penghapusan dibatalkan.', flags: MessageFlags.Ephemeral });
    }

    // Tombol Buka Jawaban AI Privat (Only you can see this • Dismiss message)
    if (interaction.customId.startsWith('btn_ephemeral_ai_')) {
      const resId = interaction.customId.replace('btn_ephemeral_ai_', '');
      const data = entertainmentAiStorage.get(resId);
      if (!data) {
        return interaction.reply({
          content: 'Pesan ini sudah kadaluarsa. Silakan ketik perintah atau pertanyaan baru di channel!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.user.id !== data.userId) {
        return interaction.reply({
          content: 'Jawaban ini khusus dibuat untuk orang yang meminta.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const color = data.channelType === 'fanart' ? 0xFEE75C : data.channelType === 'prompt' ? 0x57F287 : 0x5865F2;
      const channelTitle = data.channelType === 'fanart'
        ? 'BotFly AI • Fanart & Visual Review'
        : data.channelType === 'prompt'
        ? 'BotFly AI • Master Prompt Studio'
        : 'BotFly AI • Generative Intelligence';

      let replyText = data.reply;
      if (replyText.length > 3900) {
        replyText = replyText.substring(0, 3900) + '\n\n*(Jawaban dipotong karena melebihi batas karakter Discord)*';
      }

      const aiEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(channelTitle)
        .setDescription(replyText)
        .setFooter({ text: 'BotFly AI Intelligence • Copyright © BotFly' })
        .setTimestamp();

      if (data.prompt) {
        const promptShort = data.prompt.length > 200 ? data.prompt.substring(0, 197) + '...' : data.prompt;
        aiEmbed.addFields({ name: 'Pertanyaan / Prompt Kamu:', value: `>>> ${promptShort}` });
      }

      const shareBtn = new ButtonBuilder()
        .setCustomId(`btn_ai_share_public_${resId}`)
        .setLabel('Bagikan ke Publik')
        .setStyle(ButtonStyle.Success);

      const privateBtn = new ButtonBuilder()
        .setCustomId(`btn_ai_keep_private_${resId}`)
        .setLabel('Simpan untuk Sendiri')
        .setStyle(ButtonStyle.Secondary);

      const actionRow = new ActionRowBuilder().addComponents(shareBtn, privateBtn);

      return interaction.reply({
        embeds: [aiEmbed],
        components: [actionRow],
        flags: MessageFlags.Ephemeral,
      });
    }

    // Tombol Bagikan Jawaban AI ke Publik di Channel
    if (interaction.customId.startsWith('btn_ai_share_public_')) {
      const resId = interaction.customId.replace('btn_ai_share_public_', '');
      const data = entertainmentAiStorage.get(resId);
      if (!data) {
        return interaction.reply({
          content: 'Pesan ini sudah kadaluarsa. Silakan ketik perintah atau pertanyaan baru di channel!',
          flags: MessageFlags.Ephemeral,
        });
      }

      if (interaction.user.id !== data.userId) {
        return interaction.reply({
          content: 'Hanya orang yang meminta jawaban ini yang dapat membagikannya ke publik.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const color = data.channelType === 'fanart' ? 0xFEE75C : data.channelType === 'prompt' ? 0x57F287 : 0x5865F2;
      const channelTitle = data.channelType === 'fanart'
        ? 'BotFly AI • Fanart & Visual Review'
        : data.channelType === 'prompt'
        ? 'BotFly AI • Master Prompt Studio'
        : 'BotFly AI • Generative Intelligence';

      let replyText = data.reply;
      if (replyText.length > 3900) {
        replyText = replyText.substring(0, 3900) + '\n\n*(Jawaban dipotong karena melebihi batas karakter Discord)*';
      }

      const publicEmbed = new EmbedBuilder()
        .setColor(color)
        .setTitle(channelTitle)
        .setDescription(replyText)
        .setFooter({ text: `Dibagikan oleh ${interaction.member?.displayName || interaction.user.username} • BotFly AI` })
        .setTimestamp();

      if (data.prompt) {
        const promptShort = data.prompt.length > 200 ? data.prompt.substring(0, 197) + '...' : data.prompt;
        publicEmbed.addFields({ name: 'Pertanyaan / Prompt:', value: `>>> ${promptShort}` });
      }

      await interaction.channel.send({
        content: `Jawaban AI dibagikan oleh <@${interaction.user.id}> untuk semua orang di channel ini:`,
        embeds: [publicEmbed],
      }).catch(console.error);

      return interaction.update({
        content: 'Jawaban AI berhasil dibagikan ke publik di channel ini.',
        embeds: [],
        components: [],
      });
    }

    // Tombol Simpan Jawaban AI Privat Hanya untuk Sendiri
    if (interaction.customId.startsWith('btn_ai_keep_private_')) {
      return interaction.update({
        content: 'Jawaban AI disimpan privat hanya untuk kamu.',
        embeds: [],
        components: [],
      });
    }

    if (interaction.customId === 'btn_setup_run_all') {
      const hasPerm =
        interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
        interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
        interaction.guild?.ownerId === interaction.user.id;

      if (!hasPerm) {
        return interaction.reply({
          content: 'Perintah ini hanya bisa dijalankan oleh Administrator.',
          flags: MessageFlags.Ephemeral,
        });
      }

      try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      } catch (e) {
        return;
      }
      try {
        const { executeSetupAction, createResultEmbed } = require('./commands/setup');
        const result = await executeSetupAction('all', interaction.guild);
        const embed = createResultEmbed('all', result, interaction.guild);
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({ content: `Gagal menjalankan setup: ${err.message}` });
      }
    }

    if (interaction.customId === 'rule_agree_btn') {
      return interaction.reply({
        content: `Terima kasih <@${interaction.user.id}>! Kamu telah membaca dan menyetujui seluruh tata tertib server ${interaction.guild.name}. Selamat berinteraksi!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Tombol Pemilihan Role Gender (Laki-laki / Perempuan)
    if (interaction.customId === 'role_gender_male') {
      const { handleGenderRoleSelection } = require('./templateSetupHelper');
      return await handleGenderRoleSelection(interaction, 'male');
    }
    if (interaction.customId === 'role_gender_female') {
      const { handleGenderRoleSelection } = require('./templateSetupHelper');
      return await handleGenderRoleSelection(interaction, 'female');
    }

    // Tombol Verifikasi Member
    if (interaction.customId === 'btn_do_verify') {
      const { handleVerificationButton } = require('./templateSetupHelper');
      return await handleVerificationButton(interaction);
    }

    // Tombol Pembuatan Tiket Baru
    if (interaction.customId === 'btn_create_ticket') {
      try {
        const {
          getGuildTicketConfig,
          getActiveTicket,
          registerTicket,
          getNextTicketNumber,
        } = require('./ticketHelper');

        const existing = getActiveTicket(interaction.guildId, interaction.user.id);
        if (existing) {
          const ch = interaction.guild.channels.cache.get(existing.channelId);
          if (ch) {
            return interaction.reply({
              content: `Kamu masih memiliki tiket yang sedang aktif di <#${ch.id}>. Harap selesaikan terlebih dahulu sebelum membuka tiket baru.`,
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        const cfg = getGuildTicketConfig(interaction.guildId);
        const ticketNum = getNextTicketNumber(interaction.guildId);
        const cleanName = interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'user';
        const channelName = `tiket-${cleanName}-${ticketNum}`;

        const overwrites = [
          {
            id: interaction.guild.id, // @everyone
            deny: [PermissionFlagsBits.ViewChannel],
          },
          {
            id: interaction.user.id, // Pembuat tiket
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.AttachFiles,
              PermissionFlagsBits.EmbedLinks,
            ],
          },
          {
            id: interaction.client.user.id, // Bot
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.ManageMessages,
            ],
          },
        ];

        if (cfg.supportRoleId) {
          const staffRole = interaction.guild.roles.cache.get(cfg.supportRoleId);
          if (staffRole) {
            overwrites.push({
              id: staffRole.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
              ],
            });
          }
        }

        let category = cfg.categoryId ? interaction.guild.channels.cache.get(cfg.categoryId) : null;
        if (!category || category.type !== ChannelType.GuildCategory) {
          category = interaction.guild.channels.cache.find(
            (c) => c.type === ChannelType.GuildCategory && c.name.toUpperCase() === 'SUPPORT'
          );
        }
        if (!category) {
          category = await interaction.guild.channels.create({
            name: 'SUPPORT',
            type: ChannelType.GuildCategory,
            reason: 'Auto-create kategori untuk tiket bantuan',
          }).catch(() => null);
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: category ? category.id : undefined,
          permissionOverwrites: overwrites,
          reason: `Tiket bantuan dibuat oleh ${interaction.user.tag}`,
        });

        registerTicket(interaction.guildId, ticketChannel.id, interaction.user.id);

        const welcomeEmbed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: `${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`Tiket Bantuan  •  #${channelName}`)
          .setDescription(
            `Halo <@${interaction.user.id}>! Terima kasih telah membuka tiket bantuan.\n\n` +
            `Silakan sampaikan pertanyaan, laporan, atau keperluan kamu secara jelas di sini.\n` +
            `Tim Admin/Staff akan segera membaca dan merespons obrolan kamu.\n\n` +
            `*Jika urusan sudah selesai, klik tombol **Tutup Tiket** di bawah.*`
          )
          .addFields(
            { name: 'Pembuat Tiket', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Waktu Dibuat', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true },
          )
          .setFooter({ text: `${interaction.guild.name} • Tiket Bantuan` })
          .setTimestamp();

        const closeBtn = new ButtonBuilder()
          .setCustomId('btn_close_ticket')
          .setLabel('Tutup Tiket')
          .setStyle(ButtonStyle.Danger);

        const row = new ActionRowBuilder().addComponents(closeBtn);

        await ticketChannel.send({
          content: `<@${interaction.user.id}> ${cfg.supportRoleId ? `<@&${cfg.supportRoleId}>` : ''}`,
          embeds: [welcomeEmbed],
          components: [row],
        });

        return interaction.reply({
          content: `Tiket kamu berhasil dibuat di <#${ticketChannel.id}>. Silakan masuk ke channel tersebut!`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error('Error saat membuat channel tiket:', err);
        return interaction.reply({
          content: `Gagal membuat tiket bantuan: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Tombol Tutup Tiket
    if (interaction.customId === 'btn_close_ticket') {
      try {
        const { closeTicket } = require('./ticketHelper');
        closeTicket(interaction.channelId);

        await interaction.reply({
          content: `Tiket ini ditutup oleh <@${interaction.user.id}> dan akan dihapus secara permanen dalam 5 detik...`,
        });

        setTimeout(() => {
          interaction.channel?.delete('Tiket ditutup').catch(() => {});
        }, 5000);
        return;
      } catch (err) {
        console.error('Error saat menutup tiket:', err);
        return interaction.reply({
          content: `Gagal menutup tiket: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // === MINI GAMES: 1. TEBAK KOIN ===
    if (interaction.customId.startsWith('btn_game_coin_') || interaction.customId.startsWith('game_coin_')) {
      try {
        const { getCoinGameRow } = require('./gameHelper');
        const { addReward } = require('./levelingHelper');
        const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
        let type = interaction.customId.replace('btn_game_coin_', '').replace('game_coin_', '');
        if (type === 'heads') type = 'gambar';
        if (type === 'tails') type = 'angka';
        const flip = Math.random() < 0.5 ? 'gambar' : 'angka';
        const flipName = flip === 'gambar' ? 'Gambar' : 'Angka';

        if (type === 'random') {
          const reward = addReward(interaction.guildId, interaction.user.id, { coins: 5, xp: 5, isWin: false });
          let bonusText = `\n• Hadiah Partisipasi: +5 Koin & +5 XP`;
          if (reward.leveledUp) bonusText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

          await interaction.reply({
            content: `**Hasil Lemparan Koin**\nKoin mendarat di sisi: **${flipName}**${bonusText}`,
            components: [getCoinGameRow()],
          });
          dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward).catch(() => {});
          return;
        }

        const guessName = type === 'gambar' ? 'Gambar' : 'Angka';
        const won = type === flip;
        const coinsEarned = won ? 50 : 0;
        const xpEarned = won ? 30 : 10;
        const reward = addReward(interaction.guildId, interaction.user.id, { coins: coinsEarned, xp: xpEarned, isWin: won });

        let rewardText = won
          ? `\n• Hadiah Menang: **+${coinsEarned} Koin** & **+${xpEarned} XP**`
          : `\n• Hadiah Partisipasi: **+${xpEarned} XP**`;
        if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

        await interaction.reply({
          content:
            `**Hasil Lemparan Koin**\n` +
            `• Sisi Koin: **${flipName}**\n` +
            `• Tebakan <@${interaction.user.id}>: **${guessName}**\n\n` +
            (won
              ? `Status: **Tebakan Tepat (Menang)**`
              : `Status: **Belum Tepat (Coba Lagi)**`) +
            `${rewardText}`,
          components: [getCoinGameRow()],
        });
        dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward).catch(() => {});
        return;
      } catch (err) {
        console.error('Error saat tombol tebak koin:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Gagal memproses tebak koin. Coba lagi!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }
    }

    // === MINI GAMES: 2. SUIT JEPANG (GUNTING BATU KERTAS) ===
    if (interaction.customId.startsWith('btn_game_rps_')) {
      try {
        const { getRpsGameRow } = require('./gameHelper');
        const { addReward } = require('./levelingHelper');
        const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
        const userChoice = interaction.customId.replace('btn_game_rps_', '');
        const choices = ['rock', 'paper', 'scissors'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        const choiceMap = {
          rock: 'Batu',
          paper: 'Kertas',
          scissors: 'Gunting',
        };

        let resultText = '';
        let isWin = false;
        let coinsEarned = 0;
        let xpEarned = 10;

        if (userChoice === botChoice) {
          resultText = 'Hasil: **Seri**';
          coinsEarned = 20;
          xpEarned = 15;
        } else if (
          (userChoice === 'rock' && botChoice === 'scissors') ||
          (userChoice === 'paper' && botChoice === 'rock') ||
          (userChoice === 'scissors' && botChoice === 'paper')
        ) {
          resultText = 'Hasil: **Kamu Menang**';
          isWin = true;
          coinsEarned = 50;
          xpEarned = 30;
        } else {
          resultText = 'Hasil: **Kamu Kalah**';
          coinsEarned = 0;
          xpEarned = 10;
        }

        const reward = addReward(interaction.guildId, interaction.user.id, { coins: coinsEarned, xp: xpEarned, isWin });

        let rewardText = coinsEarned > 0
          ? `\n• Hadiah: **+${coinsEarned} Koin** & **+${xpEarned} XP**`
          : `\n• Hadiah Partisipasi: **+${xpEarned} XP**`;
        if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

        await interaction.reply({
          content:
            `**Duel Suit**\n` +
            `• <@${interaction.user.id}>: **${choiceMap[userChoice] || userChoice}**\n` +
            `• FlyBot: **${choiceMap[botChoice] || botChoice}**\n\n` +
            `${resultText}${rewardText}`,
          components: [getRpsGameRow()],
        });
        dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward).catch(() => {});
        return;
      } catch (err) {
        console.error('Error saat tombol suit:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Gagal memproses suit. Coba lagi!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }
    }

    // === MINI GAMES: 3. TEBAK ANGKA ===
    if (interaction.customId === 'btn_game_number_start') {
      try {
        const { startNumberGuessing } = require('./gameHelper');
        startNumberGuessing(interaction.guildId, interaction.user.id);

        return await interaction.reply({
          content:
            `**Ronde Tebak Angka Dimulai** oleh <@${interaction.user.id}>\n` +
            `Angka rahasia antara **1 sampai 100** telah disiapkan.\n\n` +
            `Ketik angka tebakan kamu (1 - 100) langsung di channel ini untuk menebak.`,
        });
      } catch (err) {
        console.error('Error saat tombol tebak angka start:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Gagal memulai tebak angka. Coba lagi!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }
    }

    if (interaction.customId === 'btn_game_number_status') {
      try {
        const { getNumberGuessingState } = require('./gameHelper');
        const state = getNumberGuessingState(interaction.guildId);

        if (state && state.active) {
          return await interaction.reply({
            content: `Ronde sedang aktif. Total tebakan: **${state.attempts}** kali. Ketik angka tebakan kamu (1 - 100) di chat.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          return await interaction.reply({
            content: `Belum ada ronde yang aktif. Klik tombol **Main Lagi** untuk memulai ronde baru.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (err) {
        console.error('Error saat tombol tebak angka status:', err);
        return;
      }
    }

    // === MINI GAMES: 4. GACHA SLOT KOIN ===
    if (interaction.customId === 'btn_game_slot_balance') {
      try {
        const { getUserData } = require('./levelingHelper');
        const u = getUserData(interaction.guildId, interaction.user.id);
        const coins = u.coins || 0;
        return await interaction.reply({
          content: `Saldo Koin kamu saat ini: **${coins.toLocaleString('id-ID')} Koin**.\nGunakan koin ini untuk memutar mesin slot atau pasang taruhan!`,
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        return await interaction.reply({ content: 'Gagal mengecek saldo koin.', flags: MessageFlags.Ephemeral });
      }
    }

    if (interaction.customId.startsWith('btn_game_slot_spin_')) {
      try {
        const bet = parseInt(interaction.customId.replace('btn_game_slot_spin_', ''), 10) || 20;
        const { playSlotMachine, getSlotGameRow } = require('./gameHelper');
        const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');

        const res = playSlotMachine(interaction.guildId, interaction.user.id, bet);

        if (!res.success && res.reason === 'INSUFFICIENT_COINS') {
          return await interaction.reply({
            content: `Saldo Koin kamu tidak cukup untuk memutar slot dengan taruhan **${bet} Koin**.\nSaldo kamu saat ini: **${res.currentCoins} Koin**.\nDapatkan koin dari \`/daily\`, aktif mengobrol, atau menang mini game lain!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const [r1, r2, r3] = res.reels;
        const isWin = res.isWin;
        const color = res.winType === 'SUPER_JACKPOT' ? 0xFEE75C : isWin ? 0x57F287 : 0xED4245;

        let resultDesc =
          `> ┌───────────────────────────┐\n` +
          `> │      ${r1.tag}  |  ${r2.tag}  |  ${r3.tag}      │\n` +
          `> └───────────────────────────┘\n\n` +
          `**Hasil:** ${res.winTitle}\n\n`;

        if (isWin) {
          resultDesc +=
            `• Taruhan: **${res.bet} Koin**\n` +
            `• Pengali: **${res.multiplier}x**\n` +
            `• Kemenangan: **+${res.winnings} Koin** (Laba: **+${res.netProfit} Koin**)\n` +
            `• Bonus XP: **+${res.xpEarned} XP**\n` +
            `• Sisa Saldo: **${res.finalCoins.toLocaleString('id-ID')} Koin**`;
        } else {
          resultDesc +=
            `• Taruhan: **${res.bet} Koin** (Hangus)\n` +
            `• XP Partisipasi: **+${res.xpEarned} XP**\n` +
            `• Sisa Saldo: **${res.finalCoins.toLocaleString('id-ID')} Koin**\n\n` +
            `*Belum beruntung kali ini, coba putar lagi untuk memburu JACKPOT 777!*`;
        }

        if (res.reward?.leveledUp) {
          resultDesc += `\n\n**LEVEL UP!** Selamat naik ke **Level ${res.reward.newLevel}**!`;
        }

        const embed = new EmbedBuilder()
          .setColor(color)
          .setAuthor({
            name: `${interaction.user.username}  •  Mesin Slot Buah 777`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`Mesin Slot: ${res.winTitle}`)
          .setDescription(resultDesc)
          .setFooter({ text: `Taruhan: ${res.bet} Koin • Putar lagi dengan tombol di bawah` })
          .setTimestamp();

        await interaction.reply({
          embeds: [embed],
          components: [getSlotGameRow(res.bet)],
        });

        if (res.reward) {
          dispatchLevelUpAndAchievements(
            interaction.guild,
            interaction.member,
            interaction.user,
            interaction.channel,
            res.reward
          ).catch(() => {});
        }
        return;
      } catch (err) {
        console.error('Error saat tombol slot spin:', err);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: 'Gagal memproses putaran slot. Coba lagi!', flags: MessageFlags.Ephemeral }).catch(() => {});
        }
        return;
      }
    }

    // === PROFILE & LEADERBOARD BUTTONS ===
    if (interaction.customId.startsWith('btn_profile_ach_')) {
      const targetId = interaction.customId.replace('btn_profile_ach_', '');
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => interaction.user);

      const lvl = require('./levelingHelper');
      const uData = lvl.getUserData(interaction.guildId, targetId);
      const owned = uData.achievements || [];
      const allAchs = lvl.ACHIEVEMENTS;

      const pageSize = 10;
      const totalPages = Math.ceil(allAchs.length / pageSize) || 1;
      const currentPage = 1;
      const startIndex = 0;
      const pageAchs = allAchs.slice(startIndex, startIndex + pageSize);

      const lines = pageAchs.map((ach) => {
        const isOwned = owned.includes(ach.id);
        const status = isOwned ? '[TERBUKA]' : '[TERKUNCI]';
        return `> **${ach.tag || '[ACH]'} ${ach.name}**  --  ${status}\n> *${ach.desc}*`;
      });

      const percent = Math.round((owned.length / allAchs.length) * 100);

      const achListEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Daftar Prestasi  •  ${targetUser.username}`)
        .setDescription(
          `Total Terbuka: **${owned.length} / ${allAchs.length}** (${percent}%)\n` +
          `Menampilkan Prestasi **#${startIndex + 1} - #${startIndex + pageAchs.length}**\n\n` +
          lines.join('\n\n')
        )
        .setFooter({ text: `Halaman ${currentPage} dari ${totalPages} • Total ${allAchs.length} Prestasi` })
        .setTimestamp();

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_1`)
          .setLabel('Awal')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_1`)
          .setLabel('Sebelumnya')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(true),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_2`)
          .setLabel('Berikutnya')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(totalPages <= 1),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_${totalPages}`)
          .setLabel('Akhir')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(totalPages <= 1)
      );

      return interaction.reply({ embeds: [achListEmbed], components: [navRow], flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId.startsWith('btn_ach_page_')) {
      const parts = interaction.customId.split('_');
      const targetId = parts[3];
      const reqPage = parseInt(parts[4], 10) || 1;
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => interaction.user);

      const lvl = require('./levelingHelper');
      const uData = lvl.getUserData(interaction.guildId, targetId);
      const owned = uData.achievements || [];
      const allAchs = lvl.ACHIEVEMENTS;

      const pageSize = 10;
      const totalPages = Math.ceil(allAchs.length / pageSize) || 1;
      const currentPage = Math.max(1, Math.min(reqPage, totalPages));
      const startIndex = (currentPage - 1) * pageSize;
      const pageAchs = allAchs.slice(startIndex, startIndex + pageSize);

      const lines = pageAchs.map((ach) => {
        const isOwned = owned.includes(ach.id);
        const status = isOwned ? '[TERBUKA]' : '[TERKUNCI]';
        return `> **${ach.tag || '[ACH]'} ${ach.name}**  --  ${status}\n> *${ach.desc}*`;
      });

      const percent = Math.round((owned.length / allAchs.length) * 100);

      const achListEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Daftar Prestasi  •  ${targetUser.username}`)
        .setDescription(
          `Total Terbuka: **${owned.length} / ${allAchs.length}** (${percent}%)\n` +
          `Menampilkan Prestasi **#${startIndex + 1} - #${startIndex + pageAchs.length}**\n\n` +
          lines.join('\n\n')
        )
        .setFooter({ text: `Halaman ${currentPage} dari ${totalPages} • Total ${allAchs.length} Prestasi` })
        .setTimestamp();

      const navRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_1`)
          .setLabel('Awal')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_${currentPage - 1}`)
          .setLabel('Sebelumnya')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === 1),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_${currentPage + 1}`)
          .setLabel('Berikutnya')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(currentPage === totalPages),
        new ButtonBuilder()
          .setCustomId(`btn_ach_page_${targetId}_${totalPages}`)
          .setLabel('Akhir')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(currentPage === totalPages)
      );

      return interaction.update({ embeds: [achListEmbed], components: [navRow] });
    }

    if (interaction.customId === 'btn_profile_lb') {
      const lbCmd = require('./commands/leaderboard');
      const payload = lbCmd.buildLeaderboardEmbed(interaction.guild, 'xp', interaction.user);
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'btn_lb_xp' || interaction.customId === 'btn_lb_coins') {
      const lbCmd = require('./commands/leaderboard');
      const type = interaction.customId === 'btn_lb_xp' ? 'xp' : 'coins';
      const payload = lbCmd.buildLeaderboardEmbed(interaction.guild, type, interaction.user);
      return interaction.update(payload);
    }

    if (interaction.customId === 'btn_music_shuffle') {
      const shuffleCmd = interaction.client.commands.get('shuffle');
      if (shuffleCmd) return shuffleCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah shuffle tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'btn_music_skip') {
      const skipCmd = interaction.client.commands.get('skip');
      if (skipCmd) return skipCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah skip tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    // Tombol Self-Role (Ambil / Cabut Role)
    if (
      interaction.customId === 'selfrole_announcement' ||
      interaction.customId === 'selfrole_event' ||
      interaction.customId === 'selfrole_gamers'
    ) {
      const targetRoleName =
        interaction.customId === 'selfrole_announcement'
          ? 'Pengumuman Ping'
          : interaction.customId === 'selfrole_event'
          ? 'Update Event'
          : 'Gamers';

      let role = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === targetRoleName.toLowerCase());
      if (!role) {
        role = await interaction.guild.roles.create({
          name: targetRoleName,
          reason: 'Pembuatan self-role otomatis',
        });
      }

      try {
        if (interaction.member.roles.cache.has(role.id)) {
          await interaction.member.roles.remove(role);
          return interaction.reply({
            content: `Role ${role.name} telah dicabut dari akunmu.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          await interaction.member.roles.add(role);
          return interaction.reply({
            content: `Role ${role.name} berhasil ditambahkan ke akunmu.`,
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (err) {
        console.error('Error saat self-role:', err);
        return interaction.reply({
          content: `Gagal memperbarui role: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Tombol Hentikan Obrolan Voice AI
    if (interaction.customId === 'btn_aivoice_stop') {
      const { stopVoiceAiSession, getVoiceAiSession } = require('./voiceAiHelper');
      const session = getVoiceAiSession(interaction.guildId);
      if (!session) {
        return interaction.reply({
          content: 'Sesi Voice AI sudah tidak aktif.',
          flags: MessageFlags.Ephemeral,
        });
      }
      await interaction.deferReply();
      await stopVoiceAiSession(interaction.guildId);
      return interaction.editReply({
        content: `Sesi Voice AI telah dihentikan oleh <@${interaction.user.id}>. Bot telah keluar dari voice channel.`,
      });
    }

  }

  // Handler untuk pengiriman form modal (Custom Embed)
  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'modal_buat_embed') {
      try {
        const judul = interaction.fields.getTextInputValue('embed_judul');
        const deskripsi = interaction.fields.getTextInputValue('embed_deskripsi');
        const warnaInput = interaction.fields.getTextInputValue('embed_warna') || '#5865F2';
        const bannerUrl = interaction.fields.getTextInputValue('embed_banner') || null;
        const footerText = interaction.fields.getTextInputValue('embed_footer') || `${interaction.guild.name} Official`;

        let colorHex = 0x5865f2;
        if (warnaInput) {
          const cleanHex = warnaInput.replace('#', '').trim();
          if (/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
            colorHex = parseInt(cleanHex, 16);
          }
        }

        const embed = new EmbedBuilder()
          .setColor(colorHex)
          .setTitle(judul)
          .setDescription(deskripsi)
          .setFooter({ text: footerText, iconURL: interaction.guild.iconURL() || undefined })
          .setTimestamp();

        if (bannerUrl && bannerUrl.startsWith('http')) {
          embed.setImage(bannerUrl);
        }

        await interaction.channel.send({ embeds: [embed] });
        return interaction.reply({
          content: '✅ Embed estetik kustom berhasil dikirim ke channel ini!',
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error('Error saat memproses modal embed:', err);
        return interaction.reply({
          content: `❌ Gagal membuat embed: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  // Handler untuk Slash Command Autocomplete (misalnya pencarian kata di /antitoxic delete)
  if (interaction.isAutocomplete()) {
    const command = interaction.client.commands.get(interaction.commandName);
    if (command && typeof command.autocomplete === 'function') {
      try {
        await command.autocomplete(interaction);
      } catch (err) {
        console.error(`Autocomplete error untuk /${interaction.commandName}:`, err);
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  // Pemeriksaan Mode Pemeliharaan (Maintenance Mode)
  try {
    const maintenance = getMaintenanceConfig();
    if (maintenance.enabled) {
      const isOwner = await isBotOwner(interaction);
      if (!isOwner) {
        const inviteUrl = getOfficialInviteUrl();
        const websiteUrl = getOfficialWebsiteUrl();
        const maintEmbed = new EmbedBuilder()
          .setColor(0xed4245)
          .setAuthor({
            name: 'FlyBot System Maintenance',
            iconURL: interaction.client.user.displayAvatarURL({ dynamic: true }),
          })
          .setTitle('Bot Sedang Dalam Pemeliharaan (Maintenance)')
          .setDescription(
            `Mohon maaf atas ketidaknyamanannya! FlyBot saat ini sedang dalam proses pemeliharaan & optimalisasi oleh Developer.\n\n` +
            `> **Catatan Pemeliharaan:**\n` +
            `> *${maintenance.reason || 'Pembaruan sistem & optimalisasi jaringan bot.'}*\n\n` +
            `Silakan kunjungi website resmi atau pantau pengumuman status pemulihan bot di Server Komunitas FlyBot.`
          )
          .setFooter({ text: 'FlyBot Maintenance System • Developer Only' })
          .setTimestamp();

        const maintRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Website Resmi (flyneuroai.com)')
            .setStyle(ButtonStyle.Link)
            .setURL(websiteUrl),
          new ButtonBuilder()
            .setLabel('Server Komunitas Discord')
            .setStyle(ButtonStyle.Link)
            .setURL(inviteUrl)
        );

        return interaction.reply({
          embeds: [maintEmbed],
          components: [maintRow],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  } catch (maintErr) {
    console.error('[MAINTENANCE CHECK ERROR]:', maintErr);
  }

  // Catat eksekusi perintah untuk statistik realtime
  try {
    recordCommandExecution();
  } catch {}

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Tidak ada command yang cocok dengan nama ${interaction.commandName}`);
    return;
  }

  // Validasi Channel Khusus Musik untuk Server Template All-in-One (1 Paket: play, pause, resume, stop, skip, queue, repeat, shuffle, volume)
  const MUSIC_COMMAND_NAMES = ['play', 'pause', 'resume', 'stop', 'skip', 'queue', 'repeat', 'shuffle', 'volume'];
  if (interaction.guild && MUSIC_COMMAND_NAMES.includes(interaction.commandName)) {
    const { getTemplateConfig } = require('./templateSetupHelper');
    const templateCfg = getTemplateConfig(interaction.guild.id);
    if (templateCfg?.allInOneConfigured && templateCfg?.channels?.playMusicId) {
      if (interaction.channelId !== templateCfg.channels.playMusicId) {
        return interaction.reply({
          content: `Seluruh perintah musik hanya dapat digunakan di channel <#${templateCfg.channels.playMusicId}>.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }
  }

  // Error handling try/catch agar bot tetap berjalan stabil
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Terjadi error saat menjalankan command /${interaction.commandName}:`, error);

    const errorMessage = {
      content: 'Terjadi kesalahan internal saat menjalankan perintah ini.',
      flags: MessageFlags.Ephemeral,
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage).catch(console.error);
    } else {
      await interaction.reply(errorMessage).catch(console.error);
    }
  }
});

// Event saat ada member baru yang bergabung (Welcome)
client.on(Events.GuildMemberAdd, async (member) => {
  try {
    const channel = await resolveChannel(member.guild, 'welcome');
    if (!channel) {
      console.log(`[WELCOME] Member ${member.user.tag} bergabung, tapi channel welcome tidak ditemukan.`);
      return;
    }

    const embed = createWelcomeEmbed(member);
    await channel.send({
      content: `👋 Selamat datang, <@${member.id}>!`,
      embeds: [embed],
    });
    console.log(`[WELCOME] Mengirim sambutan untuk ${member.user.tag} di #${channel.name}`);

    // Berikan Auto-Role jika aktif
    const autoRoleId = getAutoRole(member.guild.id);
    if (autoRoleId) {
      const role = member.guild.roles.cache.get(autoRoleId) || await member.guild.roles.fetch(autoRoleId).catch(() => null);
      if (role) {
        await member.roles.add(role).catch(console.error);
        console.log(`[AUTOROLE] Berhasil memberikan role ${role.name} ke ${member.user.tag}`);
      }
    }

    // Berikan Role Belum Verifikasi jika sistem verifikasi aktif dan ada role belum verif
    const { getVerifConfig } = require('./verifHelper');
    const verifCfg = getVerifConfig(member.guild.id);
    if (verifCfg.enabled && verifCfg.unverifiedRoleId) {
      const unverifiedRole =
        member.guild.roles.cache.get(verifCfg.unverifiedRoleId) ||
        (await member.guild.roles.fetch(verifCfg.unverifiedRoleId).catch(() => null));
      if (unverifiedRole) {
        await member.roles.add(unverifiedRole).catch(console.error);
        console.log(`[VERIF] Memberikan role belum verif ${unverifiedRole.name} ke ${member.user.tag}`);
      }
    }
  } catch (error) {
    console.error('Error saat memproses member baru (welcome/autorole/verif):', error);
  } finally {
    updateServerStats(member.guild).catch(console.error);
  }
});

// Event saat ada member yang meninggalkan server (Leave)
client.on(Events.GuildMemberRemove, async (member) => {
  try {
    const channel = await resolveChannel(member.guild, 'leave');
    if (!channel) {
      console.log(`[LEAVE] Member ${member.user.tag} keluar, tapi channel leave tidak ditemukan.`);
      return;
    }

    const embed = createLeaveEmbed(member);
    await channel.send({
      embeds: [embed],
    });
    console.log(`[LEAVE] Mengirim perpisahan untuk ${member.user.tag} di #${channel.name}`);
  } catch (error) {
    console.error('Error saat mengirim pesan leave:', error);
  } finally {
    updateServerStats(member.guild).catch(console.error);

    // Audit Log: Member Keluar
    try {
      const { sendAuditLog } = require('./logHelper');
      const memberLog = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Member Meninggalkan Server')
        .setDescription(`**${member.user.tag}** (\`${member.id}\`) telah keluar atau dikeluarkan dari server.`)
        .addFields(
          { name: 'Bergabung Server', value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:F>` : '-', inline: true },
          { name: 'Role Terakhir', value: member.roles.cache.filter(r => r.id !== member.guild.id).map(r => `<@&${r.id}>`).join(', ') || 'Tidak ada', inline: true }
        )
        .setTimestamp();
      sendAuditLog(member.guild, memberLog);
    } catch {}
  }
});

// Event saat bot dimasukkan ke server baru
client.on(Events.GuildCreate, async (guild) => {
  try {
    await handleGuildCreate(guild, client);
  } catch (err) {
    console.error('[GUILD CREATE] Error:', err);
  }
});

// Event saat bot dikeluarkan dari server
client.on(Events.GuildDelete, async (guild) => {
  try {
    await handleGuildDelete(guild, client);
  } catch (err) {
    console.error('[GUILD DELETE] Error:', err);
  }
});

// Event saat ada perubahan voice channel (Join-to-Create, Auto Delete, & Patroli Auto-Reconnect)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState);
  } catch (error) {
    console.error('Error saat handleVoiceStateUpdate:', error);
  }

  // Jika bot terputus dari voice channel padahal mode patroli aktif, sambungkan kembali otomatis
  try {
    if (oldState.member?.id === client.user.id && !newState.channelId) {
      if (isPatroliActive(oldState.guild.id)) {
        const cfg = getPatroliConfig(oldState.guild.id);
        if (cfg?.voiceChannelId) {
          const channel = oldState.guild.channels.cache.get(cfg.voiceChannelId);
          if (channel) {
            schedulePatroliReconnect(oldState.guild.id, channel, 3000);
          }
        }
      } else {
        cancelPatroliReconnect(oldState.guild.id);
      }
    }
  } catch (e) {
    console.error('[PATROLI RECONNECT] Error:', e);
  }
});

// Event saat channel dihapus (Sinkronisasi konfigurasi Private AI & Ticket jika channel dihapus)
client.on(Events.ChannelDelete, async (channel) => {
  // Bersihkan paired text channel jika voice channel sementara dihapus manual
  try {
    await handleVoiceChannelDelete(channel);
  } catch {}
  if (isPrivateAiChannel(channel.id)) {
    unregisterPrivateChannel(channel.id);
    console.log(`[PRIVATE AI] Channel ${channel.id} telah dihapus dan dibersihkan dari database.`);
  }

  try {
    const { closeTicket } = require('./ticketHelper');
    closeTicket(channel.id);
  } catch {}

  try {
    const { getStatsConfig, setStatsConfig } = require('./serverStatsHelper');
    const cfg = getStatsConfig(channel.guild?.id);
    if (cfg && cfg.enabled) {
      if (channel.id === cfg.categoryId) {
        setStatsConfig(channel.guild.id, { categoryId: null, enabled: false });
      } else if (channel.id === cfg.memberChannelId) {
        setStatsConfig(channel.guild.id, { memberChannelId: null });
      } else if (channel.id === cfg.adminChannelId) {
        setStatsConfig(channel.guild.id, { adminChannelId: null });
      } else if (channel.id === cfg.activeChannelId) {
        setStatsConfig(channel.guild.id, { activeChannelId: null });
      }
    }
  } catch {}

  try {
    const { getGameConfig, setGameConfig } = require('./gameHelper');
    const cfg = getGameConfig(channel.guild?.id);
    if (cfg && cfg.enabled) {
      if (channel.id === cfg.categoryId) {
        setGameConfig(channel.guild.id, { categoryId: null, enabled: false });
      } else if (channel.id === cfg.coinChannelId) {
        setGameConfig(channel.guild.id, { coinChannelId: null });
      } else if (channel.id === cfg.numberChannelId) {
        setGameConfig(channel.guild.id, { numberChannelId: null });
      } else if (channel.id === cfg.rpsChannelId) {
        setGameConfig(channel.guild.id, { rpsChannelId: null });
      }
    }
  } catch {}

  try {
    const { getLogConfig, setLogConfig } = require('./logHelper');
    const cfg = getLogConfig(channel.guild?.id);
    if (cfg && cfg.enabled) {
      if (channel.id === cfg.categoryId) {
        setLogConfig(channel.guild.id, { categoryId: null, enabled: false });
      } else if (channel.id === cfg.channelId) {
        setLogConfig(channel.guild.id, { channelId: null, enabled: false });
      }
    }
  } catch {}
});

// Event saat role member diperbarui (Audit Log)
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  try {
    const { sendAuditLog } = require('./logHelper');
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));

    if (addedRoles.size > 0 || removedRoles.size > 0) {
      const logEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Perubahan Role Member')
        .setDescription(`Perubahan role untuk <@${newMember.id}> (\`${newMember.user.tag}\`)`)
        .setTimestamp();

      if (addedRoles.size > 0) {
        logEmbed.addFields({ name: 'Role Ditambahkan', value: addedRoles.map(r => `<@&${r.id}>`).join(', ') });
      }
      if (removedRoles.size > 0) {
        logEmbed.addFields({ name: 'Role Dicabut', value: removedRoles.map(r => `<@&${r.id}>`).join(', ') });
      }

      sendAuditLog(newMember.guild, logEmbed);
    }
  } catch (err) {
    console.error('Error saat log GuildMemberUpdate:', err);
  }
});

// Event saat pesan dihapus (Audit Log)
client.on(Events.MessageDelete, async (message) => {
  if (!message.guild || message.author?.bot) return;

  try {
    const { sendAuditLog } = require('./logHelper');
    const logEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Pesan Dihapus')
      .addFields(
        { name: 'Pengirim', value: message.author ? `<@${message.author.id}> (\`${message.author.id}\`)` : 'Tidak diketahui', inline: true },
        { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
        { name: 'Waktu Dibuat', value: message.createdTimestamp ? `<t:${Math.floor(message.createdTimestamp / 1000)}:R>` : '-', inline: true },
        { name: 'Isi Pesan', value: message.content ? (message.content.length > 1024 ? message.content.substring(0, 1020) + '...' : message.content) : '*(Tidak ada teks / hanya media)*' }
      );

    if (message.attachments?.size > 0) {
      const attachList = message.attachments.map(a => a.url).join('\n');
      logEmbed.addFields({ name: 'Lampiran File', value: attachList.substring(0, 1024) });
    }

    logEmbed.setTimestamp();
    sendAuditLog(message.guild, logEmbed);
  } catch (err) {
    console.error('Error saat log MessageDelete:', err);
  }
});

// Event saat pesan diedit (Audit Log)
client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
  if (!oldMessage.guild || oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  try {
    const { sendAuditLog } = require('./logHelper');
    const logEmbed = new EmbedBuilder()
      .setColor(0xFEE75C)
      .setTitle('Pesan Diedit')
      .addFields(
        { name: 'Pengirim', value: `<@${newMessage.author.id}> (\`${newMessage.author.id}\`)`, inline: true },
        { name: 'Channel', value: `<#${newMessage.channelId}>`, inline: true },
        { name: 'Tautan Pesan', value: `[Buka Pesan](${newMessage.url})`, inline: true },
        { name: 'Sebelum Diedit', value: oldMessage.content ? (oldMessage.content.length > 1024 ? oldMessage.content.substring(0, 1020) + '...' : oldMessage.content) : '*(Tidak ada teks)*' },
        { name: 'Sesudah Diedit', value: newMessage.content ? (newMessage.content.length > 1024 ? newMessage.content.substring(0, 1020) + '...' : newMessage.content) : '*(Tidak ada teks)*' }
      )
      .setTimestamp();

    sendAuditLog(newMessage.guild, logEmbed);
  } catch (err) {
    console.error('Error saat log MessageUpdate:', err);
  }
});

// Event saat ada pesan baru (Leveling XP System & AI Chat)
client.on(Events.MessageCreate, async (message) => {
  // Abaikan pesan dari bot
  if (message.author.bot) return;

  // 1. Respon Otomatis di DM Pribadi (100% Rahasia - Tidak bisa dilihat oleh Admin/siapapun di server)
  if (!message.guild) {
    try {
      await message.channel.sendTyping().catch(() => {});
      const aiRes = await askAI(message.author.id, message.content);
      if (aiRes.success) {
        if (aiRes.reply.length <= 1900) {
          await message.reply(aiRes.reply).catch(console.error);
        } else {
          const aiEmbed = new EmbedBuilder()
            .setColor(0x10A37F)
            .setDescription(aiRes.reply.substring(0, 3900))
            .setFooter({ text: 'BotFly AI Intelligence • Copyright © BotFly' });
          await message.reply({ embeds: [aiEmbed] }).catch(console.error);
        }
      } else {
        await message.reply(`❌ Maaf, gagal memproses: ${aiRes.error}`).catch(console.error);
      }
    } catch (err) {
      console.error('Error saat respon DM AI:', err);
    }
    return;
  }

  // === FITUR REQUEST FITUR DI SERVER OFFICIAL (OTOMATIS KONVERSI PESAN KE TIKET USULAN) ===
  try {
    const isHandledRequest = await require('./featureRequestHelper').handleRawMessageInRequestChannel(message);
    if (isHandledRequest) return;
  } catch (err) {
    console.error('Error saat handleRawMessageInRequestChannel:', err);
  }

  // === FITUR AUTOMOD: 1. ANTI-PHISHING & SCAM LINKS ===
  const phishCheck = checkPhishing(message.content);
  if (phishCheck.isPhishing) {
    try {
      await message.delete().catch(() => {});
      const warnMsg = await message.channel.send({
        content: `⚠️ <@${message.author.id}>, pesan kamu dihapus otomatis karena mengandung tautan berbahaya / scam / phishing! Mohon jaga keamanan server.`
      });
      setTimeout(() => warnMsg.delete().catch(() => {}), 10000);
      return;
    } catch (err) {
      console.error('Error saat hapus link phishing:', err);
    }
  }

  // === FITUR AUTOMOD: 2. ANTI-TOXIC (DELETE + BALAS JANGAN TOCIK BRAYY) ===
  const toxicCheck = checkToxic(message.guild.id, message.content);
  if (toxicCheck.isToxic) {
    try {
      await message.delete().catch(() => {});
      const warnMsg = await message.channel.send({
        content: `jangan tocik brayy <@${message.author.id}> 🗿`
      });
      setTimeout(() => warnMsg.delete().catch(() => {}), 7000);
      return;
    } catch (err) {
      console.error('Error saat menghapus pesan toxic:', err);
    }
  }

  // === FITUR KHUSUS CHANNEL TEMPLATE KOMUNITAS & ENTERTAINMENT ===
  if (message.guild && message.channel?.name) {
    const chName = message.channel.name.toLowerCase();

    // 1. Channel AI Generating, AI Prompt, AI Fanart: Otomatis diskusi bareng BotFly AI (Respon Privat: Only you can see this)
    if (chName.includes('ai-generating') || chName.includes('ai-prompt') || chName.includes('ai-promt') || chName.includes('ai-fanart')) {
      if (!message.content.startsWith('/') && !message.content.startsWith('!')) {
        try {
          await message.channel.sendTyping().catch(() => {});

          let aiType = 'generating';
          if (chName.includes('fanart')) aiType = 'fanart';
          else if (chName.includes('promt') || chName.includes('prompt')) aiType = 'prompt';

          // Ekstrak URL gambar jika ada attachment (terutama untuk review/inspirasi di ai-fanart)
          const attachedImage = message.attachments.find(att => att.contentType?.startsWith('image/'))?.url || null;
          const userPrompt = message.content.trim() || (attachedImage ? 'Tolong review dan beri kritik seni visual untuk karya ini bray' : '');

          if (userPrompt || attachedImage) {
            const aiRes = await askEntertainmentAI({
              channelType: aiType,
              userId: message.author.id,
              prompt: userPrompt,
              imageUrl: attachedImage,
              authorName: message.member?.displayName || message.author.username || 'Temen',
            });
            if (aiRes.success) {
              const resId = `ai_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              entertainmentAiStorage.set(resId, {
                userId: message.author.id,
                channelType: aiType,
                prompt: userPrompt,
                reply: aiRes.reply,
                createdAt: Date.now(),
              });

              const openBtn = new ButtonBuilder()
                .setCustomId(`btn_ephemeral_ai_${resId}`)
                .setLabel('Lihat Jawaban AI (Hanya Kamu)')
                .setStyle(ButtonStyle.Primary);
              const row = new ActionRowBuilder().addComponents(openBtn);

              const promptShort = userPrompt.length > 100 ? userPrompt.substring(0, 97) + '...' : userPrompt;
              const promptLine = promptShort ? `\n> *"${promptShort}"*` : '';

              await message.reply({
                content: `<@${message.author.id}>, jawaban AI kamu sudah siap! Klik tombol di bawah untuk membacanya secara privat:${promptLine}`,
                components: [row],
              }).catch(console.error);
            } else {
              await message.reply(`Waduh, AI lagi pusing bray: ${aiRes.error}`).catch(() => {});
            }
          }
        } catch (e) {
          console.error('Error auto AI entertainment channel:', e);
        }
      }
    }

    // 2. Auto-Reactions untuk Galeri Kreatif & Hiburan
    if (chName.includes('fotografi')) {
      // Channel fotografi
    } else if (chName.includes('videografi')) {
      // Channel videografi
    }
  }

  // === FITUR AUTO-DOWNLOAD / CONVERT SOSMED (TIKTOK, INSTAGRAM, FACEBOOK, YOUTUBE) ===
  if (message.guild && !message.author.bot && message.channel?.name) {
    const {
      getExpectedPlatform,
      detectPlatform,
      extractUrls,
      handleMediaConvert,
      PLATFORM_INFO,
    } = require('./mediaConvertHelper');

    const expectedPlatform = getExpectedPlatform(message.channel.name);
    if (expectedPlatform) {
      const urls = extractUrls(message.content);

      if (urls.length > 0) {
        const targetUrl = urls[0];
        const detectedPlatform = detectPlatform(targetUrl);

        if (detectedPlatform && detectedPlatform !== expectedPlatform) {
          // SALAH LAPAK!
          const expInfo = PLATFORM_INFO[expectedPlatform];
          const detInfo = PLATFORM_INFO[detectedPlatform];

          const correctChannel = message.guild.channels.cache.find(
            (c) => c.name.toLowerCase().includes(detInfo.channelKeyword)
          );
          const channelMention = correctChannel ? `<#${correctChannel.id}>` : `#${detInfo.channelKeyword}`;

          const warnMsg = await message.reply({
            content: `Salah lapak lu bray! 🗿 Link yang lo kirim itu link **${detInfo.name}**, harusnya kirim ke channel ${channelMention}! Di sini khusus lapak **${expInfo.name}** ya.`,
          });
          setTimeout(() => warnMsg.delete().catch(() => {}), 10000);
          return;
        }

        if (detectedPlatform && detectedPlatform === expectedPlatform) {
          // LAPAK BENAR! Eksekusi konversi media
          await handleMediaConvert(message, targetUrl, expectedPlatform);
          return;
        }
      }
    }
  }

  // === FITUR AUTO-HD DI CHANNEL KHUSUS HD FOTO ===
  const isHdTarget = (message.guild && isHdChannel(message.guild.id, message.channel.id)) ||
    (message.guild && message.channel?.name && message.channel.name.toLowerCase().includes('hd-foto'));
  if (isHdTarget) {
    const targetImageUrl = extractImageUrlFromMessage(message);
    if (targetImageUrl) {
      try {
        const cleanContent = message.content.trim().toLowerCase();
        const scale = cleanContent.includes('2x') || cleanContent.includes(' 2') ? 2 : 4;
        const processingMsg = await message.reply('Sedang memproses dan meningkatkan kualitas gambar kamu bray, tunggu sebentar...');

        const result = await enhanceImage(targetImageUrl, { scale });
        if (result.success) {
          const file = new AttachmentBuilder(result.buffer, { name: result.fileName });
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Peningkatan Kualitas Gambar Selesai')
            .setDescription(
              `Gambar kamu berhasil ditingkatkan dengan AI Super-Resolution.\n\n` +
              `• Resolusi Awal: **${result.originalWidth}x${result.originalHeight}**\n` +
              `• Resolusi Baru: **${result.newWidth}x${result.newHeight}** (${result.scale}x HD)\n` +
              `• Mesin: **${result.engine || 'AI Super-Resolution HD'}**\n` +
              `• Waktu Proses: **${(result.processTimeMs / 1000).toFixed(1)} detik**\n\n` +
              `> **Cara Melihat Kualitas Asli:**\n` +
              `> Discord otomatis mengecilkan preview di chat. **Klik foto di atas, lalu klik "Buka yang asli" di pojok kiri bawah** untuk melihat gambar penuh tanpa kompresi Discord!`
            )
            .setImage(`attachment://${result.fileName}`)
            .setFooter({ text: `FlyBot Auto-HD • Diminta oleh ${message.author.username}` })
            .setTimestamp();

          await processingMsg.edit({
            content: null,
            embeds: [embed],
            files: [file],
          });
        } else {
          await processingMsg.edit({
            content: `Gagal memproses gambar: ${result.error}`,
          });
        }
        return;
      } catch (err) {
        console.error('Error saat Auto-HD di channel khusus:', err);
      }
    }
  }

  // === FITUR HD GAMBAR (CAPTION /hd ATAU REPLY FOTO /hd) ===
  const cleanContent = message.content.trim().toLowerCase();
  const isHdCommand =
    cleanContent === '/hd' ||
    cleanContent.startsWith('/hd ') ||
    cleanContent === '!hd' ||
    cleanContent.startsWith('!hd ');

  if (isHdCommand) {
    try {
      let targetImageUrl = extractImageUrlFromMessage(message);

      // Jika pesan sendiri tidak ada attachment gambar, periksa apakah me-reply pesan lain
      if (!targetImageUrl && message.reference && message.reference.messageId) {
        const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
        if (repliedMessage) {
          targetImageUrl = extractImageUrlFromMessage(repliedMessage);
        }
      }

      if (targetImageUrl) {
        const scale = cleanContent.includes('2x') || cleanContent.includes(' 2') ? 2 : 4;
        const processingMsg = await message.reply('Sedang memproses dan meningkatkan kualitas gambar kamu bray, tunggu sebentar...');

        const result = await enhanceImage(targetImageUrl, { scale });
        if (result.success) {
          const file = new AttachmentBuilder(result.buffer, { name: result.fileName });
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Peningkatan Kualitas Gambar Selesai')
            .setDescription(
              `Gambar kamu berhasil ditingkatkan dengan AI Super-Resolution.\n\n` +
              `• Resolusi Awal: **${result.originalWidth}x${result.originalHeight}**\n` +
              `• Resolusi Baru: **${result.newWidth}x${result.newHeight}** (${result.scale}x HD)\n` +
              `• Mesin: **${result.engine || 'AI Super-Resolution HD'}**\n` +
              `• Waktu Proses: **${(result.processTimeMs / 1000).toFixed(1)} detik**\n\n` +
              `> **Cara Melihat Kualitas Asli:**\n` +
              `> Discord otomatis mengecilkan preview di chat. **Klik foto di atas, lalu klik "Buka yang asli" di pojok kiri bawah** untuk melihat gambar penuh tanpa kompresi Discord!`
            )
            .setImage(`attachment://${result.fileName}`)
            .setFooter({ text: `FlyBot Image Enhancer • Diminta oleh ${message.author.username}` })
            .setTimestamp();

          await processingMsg.edit({
            content: null,
            embeds: [embed],
            files: [file],
          });
        } else {
          await processingMsg.edit({
            content: `Gagal memproses gambar: ${result.error}`,
          });
        }
        return;
      } else {
        await message.reply('Tidak ditemukan gambar untuk di-HD-in bray. Kirim gambar langsung dengan caption `/hd`, atau reply foto orang lain lalu ketik `/hd`.');
        return;
      }
    } catch (err) {
      console.error('Error saat memproses HD gambar di chat:', err);
    }
  }

  // === FITUR AFK: 1. HAPUS STATUS AFK SAAT USER MENGIRIM PESAN ===
  const userAfk = removeAfk(message.guild.id, message.author.id);
  if (userAfk) {
    // Kembalikan nickname jika diawali [AFK]
    if (message.member && message.guild.members.me.permissions.has('ManageNicknames')) {
      const curNick = message.member.displayName;
      if (curNick.startsWith('[AFK]')) {
        await message.member.setNickname(curNick.replace('[AFK]', '').trim()).catch(() => {});
      }
    }
    const welcomeBack = await message.channel.send({
      content: `👋 Selamat datang kembali <@${message.author.id}>! Status AFK kamu telah dinonaktifkan.`
    });
    setTimeout(() => welcomeBack.delete().catch(() => {}), 6000);
  }

  // === FITUR AFK: 2. BERI TAHU JIKA MENTION USER YANG SEDANG AFK ===
  if (message.mentions.users.size > 0) {
    for (const [mentionedId, mentionedUser] of message.mentions.users) {
      if (mentionedUser.bot) continue;
      const targetAfk = getAfk(message.guild.id, mentionedId);
      if (targetAfk) {
        const timeAgo = Math.floor((Date.now() - targetAfk.timestamp) / 1000 / 60);
        const afkWarn = await message.reply({
          content: `💤 **${mentionedUser.username}** sedang AFK sejak ${timeAgo > 0 ? `${timeAgo} menit lalu` : 'baru saja'}.\n> Alasan: *${targetAfk.reason}*`
        });
        setTimeout(() => afkWarn.delete().catch(() => {}), 10000);
      }
    }
  }

  // === MINI GAMES: CHAT GAMEPLAY (TEBAK ANGKA, TEBAK KOIN, SUIT JEPANG) ===
  try {
    const {
      getGameConfig,
      checkNumberGuess,
      startNumberGuessing,
      getNumberGameRow,
      getCoinGameRow,
      getRpsGameRow
    } = require('./gameHelper');
    const { addReward } = require('./levelingHelper');
    const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
    const gameCfg = getGameConfig(message.guild.id);
    const chLower = (message.channel.name || '').toLowerCase();

    // 1. Tebak Angka
    const isNumberChannel = (gameCfg && gameCfg.enabled && message.channel.id === gameCfg.numberChannelId) ||
      chLower.includes('tebak-angka');
    if (isNumberChannel) {
      const trimmed = message.content.trim();
      const guessNum = parseInt(trimmed, 10);
      if (!isNaN(guessNum) && String(guessNum) === trimmed && guessNum >= 1 && guessNum <= 100) {
        let res = checkNumberGuess(message.guild.id, guessNum);
        if (!res) {
          startNumberGuessing(message.guild.id, message.author.id);
          res = checkNumberGuess(message.guild.id, guessNum);
        }
        if (res.status === 'LOW') {
          message.reply(`[Terlalu KECIL] Angka **${guessNum}** masih lebih kecil dari angka rahasia. Coba angka yang lebih besar!`).catch(() => {});
        } else if (res.status === 'HIGH') {
          message.reply(`[Terlalu BESAR] Angka **${guessNum}** masih lebih besar dari angka rahasia. Coba angka yang lebih kecil!`).catch(() => {});
        } else if (res.status === 'CORRECT') {
          const bonusCoins = res.attempts <= 3 ? 200 : res.attempts <= 6 ? 150 : res.attempts <= 10 ? 100 : 70;
          const xpEarned = 100;
          const reward = addReward(message.guild.id, message.author.id, { coins: bonusCoins, xp: xpEarned, isWin: true });
          dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, reward).catch(() => {});

          let extraLevelText = reward.leveledUp ? `\n\n**LEVEL UP!** Selamat <@${message.author.id}> naik ke **Level ${reward.newLevel}**!` : '';

          const winEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Tebakan Tepat • Pemenang Juara')
            .setDescription(
              `Selamat <@${message.author.id}>, angka rahasianya memang **${res.target}**!\n\n` +
              `• Berhasil ditebak dalam **${res.attempts} percobaan**\n` +
              `• Hadiah Juara: **+${bonusCoins} Koin** & **+${xpEarned} XP**` +
              extraLevelText +
              `\n\n*Klik tombol **Main Lagi** di bawah untuk langsung mulai ronde baru!*`
            )
            .setTimestamp();
          message.channel.send({ embeds: [winEmbed], components: [getNumberGameRow()] }).catch(() => {});
        }
      }
    }

    // 2. Tebak Koin Chat Gameplay
    const isCoinChannel = (gameCfg && gameCfg.enabled && message.channel.id === gameCfg.coinChannelId) ||
      chLower.includes('tebak-koin');
    if (isCoinChannel) {
      const txt = message.content.trim().toLowerCase();
      let guess = null;
      if (txt === 'gambar' || txt === 'heads') guess = 'gambar';
      else if (txt === 'angka' || txt === 'tails') guess = 'angka';
      else if (txt === 'lempar' || txt === 'acak' || txt === 'koin' || txt === 'flip') guess = 'random';

      if (guess) {
        const flip = Math.random() < 0.5 ? 'gambar' : 'angka';
        const flipName = flip === 'gambar' ? 'Gambar' : 'Angka';

        if (guess === 'random') {
          const reward = addReward(message.guild.id, message.author.id, { coins: 5, xp: 5, isWin: false });
          let bonusText = `\n• Hadiah Partisipasi: +5 Koin & +5 XP`;
          if (reward.leveledUp) bonusText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

          message.reply({
            content: `**Hasil Lemparan Koin**\nKoin mendarat di sisi: **${flipName}**${bonusText}`,
            components: [getCoinGameRow()],
          }).catch(() => {});
          dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, reward).catch(() => {});
        } else {
          const guessName = guess === 'gambar' ? 'Gambar' : 'Angka';
          const won = guess === flip;
          const coinsEarned = won ? 50 : 0;
          const xpEarned = won ? 30 : 10;
          const reward = addReward(message.guild.id, message.author.id, { coins: coinsEarned, xp: xpEarned, isWin: won });

          let rewardText = won
            ? `\n• Hadiah Menang: **+${coinsEarned} Koin** & **+${xpEarned} XP**`
            : `\n• Hadiah Partisipasi: **+${xpEarned} XP**`;
          if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

          message.reply({
            content:
              `**Hasil Lemparan Koin**\n` +
              `• Sisi Koin: **${flipName}**\n` +
              `• Tebakan <@${message.author.id}>: **${guessName}**\n\n` +
              (won ? `Status: **Tebakan Tepat (Menang)**` : `Status: **Belum Tepat (Coba Lagi)**`) +
              `${rewardText}`,
            components: [getCoinGameRow()],
          }).catch(() => {});
          dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, reward).catch(() => {});
        }
      }
    }

    // 3. Suit Jepang Chat Gameplay
    const isRpsChannel = (gameCfg && gameCfg.enabled && message.channel.id === gameCfg.rpsChannelId) ||
      chLower.includes('suit-jepang');
    if (isRpsChannel) {
      const txt = message.content.trim().toLowerCase();
      let userChoice = null;
      if (txt === 'batu' || txt === 'rock') userChoice = 'batu';
      else if (txt === 'kertas' || txt === 'paper') userChoice = 'kertas';
      else if (txt === 'gunting' || txt === 'scissors') userChoice = 'gunting';

      if (userChoice) {
        const choices = ['batu', 'gunting', 'kertas'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        let result = 'draw';
        let won = false;
        if (userChoice === botChoice) {
          result = 'draw';
        } else if (
          (userChoice === 'batu' && botChoice === 'gunting') ||
          (userChoice === 'gunting' && botChoice === 'kertas') ||
          (userChoice === 'kertas' && botChoice === 'batu')
        ) {
          result = 'win';
          won = true;
        } else {
          result = 'lose';
        }

        const coinsEarned = result === 'win' ? 60 : result === 'draw' ? 15 : 0;
        const xpEarned = result === 'win' ? 40 : result === 'draw' ? 20 : 10;
        const reward = addReward(message.guild.id, message.author.id, { coins: coinsEarned, xp: xpEarned, isWin: won });

        let statusText = result === 'win' ? 'Kamu Menang' : result === 'draw' ? 'Seri' : 'Kamu Kalah';
        let rewardText = `\n• Hadiah: **+${coinsEarned} Koin** & **+${xpEarned} XP**`;
        if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

        message.reply({
          content:
            `**Hasil Suit Jepang**\n` +
            `• Pilihan Kamu: **${userChoice.toUpperCase()}**\n` +
            `• Pilihan Bot: **${botChoice.toUpperCase()}**\n\n` +
            `Status: **${statusText}**${rewardText}`,
          components: [getRpsGameRow()],
        }).catch(() => {});
        dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, reward).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Error saat mini game chat gameplay:', err);
  }

  try {
    const result = processMessage(message.guild.id, message.author.id);
    const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
    await dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, result);
  } catch (error) {
    console.error('Error saat memproses XP leveling:', error);
  }

  // 1. Respon Otomatis di Private AI Room (Chat langsung tanpa perlu / atau mention bot)
  if (isPrivateAiChannel(message.channel.id)) {
    try {
      await message.channel.sendTyping().catch(() => {});
      const aiRes = await askAI(message.author.id, message.content);
      if (aiRes.success) {
        if (aiRes.reply.length <= 1900) {
          await message.reply(aiRes.reply).catch(console.error);
        } else {
          const aiEmbed = new EmbedBuilder()
            .setColor(0x10A37F)
            .setDescription(aiRes.reply.substring(0, 3900))
            .setFooter({ text: 'BotFly AI Intelligence • Copyright © BotFly' });
          await message.reply({ embeds: [aiEmbed] }).catch(console.error);
        }
      } else {
        await message.reply(`❌ Maaf, gagal memproses: ${aiRes.error}`).catch(console.error);
      }
    } catch (err) {
      console.error('Error saat respon di private AI room:', err);
    }
    return;
  }

  // 2. Respon AI jika bot di-mention langsung di channel umum
  if (message.mentions.has(client.user) && !message.mentions.everyone) {
    const cleanPrompt = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();

    if (!cleanPrompt) {
      await message.reply('Yo bray! Kenalin gue **Fly**. Ada yang mau lo tanyain atau curhatin? Ketik aja setelah mention gue, atau pake `/ai` ya!').catch(console.error);
    } else {
      try {
        await message.channel.sendTyping().catch(() => {});
        const aiRes = await askAI(message.author.id, cleanPrompt);
        if (aiRes.success) {
          if (aiRes.reply.length <= 1900) {
            await message.reply(aiRes.reply).catch(console.error);
          } else {
            const aiEmbed = new EmbedBuilder()
              .setColor(0x10A37F)
              .setDescription(aiRes.reply.substring(0, 3900))
              .setFooter({ text: 'BotFly AI Intelligence • Copyright © BotFly' });
            await message.reply({ embeds: [aiEmbed] }).catch(console.error);
          }
        } else {
          await message.reply(`❌ Maaf, gagal memproses: ${aiRes.error}`).catch(console.error);
        }
      } catch (err) {
        console.error('Error bot mention AI:', err);
      }
    }
  }
});

// Validasi token sebelum login
const token = process.env.TOKEN;
if (!token) {
  console.error('❌ Error: TOKEN tidak ditemukan di file .env!');
  process.exit(1);
}

// Login ke Discord menggunakan token dari file .env
client.login(token).catch((err) => {
  console.error('❌ Error saat login ke Discord:', err.message || err);
  if (err.code === 'TokenInvalid') {
    console.error('================================================================');
    console.error('⚠️ TOKEN BOT DISCORD TIDAK VALID ATAU TELAH DI-RESET OLEH DISCORD!');
    console.error('👉 Solusi:');
    console.error('1. Buka https://discord.com/developers/applications');
    console.error('2. Pilih bot Anda -> Tab "Bot" -> Klik "Reset Token"');
    console.error('3. Salin token baru tersebut dan masukkan ke dalam file .env');
    console.error('================================================================');
  }
  process.exit(1);
});
