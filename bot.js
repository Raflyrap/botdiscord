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
} = require('discord.js');
const { DisTube } = require('distube');
let YouTubePlugin;
try {
  YouTubePlugin = require('@distube/youtube').YouTubePlugin;
} catch (e) {
  try {
    const { execSync } = require('child_process');
    console.log('[DEPENDENCY] Mengunduh @distube/youtube...');
    execSync('npm install @distube/youtube --omit=dev --no-audit', { stdio: 'inherit' });
    YouTubePlugin = require('@distube/youtube').YouTubePlugin;
  } catch (err) {
    console.error('[DEPENDENCY] Gagal memuat @distube/youtube:', err.message);
  }
}
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YtDlpPlugin } = require('@distube/yt-dlp');
let ffmpegPath = require('ffmpeg-static');
try {
  const installer = require('@ffmpeg-installer/ffmpeg');
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    if (installer && installer.path && fs.existsSync(installer.path)) {
      ffmpegPath = installer.path;
    }
  }
} catch (e) {}
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

// Command yang dinonaktifkan sementara (fitur musik). Hapus dari daftar ini untuk mengaktifkan lagi.
// /stop tetap aktif karena dipakai untuk menghentikan /patroli.
const DISABLED_COMMANDS = ['play', 'pause', 'resume', 'skip', 'queue', 'volume'];

for (const file of commandFiles) {
  if (DISABLED_COMMANDS.includes(file.replace(/\.js$/, ''))) {
    console.log(`[SKIP] Command dinonaktifkan: /${file.replace(/\.js$/, '')}`);
    continue;
  }
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);

  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
    console.log(`[LOAD] Command loaded: /${command.data.name}`);
  } else {
    console.warn(`[PERINGATAN] File ${file} tidak memiliki properti "data" atau "execute" yang diperlukan.`);
  }
}

// Inisialisasi DisTube untuk audio streaming musik
// PENTING: Spotify dan SoundCloud diletakkan di awal agar lagu Spotify & pencarian umum
// langsung di-stream via SoundCloud, bebas dari batasan anti-bot YouTube di server hosting/Pterodactyl.
const musicPlugins = [
  new SpotifyPlugin(),
  new SoundCloudPlugin(),
];
if (YouTubePlugin) musicPlugins.push(new YouTubePlugin());
musicPlugins.push(new YtDlpPlugin({ update: false }));

const distubeOptions = {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: musicPlugins,
};

if (ffmpegPath && fs.existsSync(ffmpegPath)) {
  try {
    fs.chmodSync(ffmpegPath, 0o755);
  } catch (e) {}
  distubeOptions.ffmpeg = { path: ffmpegPath };
  console.log(`[FFMPEG] Menggunakan binary ffmpeg di: ${ffmpegPath}`);
} else {
  console.log('[FFMPEG] Menggunakan ffmpeg bawaan sistem (PATH)');
}

client.distube = new DisTube(client, distubeOptions);


// Event Listener DisTube untuk notifikasi otomatis di channel Discord
client.distube
  // Saat lagu mulai diputar
  .on('playSong', (queue, song) => {
    console.log(`[AUDIO PLAYING] Memutar: ${song.name} | Voice: ${queue.voice?.channel?.name || 'Voice'} | Guild: ${queue.textChannel?.guild?.name}`);
    const embed = new EmbedBuilder()
      .setColor(0x00FF7F)
      .setTitle('🎵 Sedang Memutar Lagu')
      .setDescription(`[${song.name}](${song.url})`)
      .addFields(
        { name: '⏱️ Durasi', value: `\`${song.formattedDuration}\``, inline: true },
        { name: '👤 Diminta Oleh', value: `${song.user}`, inline: true },
        { name: '🔊 Volume', value: `\`${queue.volume}%\``, inline: true }
      )
      .setThumbnail(song.thumbnail || null)
      .setTimestamp();

    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  })
  // Saat lagu ditambahkan ke antrean
  .on('addSong', (queue, song) => {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('➕ Ditambahkan ke Antrean')
      .setDescription(`[${song.name}](${song.url}) - \`${song.formattedDuration}\``)
      .setFooter({ text: `Diminta oleh ${song.user.tag}` });

    queue.textChannel?.send({ embeds: [embed] }).catch(console.error);
  })
  // Saat playlist ditambahkan
  .on('addList', (queue, playlist) => {
    queue.textChannel?.send(
      `📋 Menambahkan playlist **${playlist.name}** (${playlist.songs.length} lagu) ke antrean.`
    ).catch(console.error);
  })
  // Error handling audio streaming (DisTube v5: error, queue, song)
  .on('error', (error, queue, song) => {
    console.error('[DISTUBE ERROR]:', error?.message || error);
    const channel = queue?.textChannel;
    if (channel && typeof channel.send === 'function') {
      channel.send(`❌ Terjadi kendala saat memutar lagu **${song?.name || ''}**: ${error?.message || 'Sumber audio tidak tersedia'}`).catch(() => {});
    }
  })
  // Saat voice channel kosong (tetap tinggal jika mode patroli aktif)
  .on('empty', (queue) => {
    if (isPatroliActive(queue.id)) return;
    queue.textChannel?.send('👋 Voice channel kosong, bot meninggalkan voice channel.').catch(console.error);
  })
  // Saat seluruh antrean lagu telah selesai diputar
  .on('finish', (queue) => {
    if (isPatroliActive(queue.id)) return;
    queue.textChannel?.send('✅ Semua antrean musik telah selesai diputar.').catch(console.error);
  });

