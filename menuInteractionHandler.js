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
      'cmd_setupserver',
      'cmd_setuptempvoice',
      'cmd_setupstats',
      'cmd_setupaichat',
      'cmd_autorole',
      'cmd_antitoxic'
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
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      if (queue.paused) return interaction.reply({ content: 'Musik sudah dalam keadaan dijeda.', flags: MessageFlags.Ephemeral });
      queue.pause();
      return interaction.reply({ content: 'Musik telah dijeda.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_resume') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      if (!queue.paused) return interaction.reply({ content: 'Musik sedang diputar (tidak dijeda).', flags: MessageFlags.Ephemeral });
      queue.resume();
      return interaction.reply({ content: 'Musik dilanjutkan kembali.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_skip') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      try {
        const song = await queue.skip();
        return interaction.reply({ content: `Lagu dilewati ke: ${song.name}`, flags: MessageFlags.Ephemeral });
      } catch {
        await queue.stop();
        return interaction.reply({ content: 'Tidak ada lagu lagi di antrean. Musik dihentikan.', flags: MessageFlags.Ephemeral });
      }
    }

    if (val === 'cmd_stop') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      await queue.stop();
      return interaction.reply({ content: 'Musik dihentikan dan antrean dibersihkan.', flags: MessageFlags.Ephemeral });
    }

    if (val === 'cmd_queue') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({ content: 'Antrean musik saat ini kosong.', flags: MessageFlags.Ephemeral });
      }
      const currentSong = queue.songs[0];
      const nextSongs = queue.songs.slice(1, 11);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Antrean Musik Saat Ini')
        .setDescription(
          `**Sedang Diputar:**\n[${currentSong.name}](${currentSong.url}) - \`${currentSong.formattedDuration}\`\n\n` +
          `**Lagu Berikutnya:**\n` +
          (nextSongs.length > 0
            ? nextSongs.map((s, i) => `**${i + 1}.** [${s.name}](${s.url}) - \`${s.formattedDuration}\``).join('\n')
            : '*(Tidak ada antrean selanjutnya)*')
        )
        .setFooter({ text: `Total: ${queue.songs.length} lagu | Volume: ${queue.volume}%` });
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

    // --- AKSI COMMAND ADMIN (SUDAH LOLOS CEK PERMISSION) ---
    if (val === 'cmd_setupserver') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setupserver');
      if (cmd) return cmd.execute(interaction);
    }

    if (val === 'cmd_setuptempvoice') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setuptempvoice');
      if (cmd) return cmd.execute(interaction);
    }

    if (val === 'cmd_setupstats') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setupstats');
      if (cmd) return cmd.execute(interaction);
    }

    if (val === 'cmd_setupaichat') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setupaichat');
      if (cmd) return cmd.execute(interaction);
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
      const query = interaction.fields.getTextInputValue('music_query');
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await interaction.client.distube.play(voiceChannel, query, {
          textChannel: interaction.channel,
          member: member || interaction.member,
        });
        return interaction.editReply(`Memproses lagu: **${query}**`);
      } catch (err) {
        console.error('Distube modal play error:', err);
        return interaction.editReply(`Gagal memutar lagu: ${err.message}`);
      }
    }

    if (id === 'modal_music_volume') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: 'Tidak ada musik yang sedang diputar.', flags: MessageFlags.Ephemeral });
      const volStr = interaction.fields.getTextInputValue('volume_level');
      const volume = parseInt(volStr, 10);
      if (isNaN(volume) || volume < 1 || volume > 100) {
        return interaction.reply({ content: 'Harap masukkan angka volume antara 1 sampai 100.', flags: MessageFlags.Ephemeral });
      }
      queue.setVolume(volume);
      return interaction.reply({ content: `Volume musik berhasil diatur ke ${volume}%.`, flags: MessageFlags.Ephemeral });
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
