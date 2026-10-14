const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embedpreset')
    .setDescription('Mengirim embed informasi atau rules dengan desain estetik siap pakai')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((option) =>
      option
        .setName('tema')
        .setDescription('Pilih tema desain estetik yang ingin dikirim')
        .setRequired(true)
        .addChoices(
          { name: '📜 Rules Server (Tata Tertib & Norma)', value: 'rules' },
          { name: 'ℹ️ Server Info & Guide (Panduan Channel & Role)', value: 'info' },
          { name: '📢 Pengumuman Resmi (Official Announcement)', value: 'announcement' },
          { name: '🎵 Panduan Bot Musik (Music Player Guide)', value: 'music' }
        )
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel tujuan pengiriman (default: channel saat ini)')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    ),

  async execute(interaction) {
    const tema = interaction.options.getString('tema');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

    const guild = interaction.guild;
    const guildIcon = guild.iconURL({ dynamic: true, size: 512 }) || undefined;

    let embed;
    let components = [];

    if (tema === 'rules') {
      embed = new EmbedBuilder()
        .setColor(0x2B2D31) // Warna Dark Slate mewah khas Discord
        .setAuthor({ name: `TATA TERTIB RESMI • ${guild.name.toUpperCase()}`, iconURL: guildIcon })
        .setTitle('📜 PERATURAN & ETIKA KOMUNITAS')
        .setDescription(
          `*Selamat datang di server **${guild.name}**! Untuk menjaga suasana tetap nyaman, asik, dan aman bagi semua anggota, mohon patuhi tata tertib berikut:*\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `**1. Saling Menghormati & Bersikap Ramah**\n` +
          `> Perlakukan setiap anggota dengan respek. Dilarang keras melakukan toxic berlebihan, ujaran kebencian, diskriminasi (SARA), bullying, atau pelecehan.\n\n` +
          `**2. Dilarang Spam & Flooding**\n` +
          `> Hindari spam chat beruntun, tag berulang-ulang (@everyone/@here), ear-rape di voice channel, atau mengirim media berulang yang mengganggu kenyamanan.\n\n` +
          `**3. Gunakan Channel Sesuai Fungsinya**\n` +
          `> Perhatikan topik masing-masing ruangan. Musik di voice & bot command di bot channel, obrolan santai di chat umum.\n\n` +
          `**4. Dilarang Promosi Liar (No Self-Promo / Ads)**\n` +
          `> Dilarang menyebarkan link invite server lain, jualan, atau promosi sosial media di publik maupun via DM tanpa izin dari Admin/Owner.\n\n` +
          `**5. Patuhi Arahan Moderator & TOS Discord**\n` +
          `> Keputusan tim staff bersifat mutlak demi kebaikan komunitas. Seluruh anggota wajib tunduk pada [Discord Terms of Service](https://discord.com/terms).\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `*Klik tombol di bawah jika kamu telah memahami dan menyetujui peraturan ini.*`
        )
        .setThumbnail(guildIcon)
        .setFooter({ text: `Dipublikasikan oleh Management ${guild.name}`, iconURL: guildIcon })
        .setTimestamp();

      const button = new ButtonBuilder()
        .setCustomId('rule_agree_btn')
        .setLabel('Saya Telah Membaca & Setuju')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success);

      components.push(new ActionRowBuilder().addComponents(button));
    } else if (tema === 'info') {
      embed = new EmbedBuilder()
        .setColor(0x5865F2) // Warna Blurple khas Discord
        .setAuthor({ name: `DIREKTORI & INFORMASI • ${guild.name.toUpperCase()}`, iconURL: guildIcon })
        .setTitle('🗺️ PANDUAN SERVER & NAVIGASI RUANGAN')
        .setDescription(
          `*Halo semuanya! Berikut adalah panduan singkat mengenai ruangan-ruangan penting yang ada di server **${guild.name}**:*\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `**💬 RUANG OBROLAN (TEXT)**\n` +
          `▸ **Chat Santai**: Tempat ngobrol santai, berbagi cerita, dan berkenalan.\n` +
          `▸ **Media / Foto**: Bagikan foto, screenshot, meme, dan karya kreatif kamu.\n` +
          `▸ **Bot Commands**: Tempat mengetik perintah bot agar chat umum tetap rapi.\n\n` +
          `**🔊 RUANG SUARA (VOICE)**\n` +
          `▸ **Lounge / Yapping**: Nongkrong dan ngobrol bareng teman-teman.\n` +
          `▸ **Music Room**: Khusus menyetel lagu bareng **FlyBot**.\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `*Butuh bantuan staff? Hubungi Admin atau Moderator yang sedang online!*`
        )
        .setThumbnail(guildIcon)
        .setFooter({ text: `Server didirikan untuk saling berteman dan bersenang-senang ✨` })
        .setTimestamp();
    } else if (tema === 'announcement') {
      embed = new EmbedBuilder()
        .setColor(0xFEE75C) // Warna Kuning Emas Elegan
        .setAuthor({ name: `PENGUMUMAN RESMI • ${guild.name.toUpperCase()}`, iconURL: guildIcon })
        .setTitle('📢 PEMBERITAHUAN PENTING')
        .setDescription(
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `**Kepada seluruh warga server ${guild.name}:**\n\n` +
          `Tulis isi pengumuman atau informasi update server kamu di sini.\n` +
          `Pesan ini didesain agar terlihat menonjol dan estetik di mata anggota server!\n\n` +
          `▸ **Poin Penting 1**: Informasi tanggal atau jadwal kegiatan.\n` +
          `▸ **Poin Penting 2**: Pembaruan sistem atau channel baru.\n` +
          `▸ **Poin Penting 3**: Pesan dari staff/owner server.\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `*Terima kasih atas perhatian dan kerja sama seluruh anggota!*`
        )
        .setThumbnail(guildIcon)
        .setFooter({ text: `Announcement Team • ${guild.name}` })
        .setTimestamp();
    } else if (tema === 'music') {
      embed = new EmbedBuilder()
        .setColor(0xEB459E) // Warna Pink Neon Estetik
        .setAuthor({ name: `FLYBOT MUSIC SYSTEM • ${guild.name.toUpperCase()}`, iconURL: guildIcon })
        .setTitle('🎧 CARA MENYETEL MUSIK BERSAMA FLYBOT')
        .setDescription(
          `*Nikmati musik berkualitas tinggi dari YouTube, Spotify, dan SoundCloud bersama teman-temanmu!*\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `**📌 PERINTAH DASAR:**\n` +
          `▸ \`/play lagu:<judul/link>\` : Memutar lagu atau memasukkan ke antrean.\n` +
          `▸ \`/queue\` : Melihat daftar antrean lagu berikutnya.\n` +
          `▸ \`/pause\` & \`/resume\` : Menjeda atau melanjutkan pemutaran.\n` +
          `▸ \`/skip\` : Melewati lagu ke lagu selanjutnya.\n` +
          `▸ \`/volume persen:<1-100>\` : Mengatur tingkat kekerasan suara.\n` +
          `▸ \`/stop\` : Menghentikan musik dan mengeluarkan bot.\n\n` +
          `✦ ━━━━━━━━━━━━━━━━━━━━━━━━ ✦\n\n` +
          `*💡 Tips: Kamu bisa langsung paste link playlist Spotify favoritmu ke dalam \`/play\`!*`
        )
        .setThumbnail(guildIcon)
        .setFooter({ text: `Diputar menggunakan FlyBot Audio Engine 🎵` })
        .setTimestamp();
    }

    try {
      await targetChannel.send({ embeds: [embed], components: components });

      await interaction.reply({
        content: `✅ Embed estetik bertema **${tema.toUpperCase()}** berhasil dikirim ke channel <#${targetChannel.id}>!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error saat mengirim preset embed:', error);
      await interaction.reply({
        content: `❌ Gagal mengirim embed: ${error.message || 'Pastikan bot punya izin Send Messages di channel tersebut!'}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
