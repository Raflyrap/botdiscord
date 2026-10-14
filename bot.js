// Memuat variabel lingkungan dari file .env
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { Client, Collection, GatewayIntentBits, Partials, Events, EmbedBuilder, MessageFlags } = require('discord.js');
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');
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
// Load sodium for voice encryption
try { require('libsodium-wrappers'); } catch (e) {}
// Load opus encoder for voice audio
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

// Inisialisasi DisTube untuk audio streaming musik
const distubeOptions = {
  emitNewSongOnly: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new YouTubePlugin(),
    new SpotifyPlugin(),
    new SoundCloudPlugin(),
    new YtDlpPlugin({ update: false }),
  ],
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

// PENTING: Un-deafen bot saat voice connection sudah ready agar bot tidak berstatus tuli di Discord
client.distube.on('initQueue', (queue) => {
  const undeafen = () => {
    try {
      if (queue.voice && typeof queue.voice.setSelfDeaf === 'function') {
        queue.voice.setSelfDeaf(false);
      }
    } catch (e) {
      console.warn('[VOICE] Gagal setSelfDeaf:', e.message);
    }
  };

  const connection = queue.voice?.connection;
  if (connection) {
    if (connection.state?.status === 'ready') {
      undeafen();
    } else {
      connection.once('stateChange', (_, newState) => {
        if (newState.status === 'ready') {
          undeafen();
        }
      });
    }
  }
});

// Event Listener DisTube untuk notifikasi otomatis di channel Discord
client.distube
  // Saat lagu mulai diputar
  .on('playSong', (queue, song) => {

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
  // Error handling audio streaming
  .on('error', (channel, error) => {
    console.error('DisTube Error:', error);
    channel?.send?.(`❌ Terjadi error saat memutar audio: ${error.message || error}`).catch(console.error);
  })
  // Saat voice channel kosong
  .on('empty', (queue) => {
    queue.textChannel?.send('👋 Voice channel kosong, bot meninggalkan voice channel.').catch(console.error);
  })
  // Saat seluruh antrean lagu telah selesai diputar
  .on('finish', (queue) => {
    queue.textChannel?.send('✅ Semua antrean musik telah selesai diputar.').catch(console.error);
  });

// Event saat bot berhasil terhubung dan siap digunakan
client.once(Events.ClientReady, (readyClient) => {
  console.log(`✅ Bot online! Masuk sebagai ${readyClient.user.tag}`);

  // Inisialisasi dan perbarui statistik server berkala (setiap 10 menit)
  for (const [, guild] of readyClient.guilds.cache) {
    updateServerStats(guild).catch(console.error);
  }
  setInterval(() => {
    for (const [, guild] of client.guilds.cache) {
      updateServerStats(guild).catch(console.error);
    }
  }, 10 * 60 * 1000);
});

// Event saat ada interaksi (Slash Command, Button, Modal)
client.on(Events.InteractionCreate, async (interaction) => {
  // Handler untuk Menu Dashboard interaktif
  await handleMenuInteraction(interaction).catch(console.error);

  // Handler untuk klik tombol (Button)
  if (interaction.isButton()) {
    if (interaction.customId === 'rule_agree_btn') {
      return interaction.reply({
        content: `🎉 Terima kasih <@${interaction.user.id}>! Kamu telah membaca dan menyetujui seluruh tata tertib server **${interaction.guild.name}**. Selamat berinteraksi!`,
        flags: MessageFlags.Ephemeral,
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
  } catch (error) {
    console.error('Error saat mengirim pesan welcome / autorole:', error);
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

// Event saat ada perubahan voice channel (Join-to-Create & Auto Delete)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
    await handleVoiceStateUpdate(oldState, newState);
  } catch (error) {
    console.error('Error saat handleVoiceStateUpdate:', error);
  }
});

// Event saat channel dihapus (Sinkronisasi konfigurasi Private AI jika channel tersebut dihapus)
client.on(Events.ChannelDelete, async (channel) => {
  if (isPrivateAiChannel(channel.id)) {
    unregisterPrivateChannel(channel.id);
    console.log(`[PRIVATE AI] Channel ${channel.id} telah dihapus dan dibersihkan dari database.`);
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

  try {
    const result = processMessage(message.guild.id, message.author.id);


    // Notifikasi level up
    if (result.leveledUp) {
      const levelUpEmbed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🎉 LEVEL UP!')
        .setDescription(
          `Selamat <@${message.author.id}>! Kamu naik ke **Level ${result.newLevel}**!\n\n` +
          `✨ Total XP: \`${result.userData.xp.toLocaleString()}\`\n` +
          `💬 Total Pesan: \`${result.userData.totalMessages.toLocaleString()}\``
        )
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await message.channel.send({ embeds: [levelUpEmbed] }).catch(console.error);
    }

    // Notifikasi achievement baru
    if (result.newAchievements.length > 0) {
      for (const ach of result.newAchievements) {
        const achEmbed = new EmbedBuilder()
          .setColor(0xE91E63)
          .setTitle('🏅 ACHIEVEMENT UNLOCKED!')
          .setDescription(
            `<@${message.author.id}> membuka achievement baru:\n\n` +
            `${ach.emoji} **${ach.name}**\n` +
            `*${ach.desc}*`
          )
          .setTimestamp();

        await message.channel.send({ embeds: [achEmbed] }).catch(console.error);
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
client.login(token);
