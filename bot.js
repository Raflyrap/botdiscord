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
const { handleVoiceStateUpdate } = require('./tempVoiceHelper');
const { updateServerStats } = require('./serverStatsHelper');
const { getAutoRole } = require('./autoRoleHelper');
const { handleMenuInteraction } = require('./menuInteractionHandler');
const { processMessage } = require('./levelingHelper');
const { askAI } = require('./aiHelper');
const { isPrivateAiChannel, unregisterPrivateChannel } = require('./privateAiHelper');
const { getAfk, removeAfk } = require('./afkHelper');
const { checkPhishing, checkToxic } = require('./autoModHelper');
const { isPatroliActive, getPatroliConfig, getAllPatroliConfigs, joinPatroliChannel } = require('./patroliHelper');
const { enhanceImage, extractImageUrlFromMessage, isHdChannel, setupHdChannel } = require('./imageHdHelper');

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
  console.log(`✅ Bot online! Masuk sebagai ${readyClient.user.tag}`);

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

  // Auto-setup channel khusus HD foto untuk server utama jika belum ada
  if (process.env.GUILD_ID) {
    const mainGuild = readyClient.guilds.cache.get(process.env.GUILD_ID);
    if (mainGuild) {
      setupHdChannel(mainGuild).catch((e) => console.warn('[AUTO-HD SETUP]:', e.message));
    }
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

  // Handler untuk klik tombol (Button)
  if (interaction.isButton()) {
    if (interaction.customId === 'rule_agree_btn') {
      return interaction.reply({
        content: `Terima kasih <@${interaction.user.id}>! Kamu telah membaca dan menyetujui seluruh tata tertib server ${interaction.guild.name}. Selamat berinteraksi!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Tombol Verifikasi Member
    if (interaction.customId === 'btn_do_verify') {
      try {
        const { getVerifConfig } = require('./verifHelper');
        const verifCfg = getVerifConfig(interaction.guildId);

        let targetRole = null;
        if (verifCfg.roleId) {
          targetRole =
            interaction.guild.roles.cache.get(verifCfg.roleId) ||
            (await interaction.guild.roles.fetch(verifCfg.roleId).catch(() => null));
        }

        // Fallback jika belum diatur atau role terhapus: cari role bernama 'member'
        if (!targetRole) {
          targetRole = interaction.guild.roles.cache.find((r) => r.name.toLowerCase() === 'member');
        }

        if (!targetRole) {
          targetRole = await interaction.guild.roles.create({
            name: 'Member',
            color: 0x57F287,
            reason: 'Role otomatis verifikasi',
          });
        }

        const botMember = interaction.guild.members.me;
        if (targetRole.position >= botMember.roles.highest.position) {
          return interaction.reply({
            content: 'Gagal verifikasi: Posisi role bot lebih rendah dari role verifikasi. Harap hubungi Admin server untuk memindahkan role bot ke posisi lebih atas.',
            flags: MessageFlags.Ephemeral,
          });
        }

        if (interaction.member.roles.cache.has(targetRole.id)) {
          return interaction.reply({
            content: 'Kamu sudah terverifikasi sebelumnya.',
            flags: MessageFlags.Ephemeral,
          });
        }

        await interaction.member.roles.add(targetRole);

        // Cabut role belum verifikasi jika ada
        if (verifCfg.unverifiedRoleId && interaction.member.roles.cache.has(verifCfg.unverifiedRoleId)) {
          await interaction.member.roles.remove(verifCfg.unverifiedRoleId).catch(console.error);
        }

        // Sembunyikan channel verifikasi dari user ini secara langsung
        if (interaction.channel?.permissionOverwrites) {
          await interaction.channel.permissionOverwrites.edit(interaction.user.id, {
            ViewChannel: false,
          }).catch(() => null);
        }

        return interaction.reply({
          content: 'Verifikasi berhasil! Seluruh channel telah terbuka. Selamat beraktivitas!',
          flags: MessageFlags.Ephemeral,
        });
      } catch (err) {
        console.error('Error saat verifikasi member:', err);
        return interaction.reply({
          content: `Gagal melakukan verifikasi: ${err.message}`,
          flags: MessageFlags.Ephemeral,
        });
      }
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
    if (interaction.customId.startsWith('btn_game_coin_')) {
      const { getCoinGameRow } = require('./gameHelper');
      const { addReward } = require('./levelingHelper');
      const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
      const type = interaction.customId.replace('btn_game_coin_', '');
      const flip = Math.random() < 0.5 ? 'gambar' : 'angka';
      const flipName = flip === 'gambar' ? 'Gambar' : 'Angka';

      if (type === 'random') {
        const reward = addReward(interaction.guildId, interaction.user.id, { coins: 5, xp: 5, isWin: false });
        dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward);
        let bonusText = `\n• Hadiah Partisipasi: +5 Koin & +5 XP`;
        if (reward.leveledUp) bonusText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;
        return interaction.reply({
          content: `**Hasil Lemparan Koin**\nKoin mendarat di sisi: **${flipName}**${bonusText}`,
          components: [getCoinGameRow()],
        });
      }

      const guessName = type === 'gambar' ? 'Gambar' : 'Angka';
      const won = type === flip;
      const coinsEarned = won ? 50 : 0;
      const xpEarned = won ? 30 : 10;
      const reward = addReward(interaction.guildId, interaction.user.id, { coins: coinsEarned, xp: xpEarned, isWin: won });
      dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward);

      let rewardText = won
        ? `\n• Hadiah Menang: **+${coinsEarned} Koin** & **+${xpEarned} XP**`
        : `\n• Hadiah Partisipasi: **+${xpEarned} XP**`;
      if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

      return interaction.reply({
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
    }

    // === MINI GAMES: 2. SUIT JEPANG (GUNTING BATU KERTAS) ===
    if (interaction.customId.startsWith('btn_game_rps_')) {
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
      dispatchLevelUpAndAchievements(interaction.guild, interaction.member, interaction.user, interaction.channel, reward);

      let rewardText = coinsEarned > 0
        ? `\n• Hadiah: **+${coinsEarned} Koin** & **+${xpEarned} XP**`
        : `\n• Hadiah Partisipasi: **+${xpEarned} XP**`;
      if (reward.leveledUp) rewardText += `\n**LEVEL UP!** Selamat naik ke **Level ${reward.newLevel}**!`;

      return interaction.reply({
        content:
          `**Duel Suit**\n` +
          `• <@${interaction.user.id}>: **${choiceMap[userChoice]}**\n` +
          `• FlyBot: **${choiceMap[botChoice]}**\n\n` +
          `${resultText}${rewardText}`,
        components: [getRpsGameRow()],
      });
    }

    // === MINI GAMES: 3. TEBAK ANGKA ===
    if (interaction.customId === 'btn_game_number_start') {
      const { startNumberGuessing } = require('./gameHelper');
      startNumberGuessing(interaction.guildId, interaction.user.id);

      return interaction.reply({
        content:
          `**Ronde Tebak Angka Dimulai** oleh <@${interaction.user.id}>\n` +
          `Angka rahasia antara **1 sampai 100** telah disiapkan.\n\n` +
          `Ketik angka tebakan kamu (1 - 100) langsung di channel ini untuk menebak.`,
      });
    }

    if (interaction.customId === 'btn_game_number_status') {
      const { getNumberGuessingState } = require('./gameHelper');
      const state = getNumberGuessingState(interaction.guildId);

      if (state && state.active) {
        return interaction.reply({
          content: `Ronde sedang aktif. Total tebakan: **${state.attempts}** kali. Ketik angka tebakan kamu (1 - 100) di chat.`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        return interaction.reply({
          content: `Belum ada ronde yang aktif. Klik tombol **Main Lagi** untuk memulai ronde baru.`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // === PROFILE & LEADERBOARD BUTTONS ===
    if (interaction.customId.startsWith('btn_profile_ach_')) {
      const targetId = interaction.customId.replace('btn_profile_ach_', '');
      const lvl = require('./levelingHelper');
      const uData = lvl.getUserData(interaction.guildId, targetId);
      const targetUser = await interaction.client.users.fetch(targetId).catch(() => interaction.user);

      const owned = uData.achievements || [];
      const lines = lvl.ACHIEVEMENTS.map((ach) => {
        const isOwned = owned.includes(ach.id);
        const status = isOwned ? '[TERBUKA]' : '[TERKUNCI]';
        return `> **${ach.tag || '[ACH]'} ${ach.name}**  --  ${status}\n> *${ach.desc}*`;
      });

      const achListEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`Daftar Prestasi  •  ${targetUser.username}`)
        .setDescription(
          `Total Terbuka: **${owned.length} / ${lvl.ACHIEVEMENTS.length}**\n\n` +
          lines.join('\n\n')
        )
        .setFooter({ text: 'Raih lebih banyak prestasi dengan aktif chat, bermain game, dan klaim harian.' })
        .setTimestamp();

      return interaction.reply({ embeds: [achListEmbed], flags: MessageFlags.Ephemeral });
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

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.client.commands.get(interaction.commandName);

  if (!command) {
    console.error(`Tidak ada command yang cocok dengan nama ${interaction.commandName}`);
    return;
  }

  // Error handling try/catch agar bot tetap berjalan stabil
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Terjadi error saat menjalankan command /${interaction.commandName}:`, error);

    const errorMessage = {
      content: '❌ Terjadi kesalahan internal saat menjalankan perintah ini!',
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

// Event saat ada perubahan voice channel (Join-to-Create, Auto Delete, & Patroli Auto-Reconnect)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState);
  } catch (error) {
    console.error('Error saat handleVoiceStateUpdate:', error);
  }

  // Jika bot terputus dari voice channel padahal mode patroli aktif, sambungkan kembali otomatis
  try {
    if (oldState.member?.id === client.user.id && !newState.channelId && isPatroliActive(oldState.guild.id)) {
      const cfg = getPatroliConfig(oldState.guild.id);
      if (cfg?.voiceChannelId) {
        const channel = oldState.guild.channels.cache.get(cfg.voiceChannelId);
        if (channel) {
          setTimeout(() => {
            if (isPatroliActive(oldState.guild.id)) {
              console.log(`[PATROLI] Bot terputus dari voice, menyambungkan kembali ke ${channel.name}...`);
              joinPatroliChannel(channel);
            }
          }, 3000);
        }
      }
    }
  } catch (e) {
    console.error('[PATROLI RECONNECT] Error:', e);
  }
});

// Event saat channel dihapus (Sinkronisasi konfigurasi Private AI & Ticket jika channel dihapus)
client.on(Events.ChannelDelete, async (channel) => {
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
            .setFooter({ text: `OpenAI ${aiRes.model}` });
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

  // === FITUR AUTO-HD DI CHANNEL KHUSUS HD FOTO ===
  if (message.guild && isHdChannel(message.guild.id, message.channel.id)) {
    const targetImageUrl = extractImageUrlFromMessage(message);
    if (targetImageUrl) {
      try {
        const cleanContent = message.content.trim().toLowerCase();
        const scale = cleanContent.includes('4x') || cleanContent.includes(' 4') ? 4 : 2;
        const processingMsg = await message.reply('Sedang memproses dan meningkatkan kualitas gambar kamu bray, tunggu sebentar...');

        const result = await enhanceImage(targetImageUrl, { scale });
        if (result.success) {
          const file = new AttachmentBuilder(result.buffer, { name: result.fileName });
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Peningkatan Kualitas Gambar Selesai')
            .setDescription(
              `Gambar kamu berhasil ditingkatkan dengan resolusi lebih tajam.\n\n` +
              `• Resolusi Awal: **${result.originalWidth}x${result.originalHeight}**\n` +
              `• Resolusi Baru: **${result.newWidth}x${result.newHeight}** (${result.scale}x HD)\n` +
              `• Waktu Proses: **${result.processTimeMs} ms**\n` +
              `• Algoritma: Lanczos3 Interpolator + Adaptive Unsharp Mask (Studio 4:4:4)`
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
        const scale = cleanContent.includes('4x') || cleanContent.includes(' 4') ? 4 : 2;
        const processingMsg = await message.reply('Sedang memproses dan meningkatkan kualitas gambar kamu bray, tunggu sebentar...');

        const result = await enhanceImage(targetImageUrl, { scale });
        if (result.success) {
          const file = new AttachmentBuilder(result.buffer, { name: result.fileName });
          const embed = new EmbedBuilder()
            .setColor(0x5865f2)
            .setTitle('Peningkatan Kualitas Gambar Selesai')
            .setDescription(
              `Gambar kamu berhasil ditingkatkan dengan resolusi lebih tajam.\n\n` +
              `• Resolusi Awal: **${result.originalWidth}x${result.originalHeight}**\n` +
              `• Resolusi Baru: **${result.newWidth}x${result.newHeight}** (${result.scale}x HD)\n` +
              `• Waktu Proses: **${result.processTimeMs} ms**\n` +
              `• Algoritma: Lanczos3 Interpolator + Adaptive Unsharp Mask (Studio 4:4:4)`
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

  // === MINI GAME: TEBAK ANGKA CHAT GUESS ===
  try {
    const { getGameConfig, checkNumberGuess, getNumberGameRow } = require('./gameHelper');
    const gameCfg = getGameConfig(message.guild.id);
    if (gameCfg && gameCfg.enabled && message.channel.id === gameCfg.numberChannelId) {
      const trimmed = message.content.trim();
      const guessNum = parseInt(trimmed, 10);
      if (!isNaN(guessNum) && String(guessNum) === trimmed && guessNum >= 1 && guessNum <= 100) {
        const res = checkNumberGuess(message.guild.id, guessNum);
        if (!res) {
          message.reply({
            content: 'Ronde tebak angka belum dimulai. Klik tombol **Main Lagi** di bawah untuk mulai bermain.',
            components: [getNumberGameRow()],
          }).catch(() => {});
        } else if (res.status === 'LOW') {
          message.reply(`[Terlalu KECIL] Angka **${guessNum}** masih lebih kecil dari angka rahasia. Coba angka yang lebih besar.`).catch(() => {});
        } else if (res.status === 'HIGH') {
          message.reply(`[Terlalu BESAR] Angka **${guessNum}** masih lebih besar dari angka rahasia. Coba angka yang lebih kecil.`).catch(() => {});
        } else if (res.status === 'CORRECT') {
          const { addReward } = require('./levelingHelper');
          const { dispatchLevelUpAndAchievements } = require('./levelEmbeds');
          const bonusCoins = res.attempts <= 3 ? 200 : res.attempts <= 6 ? 150 : res.attempts <= 10 ? 100 : 70;
          const xpEarned = 100;
          const reward = addReward(message.guild.id, message.author.id, { coins: bonusCoins, xp: xpEarned, isWin: true });
          dispatchLevelUpAndAchievements(message.guild, message.member, message.author, message.channel, reward);

          let extraLevelText = reward.leveledUp ? `\n\n**LEVEL UP!** Selamat <@${message.author.id}> naik ke **Level ${reward.newLevel}**!` : '';

          const winEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Tebakan Tepat  •  Pemenang Juara')
            .setDescription(
              `Selamat <@${message.author.id}>, angka rahasianya memang **${res.target}**!\n\n` +
              `• Berhasil ditebak dalam **${res.attempts} percobaan**\n` +
              `• Hadiah Juara: **+${bonusCoins} Koin** & **+${xpEarned} XP**` +
              extraLevelText +
              `\n\n*Klik tombol **Main Lagi** di bawah untuk langsung mulai ronde baru tanpa perlu scroll.*`
            )
            .setTimestamp();
          message.channel.send({ embeds: [winEmbed], components: [getNumberGameRow()] }).catch(() => {});
        }
      }
    }
  } catch (err) {
    console.error('Error saat tebak angka chat:', err);
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
            .setFooter({ text: `OpenAI ${aiRes.model}` });
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
              .setFooter({ text: `OpenAI ${aiRes.model}` });
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
