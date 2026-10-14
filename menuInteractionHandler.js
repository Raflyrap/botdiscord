const {
  MessageFlags,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} = require('discord.js');
const {
  getMainDashboard,
  getMusicMenu,
  getRoomsMenu,
  getEmbedsMenu,
  getRolesMenu,
  getLevelingMenu,
  getInfoMenu,
  getAIMenu,
  createPlayModal,
  createVolumeModal,
  createCategoryModal,
  createChannelModal,
  createAIModal,
} = require('./menuHandler');
const { setTempVoiceConfig } = require('./tempVoiceHelper');
const { setGuildConfig, resolveChannel, createWelcomeEmbed, createLeaveEmbed } = require('./welcomeHelper');
const { calculateStats, setStatsConfig } = require('./serverStatsHelper');
const { getUserData, getUserRank, getLeaderboard, xpForLevel, currentLevelXp, createProgressBar, getRankTitle, ACHIEVEMENTS, getAchievementById } = require('./levelingHelper');
const { askAI, clearUserHistory, getUserHistoryCount } = require('./aiHelper');
const {
  createPrivateAiChannel,
  deletePrivateAiChannel,
  getPrivateAiChannelInfo,
  setPrivateAiConfig,
  getHubPanel,
} = require('./privateAiHelper');