// Event saat bot berhasil terhubung dan siap digunakan
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot online! Masuk sebagai ${readyClient.user.tag}`);

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
      const type = interaction.customId.replace('btn_game_coin_', '');
      const flip = Math.random() < 0.5 ? 'gambar' : 'angka';
      const flipName = flip === 'gambar' ? 'Gambar' : 'Angka';

      if (type === 'random') {
        return interaction.reply({
          content: `**Hasil Lemparan Koin**\nKoin mendarat di sisi: **${flipName}**`,
          components: [getCoinGameRow()],
        });
      }

      const guessName = type === 'gambar' ? 'Gambar' : 'Angka';
      const won = type === flip;

      return interaction.reply({
        content:
          `**Hasil Lemparan Koin**\n` +
          `• Sisi Koin: **${flipName}**\n` +
          `• Tebakan <@${interaction.user.id}>: **${guessName}**\n\n` +
          (won
            ? `Status: **Tebakan Tepat (Menang)**`
            : `Status: **Belum Tepat (Coba Lagi)**`),
        components: [getCoinGameRow()],
      });
    }

    // === MINI GAMES: 2. SUIT JEPANG (GUNTING BATU KERTAS) ===
    if (interaction.customId.startsWith('btn_game_rps_')) {
      const { getRpsGameRow } = require('./gameHelper');
      const userChoice = interaction.customId.replace('btn_game_rps_', '');
      const choices = ['rock', 'paper', 'scissors'];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      const choiceMap = {
        rock: 'Batu',
        paper: 'Kertas',
        scissors: 'Gunting',
      };

      let resultText = '';
      if (userChoice === botChoice) {
        resultText = 'Hasil: **Seri**';
      } else if (
        (userChoice === 'rock' && botChoice === 'scissors') ||
        (userChoice === 'paper' && botChoice === 'rock') ||
        (userChoice === 'scissors' && botChoice === 'paper')
      ) {
        resultText = 'Hasil: **Kamu Menang**';
      } else {
        resultText = 'Hasil: **Kamu Kalah**';
      }

      return interaction.reply({
        content:
          `**Duel Suit**\n` +
          `• <@${interaction.user.id}>: **${choiceMap[userChoice]}**\n` +
          `• FlyBot: **${choiceMap[botChoice]}**\n\n` +
          `${resultText}`,
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
          const winEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('Tebakan Tepat  •  Pemenang')
            .setDescription(
              `Selamat <@${message.author.id}>, angka rahasianya memang **${res.target}**!\n\n` +
              `Berhasil ditebak dalam **${res.attempts} percobaan**.\n\n` +
              `*Klik tombol **Main Lagi** di bawah untuk langsung mulai ronde baru tanpa perlu scroll.*`
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


    const lvlHelper = require('./levelingHelper');
    const lvlCfg = lvlHelper.getLevelConfig(message.guild.id);
    const resolveChannel = (id) => {
      const ch = id ? message.guild.channels.cache.get(id) : null;
      return ch && ch.isTextBased() ? ch : message.channel;
    };

    const { buildLevelUpEmbed, buildAchievementEmbed } = require('./levelEmbeds');
    const ctx = { member: message.member, user: message.author, guild: message.guild };

    // Notifikasi level up (channel khusus level-up)
    if (result.leveledUp) {
      const levelUpEmbed = buildLevelUpEmbed(ctx, {
        oldLevel: result.oldLevel,
        newLevel: result.newLevel,
        xp: result.userData.xp,
        totalMessages: result.userData.totalMessages,
        position: lvlHelper.getUserRank(message.guild.id, message.author.id),
      });

      await resolveChannel(lvlCfg.levelUpChannel)
        .send({ content: `<@${message.author.id}>`, embeds: [levelUpEmbed] })
        .catch(console.error);
    }

    // Notifikasi achievement baru (channel khusus achievement)
    if (result.newAchievements.length > 0) {
      const achChannel = resolveChannel(lvlCfg.achievementChannel);
      for (const ach of result.newAchievements) {
        const achEmbed = buildAchievementEmbed(ctx, ach, result.userData.achievements.length);
        await achChannel.send({ embeds: [achEmbed] }).catch(console.error);
      }
    }
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
