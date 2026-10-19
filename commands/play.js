const { SlashCommandBuilder, MessageFlags, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { formatDuration, searchTrackWithFallback } = require('../lavalinkHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Memutar lagu satuan atau playlist (Spotify, YouTube, SoundCloud)')
    .addStringOption((option) =>
      option
        .setName('lagu')
        .setDescription('Ketik judul lagu - penyanyi atau link playlist Spotify / YouTube / SoundCloud')
        .setRequired(true)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Ambil GuildMember dari cache atau fetch dari server
    let member = interaction.member;
    if (!member?.voice) {
      member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }

    // 1. Cek voice channel user
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
      return interaction.reply({
        content: 'Kamu harus bergabung ke dalam Voice Channel terlebih dahulu sebelum memutar musik.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Cek izin bot di voice channel
    const botPermissions = voiceChannel.permissionsFor(interaction.client.user);
    if (botPermissions && !botPermissions.has(PermissionsBitField.Flags.Connect)) {
      return interaction.reply({
        content: `Bot tidak memiliki izin untuk bergabung (Connect) di voice channel ${voiceChannel.name}.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (botPermissions && !botPermissions.has(PermissionsBitField.Flags.Speak)) {
      return interaction.reply({
        content: `Bot tidak memiliki izin untuk bersuara (Speak) di voice channel ${voiceChannel.name}.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const lavalink = interaction.client.lavalink;
    if (!lavalink) {
      return interaction.reply({
        content: 'Layanan audio Lavalink belum aktif di sistem bot.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const query = interaction.options.getString('lagu').trim();
    await interaction.deferReply();

    try {
      // Ambil player yang sudah ada atau buat player baru
      let player = lavalink.getPlayer(interaction.guildId);
      if (!player) {
        player = lavalink.createPlayer({
          guildId: interaction.guild.id,
          voiceChannelId: voiceChannel.id,
          textChannelId: interaction.channel.id,
          selfDeaf: true,
          selfMute: false,
          volume: 100,
        });
      }

      // Pastikan player terhubung ke voice channel
      if (!player.connected) {
        await player.connect();
      } else if (player.voiceChannelId !== voiceChannel.id) {
        await player.changeVoiceState({ voiceChannelId: voiceChannel.id });
      }

      // Update text channel untuk notifikasi
      player.textChannelId = interaction.channel.id;

      // Cari lagu / playlist di Lavalink node (otomatis fallback cerdas bebas blokir YouTube)
      const res = await searchTrackWithFallback(player, query, interaction.user);

      if (!res || !res.tracks || res.tracks.length === 0 || res.loadType === 'empty') {
        return interaction.editReply(`Tidak ditemukan lagu atau playlist untuk: **${query}**`);
      }

      if (res.loadType === 'error') {
        return interaction.editReply(`Terjadi kendala saat memuat audio: ${res.exception?.message || 'Gagal terhubung ke sumber lagu.'}`);
      }

      const isUrl = /^https?:\/\//i.test(query);

      // KASUS 1: Playlist (Spotify Playlist, YouTube Playlist, dll)
      if (res.loadType === 'playlist') {
        await player.queue.add(res.tracks);

        // Jika bot belum memutar musik, langsung putar lagu pertama
        if (!player.playing && !player.paused) {
          await player.play();
        }

        const playlistTitle = res.playlist?.name || 'Playlist';
        const totalDuration = res.tracks.reduce((acc, t) => acc + (t.info?.duration || 0), 0);

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({ name: 'PLAYLIST ADDED' })
          .setTitle(playlistTitle.length > 250 ? playlistTitle.substring(0, 247) + '...' : playlistTitle)
          .setURL(isUrl ? query : null)
          .setDescription('> Berhasil menambahkan seluruh lagu playlist ke dalam antrean.')
          .addFields(
            { name: 'Jumlah Lagu', value: `\`${res.tracks.length} lagu\``, inline: true },
            { name: 'Total Durasi', value: `\`${formatDuration(totalDuration)}\``, inline: true },
            { name: 'Pemohon', value: `<@${interaction.user.id}>`, inline: true }
          )
          .setFooter({ text: 'Lavalink Audio System • Queue Updated' })
          .setTimestamp();

        if (res.tracks[0]?.info?.artworkUrl) {
          embed.setThumbnail(res.tracks[0].info.artworkUrl);
        }

        return interaction.editReply({ embeds: [embed] });
      }

      // KASUS 2: Lagu Satuan (Hasil pencarian judul lagu atau link lagu tunggal)
      const track = res.tracks[0];
      await player.queue.add(track);

      const isAlreadyPlaying = player.playing || player.paused;

      if (!isAlreadyPlaying) {
        await player.play();
      }

      const titleClean = track.info.title.length > 250
        ? track.info.title.substring(0, 247) + '...'
        : track.info.title;

      const embed = new EmbedBuilder()
        .setColor(isAlreadyPlaying ? 0x5865F2 : 0x1DB954)
        .setAuthor({ name: isAlreadyPlaying ? 'ADDED TO QUEUE' : 'NOW PLAYING' })
        .setTitle(titleClean)
        .setURL(track.info.uri || null)
        .setDescription(
          isAlreadyPlaying
            ? `> Berhasil ditambahkan ke dalam antrean.`
            : `> Voice Channel: <#${voiceChannel.id}>`
        )
        .addFields(
          { name: 'Artis', value: `\`${track.info.author || 'Tidak Diketahui'}\``, inline: true },
          { name: 'Durasi', value: `\`${formatDuration(track.info.duration)}\``, inline: true },
          { name: 'Pemohon', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({
          text: isAlreadyPlaying
            ? `Posisi Antrean: #${player.queue.tracks.length} • Lavalink Audio System`
            : 'Lavalink Audio System • High Fidelity',
        })
        .setTimestamp();

      if (track.info.artworkUrl) {
        embed.setThumbnail(track.info.artworkUrl);
      }

      return interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('[PLAY ERROR]:', error);
      return interaction.editReply(`Gagal memutar lagu: ${error.message || 'Terjadi kesalahan sistem'}`);
    }
  },
};