async function handleMenuInteraction(interaction) {
  // 1. SELECT MENU
  if (interaction.isStringSelectMenu() && interaction.customId === 'menu_category_select') {
    const val = interaction.values[0];
    if (val === 'cat_music') return interaction.update(getMusicMenu(interaction.guild));
    if (val === 'cat_rooms') return interaction.update(getRoomsMenu(interaction.guild));
    if (val === 'cat_embeds') return interaction.update(getEmbedsMenu(interaction.guild));
    if (val === 'cat_roles') return interaction.update(getRolesMenu(interaction.guild));
    if (val === 'cat_leveling') return interaction.update(getLevelingMenu(interaction.guild, interaction.user));
    if (val === 'cat_ai') return interaction.update(getAIMenu(interaction.guild, interaction.user));
    if (val === 'cat_info') return interaction.update(getInfoMenu(interaction.guild, interaction.client));
  }

  // 2. BUTTONS
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (id === 'btn_back_to_main') {
      return interaction.update(getMainDashboard(interaction.guild));
    }

    // --- MUSIK ---
    if (id === 'btn_music_play') {
      return interaction.showModal(createPlayModal());
    }

    if (id === 'btn_music_pause') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', flags: MessageFlags.Ephemeral });
      if (queue.paused) return interaction.reply({ content: '⚠️ Musik sudah dalam keadaan dijeda!', flags: MessageFlags.Ephemeral });
      queue.pause();
      return interaction.reply({ content: '⏸️ Musik telah dijeda.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'btn_music_resume') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', flags: MessageFlags.Ephemeral });
      if (!queue.paused) return interaction.reply({ content: '⚠️ Musik sedang diputar (tidak dijeda)!', flags: MessageFlags.Ephemeral });
      queue.resume();
      return interaction.reply({ content: '▶️ Musik dilanjutkan kembali.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'btn_music_skip') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', flags: MessageFlags.Ephemeral });
      try {
        const song = await queue.skip();
        return interaction.reply({ content: `⏭️ Lagu dilewati ke: **${song.name}**`, flags: MessageFlags.Ephemeral });
      } catch {
        await queue.stop();
        return interaction.reply({ content: '⏭️ Tidak ada lagu lagi di antrean. Musik dihentikan.', flags: MessageFlags.Ephemeral });
      }
    }

    if (id === 'btn_music_stop') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', flags: MessageFlags.Ephemeral });
      await queue.stop();
      return interaction.reply({ content: '⏹️ Musik dihentikan dan antrean dibersihkan.', flags: MessageFlags.Ephemeral });
    }

    if (id === 'btn_music_queue') {
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue || !queue.songs || queue.songs.length === 0) {
        return interaction.reply({ content: '❌ Antrean musik saat ini kosong!', flags: MessageFlags.Ephemeral });
      }
      const currentSong = queue.songs[0];
      const nextSongs = queue.songs.slice(1, 11);
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎶 Antrean Musik Saat Ini')
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

    if (id === 'btn_music_volume') {
      return interaction.showModal(createVolumeModal());
    }

    // --- RUANGAN & SERVER ---
    if (id === 'btn_room_setupserver') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Hanya Administrator yang dapat menjalankan auto-setup!', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const setupserverCmd = interaction.client.commands.get('setupserver');
      if (setupserverCmd) return setupserverCmd.execute(interaction);
    }

    if (id === 'btn_room_tempvoice') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Manage Channels!', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setuptempvoice');
      if (cmd) return cmd.execute(interaction);
    }

    if (id === 'btn_room_stats') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Administrator!', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('setupstats');
      if (cmd) return cmd.execute(interaction);
    }

    if (id === 'btn_room_rapihkan') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Administrator!', flags: MessageFlags.Ephemeral });
      }
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cmd = interaction.client.commands.get('rapihkan');
      if (cmd) return cmd.execute(interaction);
    }

    if (id === 'btn_room_buatkategori') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Manage Channels!', flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(createCategoryModal());
    }

    if (id === 'btn_room_buatchannel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Manage Channels!', flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(createChannelModal());
    }

    if (id === 'btn_room_hapuschannel') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({ content: '❌ Kamu membutuhkan izin Manage Channels!', flags: MessageFlags.Ephemeral });
      }
      const targetChannel = interaction.channel;
      if (!targetChannel.deletable) {
        return interaction.reply({ content: '❌ Bot tidak memiliki izin untuk menghapus channel ini!', flags: MessageFlags.Ephemeral });
      }
      await interaction.reply({ content: `🗑️ Menghapus channel **#${targetChannel.name}** dalam 2 detik...`, flags: MessageFlags.Ephemeral });
      setTimeout(async () => {
        await targetChannel.delete('Dihapus lewat menu interaktif').catch(console.error);
      }, 2000);
      return;
    }

    // --- EMBEDS ---
    if (id === 'btn_embed_rules') {
      const presetCmd = interaction.client.commands.get('embedpreset');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'rules', getChannel: () => interaction.channel },
      };
      return presetCmd.execute(fakeInteraction);
    }

    if (id === 'btn_embed_info') {
      const presetCmd = interaction.client.commands.get('embedpreset');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'info', getChannel: () => interaction.channel },
      };
      return presetCmd.execute(fakeInteraction);
    }

    if (id === 'btn_embed_announce') {
      const presetCmd = interaction.client.commands.get('embedpreset');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'announcement', getChannel: () => interaction.channel },
      };
      return presetCmd.execute(fakeInteraction);
    }

    if (id === 'btn_embed_music') {
      const presetCmd = interaction.client.commands.get('embedpreset');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'music', getChannel: () => interaction.channel },
      };
      return presetCmd.execute(fakeInteraction);
    }

    if (id === 'btn_embed_custom') {
      const buatembedCmd = interaction.client.commands.get('buatembed');
      return buatembedCmd.execute(interaction);
    }

    // --- ROLES & WELCOME ---
    if (id === 'btn_test_welcome') {
      const cmd = interaction.client.commands.get('welcometest');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'welcome' },
      };
      return cmd.execute(fakeInteraction);
    }

    if (id === 'btn_test_leave') {
      const cmd = interaction.client.commands.get('welcometest');
      const fakeInteraction = {
        ...interaction,
        options: { getString: () => 'leave' },
      };
      return cmd.execute(fakeInteraction);
    }

    // --- LEVELING ---
    if (id === 'btn_level_profile') {
      return interaction.update(getLevelingMenu(interaction.guild, interaction.user));
    }

    if (id === 'btn_level_leaderboard') {
      const leaderboard = getLeaderboard(interaction.guild.id, 10);
      if (leaderboard.length === 0) {
        return interaction.reply({ content: '❌ Belum ada data leveling! Mulai mengobrol untuk mendapat XP.', flags: MessageFlags.Ephemeral });
      }

      let desc = '';
      const medals = ['🥇', '🥈', '🥉'];
      for (let i = 0; i < leaderboard.length; i++) {
        const u = leaderboard[i];
        const medal = medals[i] || `**${i + 1}.**`;
        const rankTitle = getRankTitle(u.level);
        desc += `${medal} <@${u.userId}> — Level \`${u.level}\` ・ \`${u.xp.toLocaleString()} XP\` ・ ${rankTitle}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle(`📊 LEADERBOARD — ${interaction.guild.name}`)
        .setDescription(desc)
        .setFooter({ text: 'Top 10 member paling aktif' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    if (id === 'btn_level_achievements') {
      const userData = getUserData(interaction.guild.id, interaction.user.id);
      const unlocked = userData.achievements;

      let desc = '';
      for (const ach of ACHIEVEMENTS) {
        const isUnlocked = unlocked.includes(ach.id);
        const status = isUnlocked ? '✅' : '🔒';
        const nameText = isUnlocked ? `**${ach.emoji} ${ach.name}**` : `~~${ach.emoji} ${ach.name}~~`;
        desc += `${status} ${nameText} — ${ach.desc}\n`;
      }

      const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('🏅 DAFTAR ACHIEVEMENT')
        .setDescription(
          `Achievement yang terbuka: **${unlocked.length}/${ACHIEVEMENTS.length}**\n\n` +
          desc
        )
        .setFooter({ text: 'Terus aktif untuk membuka lebih banyak achievement!' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // --- AI CHAT ASSISTANT ---
    if (id === 'btn_open_dm_ai') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const dmChannel = await interaction.user.createDM();
        const dmEmbed = new EmbedBuilder()
          .setColor(0x2B2D31)
          .setTitle('RUANG CHAT PRIVAT — FLY')
          .setDescription(
            `Yo <@${interaction.user.id}>! Kenalin gue **Fly**, temen AI lo di sini bray.\n\n` +
            `**100% Rahasia & Privat:**\n` +
            `Obrolan di sini aman, **Admin, Owner, dan member server lain GA BISA NGINTIP** chat kita sama sekali!\n\n` +
            `**Bebas Curhat & Ngobrol:**\n` +
            `Langsung ketik aja santai tanpa perlu \`/\` atau mention gue. Mau curhat masalah hidup, tanya tugas, atau coding, gas aja langsung!\n\n` +
            `*Ketik apa aja di bawah buat mulai ngobrol:*`
          )
          .setFooter({ text: 'Fly AI Assistant' })
          .setTimestamp();

        await dmChannel.send({ embeds: [dmEmbed] });

        return interaction.editReply({
          content: `Pesan privat sudah dikirim ke DM kamu! Silakan buka pesan langsung (DM) dari <@${interaction.client.user.id}> untuk mulai mengobrol secara 100% rahasia tanpa bisa dilihat oleh siapapun di server.`,
        });
      } catch (err) {
        console.error('Error saat mengirim DM ke user:', err);
        return interaction.editReply({
          content: `Gagal mengirim pesan ke DM kamu!\n**Penyebab:** Pengaturan privasi akun Discord kamu memblokir DM dari member server.\n**Solusi:** Buka *User Settings > Privacy & Safety > Aktifkan "Allow direct messages from server members"*, lalu klik tombol ini lagi.`,
        });
      }
    }

    if (id === 'btn_open_private_ai') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const result = await createPrivateAiChannel(interaction.guild, interaction.member);
        if (result.alreadyExists) {
          return interaction.editReply({
            content: `Kamu sudah memiliki room AI yang aktif di <#${result.channel.id}>! Silakan langsung masuk ke channel tersebut untuk melanjutkan obrolan.`,
          });
        }
        return interaction.editReply({
          content: `Room Chat AI Privat Berhasil Dibuat! Silakan langsung menuju ke <#${result.channel.id}> untuk mulai mengobrol secara rahasia.`,
        });
      } catch (err) {
        console.error('Error saat membuat private AI channel:', err);
        return interaction.editReply({
          content: `Gagal membuat room AI privat: ${err.message}`,
        });
      }
    }

    if (id === 'btn_close_private_ai') {
      const channelInfo = getPrivateAiChannelInfo(interaction.channel.id);
      const isOwner = channelInfo && channelInfo.userId === interaction.user.id;
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

      if (!isOwner && !isAdmin) {
        return interaction.reply({
          content: 'Hanya pembuat room ini atau Admin yang dapat menutup channel ini.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.reply({
        content: 'Menutup dan menghapus room AI privat dalam 3 detik...',
      });

      setTimeout(async () => {
        await deletePrivateAiChannel(interaction.channel);
      }, 3000);
      return;
    }

    if (id === 'btn_clear_private_ai_history') {
      clearUserHistory(interaction.user.id);
      return interaction.reply({
        content: 'Memori Obrolan AI Berhasil Dikosongkan! AI kini siap untuk topik pembicaraan baru.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (id === 'btn_setup_private_ai_hub') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return interaction.reply({
          content: 'Kamu membutuhkan izin **Manage Channels** untuk memasang Hub AI di server!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        const category = await interaction.guild.channels.create({
          name: '━━━━ PRIVATE AI CHAT ━━━━',
          type: ChannelType.GuildCategory,
        });

        const hubChannel = await interaction.guild.channels.create({
          name: 'buka-ai-chat',
          type: ChannelType.GuildText,
          parent: category.id,
          permissionOverwrites: [
            {
              id: interaction.guild.roles.everyone.id,
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
              deny: [PermissionFlagsBits.SendMessages],
            },
            {
              id: interaction.client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageChannels,
              ],
            },
          ],
        });

        const panel = getHubPanel();
        await hubChannel.send(panel);
        setPrivateAiConfig(interaction.guild.id, hubChannel.id, category.id);

        return interaction.editReply({
          content: `Sistem Private AI Chat Berhasil Dipasang! Channel pemicu telah dibuat di <#${hubChannel.id}>.`,
        });
      } catch (err) {
        console.error('Error setup hub AI:', err);
        return interaction.editReply({
          content: `Gagal memasang Hub AI: ${err.message}`,
        });
      }
    }

    if (id === 'btn_ai_ask') {
      return interaction.showModal(createAIModal());
    }

    if (id === 'btn_ai_clear') {
      clearUserHistory(interaction.user.id);
      return interaction.reply({
        content: 'Riwayat Percakapan AI Berhasil Direset! Sesi memori percakapanmu telah dikosongkan.',
        flags: MessageFlags.Ephemeral,
      });
    }
  }

  // 3. MODAL SUBMITS
  if (interaction.isModalSubmit()) {
    const id = interaction.customId;

    if (id === 'modal_menu_play') {
      const query = interaction.fields.getTextInputValue('play_query');

      // Ambil member voice channel
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
        if (vs?.channelId) voiceChannel = vs.channel || await interaction.guild.channels.fetch(vs.channelId).catch(() => null);
      }
      if (!voiceChannel) {
        return interaction.reply({
          content: '❌ Kamu harus masuk ke dalam salah satu **Voice Channel** terlebih dahulu!',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await interaction.client.distube.play(voiceChannel, query, {
          textChannel: interaction.channel,
          member: member,
        });
        return interaction.editReply(`🔍 Mencari dan memutar: **${query}**...`);
      } catch (err) {
        return interaction.editReply(`❌ Gagal memutar lagu: ${err.message}`);
      }
    }

    if (id === 'modal_menu_volume') {
      const volStr = interaction.fields.getTextInputValue('volume_val');
      const vol = parseInt(volStr, 10);
      if (isNaN(vol) || vol < 1 || vol > 100) {
        return interaction.reply({ content: '❌ Masukkan angka volume antara 1 sampai 100!', flags: MessageFlags.Ephemeral });
      }
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (!queue) return interaction.reply({ content: '❌ Tidak ada musik yang sedang diputar!', flags: MessageFlags.Ephemeral });
      queue.setVolume(vol);
      return interaction.reply({ content: `🔊 Volume musik berhasil diubah ke **${vol}%**!`, flags: MessageFlags.Ephemeral });
    }

    if (id === 'modal_menu_buatkategori') {
      const catName = interaction.fields.getTextInputValue('cat_name').trim();
      try {
        const cat = await interaction.guild.channels.create({
          name: catName,
          type: ChannelType.GuildCategory,
        });
        return interaction.reply({ content: `📂 Sub-judul kategori **${cat.name}** berhasil dibuat!`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        return interaction.reply({ content: `❌ Gagal membuat kategori: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (id === 'modal_menu_buatchannel') {
      const chName = interaction.fields.getTextInputValue('ch_name').trim();
      const chType = interaction.fields.getTextInputValue('ch_type').trim().toLowerCase();
      const isVoice = chType.includes('voice') || chType.includes('suara');
      const prefix = isVoice ? '🔊・' : '💬・';
      const formatted = `${prefix}${chName.replace(/\s+/g, '-')}`;

      try {
        const ch = await interaction.guild.channels.create({
          name: formatted,
          type: isVoice ? ChannelType.GuildVoice : ChannelType.GuildText,
        });
        return interaction.reply({ content: `✅ Channel <#${ch.id}> berhasil dibuat!`, flags: MessageFlags.Ephemeral });
      } catch (err) {
        return interaction.reply({ content: `❌ Gagal membuat channel: ${err.message}`, flags: MessageFlags.Ephemeral });
      }
    }

    if (id === 'modal_menu_ai_ask') {
      const prompt = interaction.fields.getTextInputValue('ai_prompt');

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const result = await askAI(interaction.user.id, prompt);

      if (!result.success) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('❌ Gagal Menghubungi AI')
          .setDescription(`Terjadi kendala saat memproses jawaban:\n\`\`\`\n${result.error}\n\`\`\``)
          .setFooter({ text: 'Silakan coba sesaat lagi.' });

        return interaction.editReply({ embeds: [errEmbed] });
      }

      const displayPrompt = prompt.length > 250 ? prompt.substring(0, 247) + '...' : prompt;
      let replyText = result.reply;
      if (replyText.length > 3900) {
        replyText = replyText.substring(0, 3900) + '\n\n*(Jawaban dipotong karena melebihi limit karakter Discord)*';
      }

      const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('Fly AI Assistant')
        .setDescription(replyText)
        .addFields({
          name: 'Pertanyaan:',
          value: `>>> ${displayPrompt}`,
        })
        .setFooter({
          text: `Fly AI • Mode: Privat`,
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('btn_ai_ask')
          .setLabel('Tanya Lagi')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('btn_ai_clear')
          .setLabel('Reset Sesi Chat')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('btn_back_to_main')
          .setLabel('Menu Utama')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }
  }
}

module.exports = {
  handleMenuInteraction,
};
