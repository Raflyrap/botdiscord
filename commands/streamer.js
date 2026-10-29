const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const {
  ensureStreamerChannel,
  isStreamerChannel,
  checkYouTubeLive,
  checkTikTokLive,
  buildLiveEmbed,
  addStreamer,
  removeStreamer,
  getGuildStreamerConfig,
} = require('../streamerHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('streamer')
    .setDescription('Sistem notifikasi otomatis siaran langsung (Live Stream) YouTube & TikTok')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Daftarkan streamer YouTube atau kreator TikTok untuk dipantau notifikasinya')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Pilih platform siaran langsung')
            .setRequired(true)
            .addChoices(
              { name: 'YouTube Live', value: 'youtube' },
              { name: 'TikTok Live', value: 'tiktok' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('target')
            .setDescription('Handle/Channel ID YouTube (contoh: @WindahBasudara) atau Username TikTok')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('pesan')
            .setDescription('Pesan kustom pengumuman (contoh: @everyone Bang Windah udah live nih!)')
            .setRequired(false)
        )
        .addRoleOption((opt) =>
          opt
            .setName('role_ping')
            .setDescription('Role khusus yang ingin di-ping saat streamer mulai live')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('test')
        .setDescription('Uji coba preview tampilan kartu notifikasi live (Hanya bisa dilihat oleh Anda sendiri)')
        .addStringOption((opt) =>
          opt
            .setName('platform')
            .setDescription('Pilih platform yang ingin diuji coba tampilannya')
            .setRequired(false)
            .addChoices(
              { name: 'YouTube Live', value: 'youtube' },
              { name: 'TikTok Live', value: 'tiktok' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat daftar seluruh streamer YouTube & TikTok yang sedang aktif dipantau')
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Hapus streamer dari daftar pemantauan')
        .addStringOption((opt) =>
          opt
            .setName('target')
            .setDescription('Nama atau handle streamer yang ingin dihapus')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    const { guild, channel } = interaction;
    if (!guild) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server Discord.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // Pastikan channel notif sudah ada atau terdaftar
    const notifChannel = await ensureStreamerChannel(guild);

    // ==========================================
    // 1. SUBCOMMAND: TEST (Privat / Ephemeral)
    // ==========================================
    if (subcommand === 'test') {
      const platform = interaction.options.getString('platform') || 'youtube';

      let dummyData;
      if (platform === 'youtube') {
        dummyData = {
          channelName: 'Windah Basudara',
          title: 'GTA VI SIAP TAMAT 100% MALAM INI JUGA | NO CHEAT!',
          url: 'https://www.youtube.com',
          avatar: interaction.client.user.displayAvatarURL(),
          thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=1280&auto=format&fit=crop',
        };
      } else {
        dummyData = {
          nickname: 'Kreator TikTok Favorit',
          username: 'tiktok_creator',
          title: 'NGOBROL SANTAI MALAM MINGGU BARENG KALIAN SEMUA!',
          url: 'https://www.tiktok.com',
          avatar: interaction.client.user.displayAvatarURL(),
          cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1280&auto=format&fit=crop',
        };
      }

      const { embed, row } = buildLiveEmbed(platform, dummyData, true);

      // Sesuai permintaan user: Tampilan test HANYA BISA DILIHAT DIRI SENDIRI (Ephemeral)
      return interaction.reply({
        content: `🔍 **Preview Tampilan Notifikasi Siaran Langsung (${platform.toUpperCase()})**\n*Pesan ini bersifat rahasia/privat dan tidak dapat dilihat oleh anggota server lainnya.*`,
        embeds: [embed],
        components: [row],
        flags: MessageFlags.Ephemeral,
      });
    }

    // ==========================================
    // 2. SUBCOMMAND: ADD (Wajib di Channel Notif)
    // ==========================================
    if (subcommand === 'add') {
      // Validasi: Wajib dijalankan di channel notif stream
      const currentChannelIsOfficial = notifChannel && channel.id === notifChannel.id;

      if (!currentChannelIsOfficial) {
        return interaction.reply({
          content:
            `⚠️ **Perintah \`/streamer add\` hanya dapat dijalankan di channel <#${notifChannel.id}>!**\n\n` +
            `Silakan beralih ke channel tersebut untuk mendaftarkan streamer agar pengaturan tetap tertata rapi.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const platform = interaction.options.getString('platform');
      const target = interaction.options.getString('target').trim();
      const customMessage = interaction.options.getString('pesan') || '';
      const rolePing = interaction.options.getRole('role_ping') || null;

      let validName = target;
      let checkInfo = null;

      // Cek validitas target
      if (platform === 'youtube') {
        const yt = await checkYouTubeLive(target);
        if (yt.success && yt.channelName) {
          validName = yt.channelName;
        }
        checkInfo = yt;
      } else if (platform === 'tiktok') {
        const tt = await checkTikTokLive(target);
        if (tt.success && tt.nickname) {
          validName = `${tt.nickname} (@${tt.username})`;
        }
        checkInfo = tt;
      }

      // Daftarkan ke konfigurasi
      addStreamer(guild.id, {
        platform,
        target,
        name: validName,
        customMessage,
        roleId: rolePing ? rolePing.id : null,
      });

      const successEmbed = new EmbedBuilder()
        .setColor(platform === 'youtube' ? 0xED4245 : 0x00F2FE)
        .setAuthor({
          name: 'FlyBot • Streamer Berhasil Didaftarkan',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Berhasil Memantau Streamer: ${validName}`)
        .setDescription(
          `Streamer telah berhasil didaftarkan ke sistem pemantauan radar FlyBot!\n\n` +
          `Begitu **${validName}** memulai siaran langsung (Live) di **${platform.toUpperCase()}**, bot akan langsung otomatis mengirimkan pengumuman estetik ke channel ini.`
        )
        .addFields(
          { name: '📺 Platform', value: `\`${platform.toUpperCase()}\``, inline: true },
          { name: '🎯 Target / Akun', value: `\`${target}\``, inline: true },
          {
            name: '🔔 Role Ping',
            value: rolePing ? `<@&${rolePing.id}>` : '`Tidak Ada (Tanpa Ping)`',
            inline: true,
          },
          {
            name: '💬 Pesan Notifikasi',
            value: customMessage ? `*${customMessage}*` : '`Pesan Standar Default`',
            inline: false,
          }
        )
        .setFooter({ text: 'Status Live saat ini: ' + (checkInfo?.isLive ? '🔴 SEDANG LIVE' : '⚪ Sedang Offline') })
        .setTimestamp();

      return interaction.editReply({ embeds: [successEmbed] });
    }

    // ==========================================
    // 3. SUBCOMMAND: LIST
    // ==========================================
    if (subcommand === 'list') {
      const cfg = getGuildStreamerConfig(guild.id);
      const list = cfg.streamers || [];

      if (list.length === 0) {
        return interaction.reply({
          content:
            `Belum ada streamer yang didaftarkan di server ini.\n` +
            `Gunakan perintah \`/streamer add\` di channel <#${notifChannel.id}> untuk mulai memantau streamer favoritmu!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const listEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: `FlyBot • Daftar Pemantauan Streamer (${guild.name})`,
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Daftar Streamer Aktif (${list.length})`)
        .setDescription(
          `Semua notifikasi siaran langsung di bawah ini otomatis dikirim ke channel <#${notifChannel.id}>:`
        );

      list.forEach((s, idx) => {
        const icon = s.platform === 'youtube' ? '🔴 [YouTube]' : '🎵 [TikTok]';
        const status = s.isCurrentlyLive ? '` 🔴 LIVE ` ' : '` ⚪ Offline ` ';
        listEmbed.addFields({
          name: `${idx + 1}. ${icon} ${s.name || s.target}`,
          value:
            `• Target: \`${s.target}\`\n` +
            `• Status: ${status}\n` +
            `• Ping: ${s.roleId ? `<@&${s.roleId}>` : 'None'}\n` +
            (s.customMessage ? `• Pesan: *${s.customMessage}*` : ''),
          inline: false,
        });
      });

      listEmbed.setFooter({ text: 'Gunakan /streamer remove untuk berhenti memantau streamer' });
      listEmbed.setTimestamp();

      return interaction.reply({ embeds: [listEmbed], flags: MessageFlags.Ephemeral });
    }

    // ==========================================
    // 4. SUBCOMMAND: REMOVE
    // ==========================================
    if (subcommand === 'remove') {
      const target = interaction.options.getString('target').trim();
      const removed = removeStreamer(guild.id, target);

      if (!removed) {
        return interaction.reply({
          content: `❌ Streamer dengan target/nama \`${target}\` tidak ditemukan di daftar pemantauan server ini.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `✅ Berhasil menghapus **${target}** dari daftar pemantauan live stream.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
