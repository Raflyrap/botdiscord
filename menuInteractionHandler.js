const {
  MessageFlags,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const {
  createPlayModal,
  createVolumeModal,
  createAIModal,
  createAfkModal,
} = require('./menuHandler');
const { setAfk } = require('./afkHelper');
const { askAI } = require('./aiHelper');
const { getServerConfig, getAllBadwords } = require('./autoModHelper');
const { formatDuration } = require('./lavalinkHelper');

async function handleMenuInteraction(interaction) {
  // 1. SELECT MENU (Langsung aksi perintah)
  if (interaction.isStringSelectMenu() && interaction.customId === 'menu_direct_action') {
    const val = interaction.values[0];

    // Helper cek admin
    const isAdmin = interaction.member && (
      interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageGuild) ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)
    );

    // Proteksi Fitur Admin
    const adminCommands = [
      'cmd_autorole',
      'cmd_antitoxic',
      'cmd_setverif',
      'cmd_verif',
      'cmd_ticket',
      'cmd_stats',
      'cmd_game',
      'cmd_log',
      'cmd_setlevel',
      'cmd_leveltest'
    ];

    if (adminCommands.includes(val) && !isAdmin) {
      return interaction.reply({
        content: 'maaf hanya bisa admin',
        flags: MessageFlags.Ephemeral
      });
    }

    // --- AKSI COMMAND MUSIK ---
    if (val === 'cmd_play') {
      return interaction.showModal(createPlayModal());
    }

    if (val === 'cmd_pause') {
      const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
      if (!player || (!player.queue.current && player.queue.tracks.length === 0)) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      if (player.paused) return interaction.reply({ content: 'Musik sudah dalam keadaan dijeda.', flags: MessageFlags.Ephemeral });
      await player.pause();
      return interaction.reply({ content: '⏸️ Musik telah dijeda.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_resume') {
      const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
      if (!player || (!player.queue.current && player.queue.tracks.length === 0)) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar atau dijeda.', flags: MessageFlags.Ephemeral });
      if (!player.paused) return interaction.reply({ content: 'Musik sedang diputar (tidak dijeda).', flags: MessageFlags.Ephemeral });
      await player.resume();
      return interaction.reply({ content: '▶️ Musik dilanjutkan kembali.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_skip') {
      const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
      if (!player || !player.queue.current) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      try {
        const nextSong = player.queue.tracks[0];
        await player.skip();
        if (nextSong) {
          return interaction.reply({ content: `⏭️ Lagu dilewati ke: **${nextSong.info.title}**`, flags: MessageFlags.Ephemeral });
        } else {
          return interaction.reply({ content: '⏭️ Tidak ada lagu lagi di antrean. Pemutaran selesai.', flags: MessageFlags.Ephemeral });
        }
      } catch (err) {
        return interaction.reply({ content: `Gagal melewati lagu: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (val === 'cmd_stop') {
      const stopCmd = interaction.client.commands.get('stop');
      if (stopCmd) return stopCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah stop dijalankan.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_patroli') {
      const patroliCmd = interaction.client.commands.get('patroli');
      if (patroliCmd) return patroliCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah patroli tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_queue') {
      const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
      if (!player || (!player.queue.current && player.queue.tracks.length === 0)) {
        return interaction.reply({ content: 'Antrean musik saat ini kosong.', flags: MessageFlags.Ephemeral });
      }
      const currentSong = player.queue.current;
      const nextSongs = player.queue.tracks.slice(0, 10);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Antrean Musik Saat Ini')
        .setDescription(
          `**Sedang Diputar:**\n[**${currentSong.info.title}**](${currentSong.info.uri || ''}) - \`${formatDuration(currentSong.info.duration)}\`\n\n` +
          `**Lagu Berikutnya:**\n` +
          (nextSongs.length > 0
            ? nextSongs.map((s, i) => `**${i + 1}.** [${s.info.title}](${s.info.uri || ''}) - \`${formatDuration(s.info.duration)}\``).join('\n')
            : '*(Tidak ada antrean selanjutnya)*')
        )
        .setFooter({ text: `Total: ${(currentSong ? 1 : 0) + player.queue.tracks.length} lagu | Volume: ${player.volume}%` });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_volume') {
      return interaction.showModal(createVolumeModal());
    }

    // --- AKSI COMMAND UMUM ---
    if (val === 'cmd_ai') {
      return interaction.showModal(createAIModal());
    }

    if (val === 'cmd_afk') {
      return interaction.showModal(createAfkModal());
    }

    if (val === 'cmd_ping') {
      const pingCmd = interaction.client.commands.get('ping');
      if (pingCmd) return pingCmd.execute(interaction);
      return interaction.reply({ content: `Ping bot saat ini: ${interaction.client.ws.ping}ms`, flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_userinfo') {
      const userinfoCmd = interaction.client.commands.get('userinfo');
      if (userinfoCmd) return userinfoCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah userinfo tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_serverinfo') {
      const serverinfoCmd = interaction.client.commands.get('serverinfo');
      if (serverinfoCmd) return serverinfoCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah serverinfo tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    // --- AKSI COMMAND ADMIN (SUDAH LOLOS CEK PERMISSION) ---

    if (val === 'cmd_setverif') {
      const { getVerifConfig } = require('./verifHelper');
      const cfg = getVerifConfig(interaction.guildId);
      const verifiedRole = cfg.verifiedRoleId || cfg.roleId ? interaction.guild.roles.cache.get(cfg.verifiedRoleId || cfg.roleId) : null;
      const unverifiedRole = cfg.unverifiedRoleId ? interaction.guild.roles.cache.get(cfg.unverifiedRoleId) : null;
      const verifChannel = cfg.channelId ? interaction.guild.channels.cache.get(cfg.channelId) : null;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Pengaturan Kunci Channel & Verifikasi')
        .setDescription(
          `Konfigurasi saat ini:\n\n` +
          `• Role Sudah Verifikasi: ${verifiedRole ? `<@&${verifiedRole.id}>` : '*(Belum diatur)*'}\n` +
          `• Role Belum Verifikasi: ${unverifiedRole ? `<@&${unverifiedRole.id}>` : '*Menggunakan @everyone*'}\n` +
          `• Channel Verifikasi: ${verifChannel ? `<#${verifChannel.id}>` : '*(Belum diatur)*'}\n\n` +
          `Untuk mengatur role & otomatis menyembunyikan seluruh channel sebelum verifikasi, ketik perintah ini:\n` +
          `\`/setverif role_sudah_verif:@Member channel_verif:#verifikasi role_belum_verif:@Unverified\``
        )
        .setFooter({ text: 'Channel lain otomatis terkunci dari yang belum verif' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_verif') {
      const { getVerifConfig } = require('./verifHelper');
      const cfg = getVerifConfig(interaction.guildId);
      const role = cfg.roleId ? interaction.guild.roles.cache.get(cfg.roleId) : null;
      const ch = cfg.channelId ? interaction.guild.channels.cache.get(cfg.channelId) : null;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Sistem Verifikasi Server')
        .setDescription(
          `Status panel verifikasi saat ini:\n\n` +
          `• Status: **${cfg.enabled ? 'Aktif' : 'Nonaktif / Belum Diatur'}**\n` +
          `• Channel Panel: ${ch ? `<#${ch.id}>` : cfg.channelId ? `ID: ${cfg.channelId}` : '*(Belum diatur)*'}\n` +
          `• Role Diberikan: ${role ? `<@&${role.id}>` : cfg.roleId ? `ID: ${cfg.roleId}` : '*(Belum diatur)*'}\n\n` +
          `Untuk memasang panel verifikasi ber-tombol ke suatu channel, gunakan perintah:\n` +
          `\`/verif panel channel:#verifikasi role:@Member\``
        )
        .setFooter({ text: 'Member tinggal menekan tombol untuk verifikasi instan' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_ticket') {
      const { getGuildTicketConfig } = require('./ticketHelper');
      const cfg = getGuildTicketConfig(interaction.guildId);
      const ch = cfg.panelChannelId ? interaction.guild.channels.cache.get(cfg.panelChannelId) : null;
      const cat = cfg.categoryId ? interaction.guild.channels.cache.get(cfg.categoryId) : null;
      const staffRole = cfg.supportRoleId ? interaction.guild.roles.cache.get(cfg.supportRoleId) : null;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Sistem Tiket Bantuan Server')
        .setDescription(
          `Status panel tiket saat ini:\n\n` +
          `• Status: **${cfg.enabled ? 'Aktif' : 'Belum Dikonfigurasi'}**\n` +
          `• Channel Panel: ${ch ? `<#${ch.id}>` : '*(Belum diatur)*'}\n` +
          `• Kategori Tiket: ${cat ? `**${cat.name}**` : '*(Default / Tanpa kategori)*'}\n` +
          `• Role Staff/Admin: ${staffRole ? `<@&${staffRole.id}>` : '*(Semua Administrator)*'}\n` +
          `• Total Tiket Terbuat: \`${cfg.ticketCounter || 0}\` tiket\n\n` +
          `Untuk setup otomatis instan (kategori SUPPORT + channel langsung jadi):\n` +
          `Ketik: \`/ticket\`\n\n` +
          `Atau kustomisasi manual dengan:\n` +
          `\`/setticket channel:#channel-tiket kategori:Kategori role_staff:@Staff\``
        )
        .setFooter({ text: 'Member tinggal klik Buat Tiket untuk membuka channel obrolan privat' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_stats') {
      const { getStatsConfig } = require('./serverStatsHelper');
      const cfg = getStatsConfig(interaction.guildId);
      const isEnabled = cfg && cfg.enabled;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0x5865F2)
        .setTitle('Statistik Server Real-time')
        .setDescription(
          `Status: **${isEnabled ? 'Aktif' : 'Nonaktif'}**\n\n` +
          `• Kategori: ${cfg?.categoryId ? `<#${cfg.categoryId}>` : '*(Belum dibuat)*'}\n` +
          `• Total Member: ${cfg?.memberChannelId ? `<#${cfg.memberChannelId}>` : '*(Belum dibuat)*'}\n` +
          `• Total Admin: ${cfg?.adminChannelId ? `<#${cfg.adminChannelId}>` : '*(Belum dibuat)*'}\n` +
          `• Channel Aktif: ${cfg?.activeChannelId ? `<#${cfg.activeChannelId}>` : '*(Belum dibuat)*'}\n\n` +
          `**Perintah Kontrol:**\n` +
          `• \`/stats on\` : Aktifkan & buat channel counter otomatis di posisi teratas\n` +
          `• \`/stats off\` : Nonaktifkan & hapus semua channel counter statistik`
        )
        .setFooter({ text: 'Channel terkunci otomatis & angka terupdate realtime' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_game') {
      const { getGameConfig } = require('./gameHelper');
      const cfg = getGameConfig(interaction.guildId);
      const isEnabled = cfg && cfg.enabled;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0x5865F2)
        .setTitle('Arena Mini Games Interaktif')
        .setDescription(
          `Status: **${isEnabled ? 'Aktif' : 'Belum Dibuat'}**\n\n` +
          `• Kategori: ${cfg?.categoryId ? `<#${cfg.categoryId}>` : '*(Belum dibuat)*'}\n` +
          `• Tebak Koin: ${cfg?.coinChannelId ? `<#${cfg.coinChannelId}>` : '*(Belum dibuat)*'}\n` +
          `• Tebak Angka: ${cfg?.numberChannelId ? `<#${cfg.numberChannelId}>` : '*(Belum dibuat)*'}\n` +
          `• Suit Jepang: ${cfg?.rpsChannelId ? `<#${cfg.rpsChannelId}>` : '*(Belum dibuat)*'}\n\n` +
          `**Perintah Kontrol:**\n` +
          `• \`/game\` : Otomatis buat kategori & 3 channel game lengkap dengan panduannya\n` +
          `• \`/game aksi:Hapus\` : Hapus kategori & 3 channel game`
        )
        .setFooter({ text: '1 game = 1 channel dengan tombol & instruksi lengkap' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_log') {
      const { getLogConfig } = require('./logHelper');
      const cfg = getLogConfig(interaction.guildId);
      const isEnabled = cfg && cfg.enabled;

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0x57F287 : 0x5865F2)
        .setTitle('Sistem Audit Log Server')
        .setDescription(
          `Status: **${isEnabled ? 'Aktif Merekam' : 'Nonaktif / Belum Diatur'}**\n\n` +
          `• Kategori: ${cfg?.categoryId ? `<#${cfg.categoryId}>` : '*(Belum dibuat)*'}\n` +
          `• Channel Log: ${cfg?.channelId ? `<#${cfg.channelId}>` : '*(Belum dibuat)*'}\n\n` +
          `**Perintah Kontrol:**\n` +
          `• \`/log\` : Otomatis buat kategori AUDIT LOG & channel rahasia\n` +
          `• \`/log aksi:Hapus\` : Nonaktifkan & hapus channel audit log`
        )
        .setFooter({ text: 'Hanya bisa dilihat oleh Administrator' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_leveltest') {
      const leveltestCmd = interaction.client.commands.get('leveltest');
      if (leveltestCmd) return leveltestCmd.execute(interaction);
      return interaction.reply({ content: 'Perintah leveltest tidak ditemukan.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_setlevel') {
      const { getLevelConfig } = require('./levelingHelper');
      const cfg = getLevelConfig(interaction.guildId);
      const fmt = (id) => (id ? `<#${id}>` : '*Channel tempat user chat*');

      const embed = new EmbedBuilder()
        .setColor(0x9B59FF)
        .setTitle('Pengaturan Channel Leveling')
        .setDescription(
          `Status channel notifikasi saat ini:\n\n` +
          `• Level Up: ${fmt(cfg.levelUpChannel)}\n` +
          `• Achievement: ${fmt(cfg.achievementChannel)}\n\n` +
          `Untuk mengubah channel, ketik perintah ini di chat:\n` +
          `\`/setlevel channel_levelup:#level-up channel_achievement:#archivment\``
        )
        .setFooter({ text: 'Gunakan /setlevel reset:True untuk mengembalikan ke chat biasa' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_autorole') {
      return interaction.reply({
        content: 'Gunakan perintah `/autorole set <role>` langsung di chat untuk menentukan role anggota baru.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (val === 'cmd_antitoxic') {
      const config = getServerConfig(interaction.guildId);
      const allWords = getAllBadwords(interaction.guildId);
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Daftar Anti-Toxic Server')
        .setDescription(
          `Kata Khusus Server (${config.customBadwords.length}):\n` +
          (config.customBadwords.length > 0 ? config.customBadwords.map(w => `• \`${w}\``).join(', ') : '*(Belum ada kata khusus)*') +
          `\n\nTotal kata terdeteksi: \`${allWords.length}\` kata.`
        )
        .setFooter({ text: 'Ketik /antitoxic tambah <kata> di chat untuk menambah kata baru.' });
      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  }

  // 2. MODAL SUBMITS (Formulir setelah klik perintah)
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    if (id === 'modal_music_play') {
      let member = interaction.member;
      if (!member?.voice) {
        member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      }
      let voiceChannel = member?.voice?.channel;
      if (!voiceChannel && member?.voice?.channelId) {
        voiceChannel = await interaction.guild.channels.fetch(member.voice.channelId).catch(() => null);
      }
      if (!voiceChannel) {
        const vs = interaction.guild.voiceStates?.cache?.get(interaction.user.id);
        if (vs?.channelId) {
          voiceChannel = vs.channel || await interaction.guild.channels.fetch(vs.channelId).catch(() => null);
        }
      }
      if (!voiceChannel) {
        return interaction.reply({ content: 'Kamu harus bergabung ke voice channel terlebih dahulu.', flags: MessageFlags.Ephemeral });
      }
      const query = interaction.fields.getTextInputValue('music_query').trim();
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        let player = interaction.client.lavalink?.getPlayer(interaction.guildId);
        if (!player) {
          player = interaction.client.lavalink.createPlayer({
            guildId: interaction.guild.id,
            voiceChannelId: voiceChannel.id,
            textChannelId: interaction.channel.id,
            selfDeaf: true,
            selfMute: false,
            volume: 100,
          });
        }
        if (!player.connected) {
          await player.connect();
        } else if (player.voiceChannelId !== voiceChannel.id) {
          await player.changeVoiceState({ voiceChannelId: voiceChannel.id });
        }
        player.textChannelId = interaction.channel.id;

        const isUrl = /^https?:\/\//i.test(query);
        const searchOptions = isUrl ? { query } : { query, source: 'ytsearch' };
        const res = await player.search(searchOptions, interaction.user);

        if (!res || !res.tracks || res.tracks.length === 0 || res.loadType === 'empty') {
          return interaction.editReply(`❌ Tidak ditemukan lagu untuk: **${query}**`);
        }

        if (res.loadType === 'playlist') {
          await player.queue.add(res.tracks);
          if (!player.playing && !player.paused) await player.play();
          return interaction.editReply(`📋 Playlist **${res.playlist?.name || 'Playlist'}** (${res.tracks.length} lagu) berhasil ditambahkan ke antrean.`);
        }

        const track = res.tracks[0];
        await player.queue.add(track);
        if (!player.playing && !player.paused) await player.play();
        return interaction.editReply(`🎵 Ditambahkan ke antrean: **${track.info.title}**`);
      } catch (err) {
        console.error('Lavalink modal play error:', err);
        return interaction.editReply(`Gagal memutar lagu: ${err.message}`);
      }
    }

    if (id === 'modal_music_volume') {
      const player = interaction.client.lavalink?.getPlayer(interaction.guildId);
      if (!player || (!player.queue.current && player.queue.tracks.length === 0)) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      const volStr = interaction.fields.getTextInputValue('volume_level');
      const volume = parseInt(volStr, 10);
      if (isNaN(volume) || volume < 1 || volume > 100) {
        return interaction.reply({ content: 'Harap masukkan angka volume antara 1 sampai 100.', flags: MessageFlags.Ephemeral });
      }
      await player.setVolume(volume);
      return interaction.reply({ content: `🔊 Volume musik berhasil diatur ke ${volume}%.`, flags: MessageFlags.Ephemeral });
    }

    if (id === 'modal_ai_prompt') {
      const prompt = interaction.fields.getTextInputValue('ai_input');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const res = await askAI(interaction.user.id, prompt);
      if (res.success) {
        return interaction.editReply({
          content: `**Tanya:** ${prompt}\n\n**Jawaban:**\n${res.reply}`
        });
      } else {
        return interaction.editReply(`Gagal memproses AI: ${res.error}`);
      }
    }

    if (id === 'modal_afk_reason') {
      const reason = interaction.fields.getTextInputValue('afk_reason_input') || 'Sedang sibuk / AFK';
      setAfk(interaction.guild.id, interaction.user.id, reason);
      if (interaction.member && interaction.guild.members.me.permissions.has('ManageNicknames')) {
        const cur = interaction.member.displayName;
        if (!cur.startsWith('[AFK]')) {
          await interaction.member.setNickname(`[AFK] ${cur.substring(0, 25)}`).catch(() => {});
        }
      }
      return interaction.reply({
        content: `Status AFK kamu aktif: *${reason}* (otomatis lepas jika mengirim pesan).`,
        flags: MessageFlags.Ephemeral
      });
    }
  }
}

module.exports = { handleMenuInteraction };
