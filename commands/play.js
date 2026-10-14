const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Memutar musik dari YouTube, Spotify, atau SoundCloud')
    .addStringOption((option) =>
      option
        .setName('lagu')
        .setDescription('Judul lagu atau URL (YouTube, Spotify, SoundCloud)')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Validasi apakah bot sudah ada di server ini
    if (!interaction.guild) {
      return interaction.reply({
        content: '❌ Bot belum diundang ke server ini sebagai Bot Server! Silakan undang bot ke server ini terlebih dahulu agar bot bisa masuk ke voice channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Ambil GuildMember dari cache atau fetch dari server
    let member = interaction.member;
    if (!member?.voice) {
      member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    }

    // 1. Coba ambil dari member.voice.channel
    let voiceChannel = member?.voice?.channel;

    // 2. Jika channel object belum dicache tapi channelId ada
    if (!voiceChannel && member?.voice?.channelId) {
      voiceChannel = await interaction.guild.channels.fetch(member.voice.channelId).catch(() => null);
    }

    // 3. Jika masih belum ketemu, periksa voiceStates guild secara langsung
    if (!voiceChannel) {
      const vs = interaction.guild.voiceStates?.cache?.get(interaction.user.id);
      if (vs?.channelId) {
        voiceChannel = vs.channel || await interaction.guild.channels.fetch(vs.channelId).catch(() => null);
      }
    }

    // 4. Fallback: Cari di semua voice channel server ini apakah user ada di dalamnya
    if (!voiceChannel) {
      const channels = await interaction.guild.channels.fetch().catch(() => null);
      if (channels) {
        for (const [, ch] of channels) {
          if (ch?.isVoiceBased() && ch.members?.has(interaction.user.id)) {
            voiceChannel = ch;
            break;
          }
        }
      }
    }

    console.log(`[PLAY] User: ${interaction.user.tag} (${interaction.user.id}) di Server: ${interaction.guild.name} -> Voice Channel: ${voiceChannel ? voiceChannel.name : 'TIDAK TERDETEKSI'}`);

    // Jika user benar-benar tidak terdeteksi di voice channel server ini
    if (!voiceChannel) {
      return interaction.reply({
        content:
          '❌ Kamu harus masuk ke dalam salah satu **Voice Channel di server ini** terlebih dahulu sebelum memutar musik!\n' +
          '*Pastikan kamu sudah connect ke channel suara (seperti yapping) di server ini.*',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Cek izin bot untuk bergabung dan berbicara di voice channel
    const botPermissions = voiceChannel.permissionsFor(interaction.client.user);
    if (botPermissions && !botPermissions.has(PermissionsBitField.Flags.Connect)) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk bergabung (**Connect**) di voice channel **${voiceChannel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (botPermissions && !botPermissions.has(PermissionsBitField.Flags.Speak)) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk bersuara (**Speak**) di voice channel **${voiceChannel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const query = interaction.options.getString('lagu');

    // Beritahu Discord bahwa bot sedang memproses
    await interaction.deferReply();

    try {
      // Putar lagu menggunakan DisTube
      await interaction.client.distube.play(voiceChannel, query, {
        textChannel: interaction.channel,
        member: member,
      });

      await interaction.editReply(`🔍 Mencari dan memproses: **${query}**...`);
    } catch (error) {
      console.error('Error saat memutar lagu:', error);
      await interaction.editReply(`❌ Gagal memutar lagu: ${error.message || 'Terjadi kesalahan sistem'}`);
    }
  },
};
