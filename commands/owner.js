const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
  ChannelType,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} = require('discord.js');
const {
  updateLiveDashboard,
  updateServerListDashboard,
  formatUptime,
} = require('../botMonitoringHelper');
const {
  isBotOwner,
  getMaintenanceConfig,
  setMaintenanceConfig,
  setPresenceConfig,
  applyBotPresence,
  getOfficialInviteUrl,
} = require('../ownerHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('[Khusus Owner] Menu pengelolaan dan pemantauan resmi FlyBot')
    // 1. Status Teknis
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Melihat status teknis, RAM, uptime, dan statistik FlyBot')
    )
    // 2. Update Dashboard
    .addSubcommand((sub) =>
      sub
        .setName('updatedashboard')
        .setDescription('Memperbarui pesan live monitoring dashboard di server official')
    )
    // 3. Daftar Server
    .addSubcommand((sub) =>
      sub
        .setName('servers')
        .setDescription('Melihat daftar semua server tempat FlyBot bergabung')
    )
    // 4. Keluar Server
    .addSubcommand((sub) =>
      sub
        .setName('leaveserver')
        .setDescription('Mengeluarkan FlyBot dari server tertentu berdasarkan Server ID')
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('ID Server yang ingin ditinggalkan oleh FlyBot')
            .setRequired(true)
        )
    )
    // 5. Global Broadcast
    .addSubcommand((sub) =>
      sub
        .setName('broadcast')
        .setDescription('Mengirim pesan pengumuman resmi ke seluruh server yang memasang FlyBot')
        .addStringOption((opt) =>
          opt
            .setName('pesan')
            .setDescription('Isi pesan / pengumuman yang ingin disiarkan')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('judul')
            .setDescription('Judul embed pengumuman (Opsional)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('gambar_url')
            .setDescription('URL gambar / banner pengumuman (Opsional)')
            .setRequired(false)
        )
    )
    // 6. Set Activity & Status Presence
    .addSubcommand((sub) =>
      sub
        .setName('setactivity')
        .setDescription('Mengatur status aktivitas & presence FlyBot secara real-time')
        .addStringOption((opt) =>
          opt
            .setName('tipe')
            .setDescription('Tipe aktivitas bot')
            .setRequired(true)
            .addChoices(
              { name: 'Playing (Bermain)', value: 'Playing' },
              { name: 'Watching (Menonton)', value: 'Watching' },
              { name: 'Listening (Mendengarkan)', value: 'Listening' },
              { name: 'Competing (Bertanding)', value: 'Competing' },
              { name: 'Streaming (Live Stream)', value: 'Streaming' },
              { name: 'Custom (Kustom)', value: 'Custom' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('status')
            .setDescription('Status online bot')
            .setRequired(true)
            .addChoices(
              { name: '🟢 Online', value: 'online' },
              { name: '🟡 Idle', value: 'idle' },
              { name: '🔴 Do Not Disturb (DND)', value: 'dnd' },
              { name: '⚪ Invisible', value: 'invisible' }
            )
        )
        .addStringOption((opt) =>
          opt
            .setName('teks')
            .setDescription('Teks status yang ditampilkan')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('streaming_url')
            .setDescription('URL Twitch / YouTube (Hanya jika tipe Streaming)')
            .setRequired(false)
        )
    )
    // 7. Maintenance Mode Toggle
    .addSubcommand((sub) =>
      sub
        .setName('maintenance')
        .setDescription('Mengaktifkan atau mematikan mode pemeliharaan (Maintenance) FlyBot')
        .addBooleanOption((opt) =>
          opt
            .setName('status')
            .setDescription('True = Aktifkan Maintenance, False = Matikan Maintenance')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('alasan')
            .setDescription('Alasan pemeliharaan yang ditampilkan kepada pengguna lain')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const ownerAllowed = await isBotOwner(interaction);
    if (!ownerAllowed) {
      return interaction.reply({
        content: 'Perintah ini khusus untuk Pemilik / Developer resmi FlyBot.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();

    // 1. /owner status
    if (sub === 'status') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const client = interaction.client;
      const totalServers = client.guilds.cache.size;
      const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);
      const uptimeStr = formatUptime(process.uptime());
      const ramUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
      const heapUsedMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
      const wsPing = Math.round(client.ws.ping || 0);

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setAuthor({
          name: 'FlyBot System Monitor',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle('Status Teknis & Resource Host')
        .addFields(
          { name: 'Total Server', value: `\`${totalServers} Server\``, inline: true },
          { name: 'Total Pengguna', value: `\`${totalMembers.toLocaleString('id-ID')} Member\``, inline: true },
          { name: 'Uptime Host', value: `\`${uptimeStr}\``, inline: true },
          { name: 'RAM (RSS)', value: `\`${ramUsageMb} MB\``, inline: true },
          { name: 'RAM (Heap)', value: `\`${heapUsedMb} MB\``, inline: true },
          { name: 'Gateway Latency', value: `\`${wsPing} ms\``, inline: true },
          { name: 'Node.js', value: `\`${process.version}\``, inline: true },
          { name: 'Platform Host', value: `\`${process.platform} (${process.arch})\``, inline: true }
        )
        .setFooter({ text: 'FlyBot Developer Tools' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // 2. /owner updatedashboard
    if (sub === 'updatedashboard') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      try {
        await updateLiveDashboard(interaction.client);
        await updateServerListDashboard(interaction.client);
        return interaction.editReply({
          content: 'Live monitoring dashboard dan direktori server berhasil diperbarui di channel privat!',
        });
      } catch (err) {
        return interaction.editReply({
          content: `Gagal memperbarui dashboard: ${err.message}`,
        });
      }
    }

    // 3. /owner servers
    if (sub === 'servers') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const client = interaction.client;
      const guildsList = [...client.guilds.cache.values()]
        .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0))
        .slice(0, 20);

      const listDesc = guildsList
        .map(
          (g, idx) =>
            `**${idx + 1}. ${g.name}**\n` +
            `> ID: \`${g.id}\` • Member: **${(g.memberCount || 0).toLocaleString('id-ID')}** • Owner: <@${g.ownerId}>`
        )
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setColor(0x57f287)
        .setTitle(`Daftar Server FlyBot (${client.guilds.cache.size} Total Server)`)
        .setDescription(listDesc || 'Belum ada server.')
        .setFooter({ text: 'Menampilkan hingga 20 server dengan member terbanyak' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // 4. /owner leaveserver
    if (sub === 'leaveserver') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const targetId = interaction.options.getString('server_id').trim();
      const targetGuild = interaction.client.guilds.cache.get(targetId);

      if (!targetGuild) {
        return interaction.editReply({
          content: `Server dengan ID \`${targetId}\` tidak ditemukan dalam cache FlyBot.`,
        });
      }

      const guildName = targetGuild.name;
      try {
        await targetGuild.leave();
        return interaction.editReply({
          content: `FlyBot telah berhasil meninggalkan server **${guildName}** (\`${targetId}\`).`,
        });
      } catch (err) {
        return interaction.editReply({
          content: `Gagal meninggalkan server: ${err.message}`,
        });
      }
    }

    // 5. /owner broadcast
    if (sub === 'broadcast') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const messageText = interaction.options.getString('pesan');
      const title = interaction.options.getString('judul') || '📢 Pengumuman Resmi FlyBot';
      const imageUrl = interaction.options.getString('gambar_url');

      const client = interaction.client;
      const guilds = [...client.guilds.cache.values()];

      const broadcastEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: 'FlyBot Official Broadcast • Pengumuman Developer',
          iconURL: client.user.displayAvatarURL({ dynamic: true }),
        })
        .setTitle(title)
        .setDescription(messageText)
        .setFooter({ text: 'Pesan resmi disiarkan oleh Developer FlyBot' })
        .setTimestamp();

      if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
        broadcastEmbed.setImage(imageUrl);
      }

      const inviteUrl = getOfficialInviteUrl();
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('🌟 Gabung Server Resmi FlyBot')
          .setStyle(ButtonStyle.Link)
          .setURL(inviteUrl)
      );

      let successCount = 0;
      let failedCount = 0;

      for (const guild of guilds) {
        try {
          const botMember = guild.members.me || (await guild.members.fetchMe().catch(() => null));
          let targetChannel = guild.systemChannel;

          if (
            !targetChannel ||
            !targetChannel.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
          ) {
            targetChannel = guild.channels.cache.find(
              (c) =>
                c.type === ChannelType.GuildText &&
                c.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]) &&
                (c.name.includes('announcement') ||
                  c.name.includes('pengumuman') ||
                  c.name.includes('general') ||
                  c.name.includes('chat') ||
                  c.name.includes('bot'))
            );
          }

          if (!targetChannel) {
            targetChannel = guild.channels.cache.find(
              (c) =>
                c.type === ChannelType.GuildText &&
                c.permissionsFor(botMember)?.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])
            );
          }

          if (targetChannel) {
            await targetChannel.send({ embeds: [broadcastEmbed], components: [actionRow] });
            successCount++;
          } else {
            failedCount++;
          }
        } catch {
          failedCount++;
        }
      }

      return interaction.editReply({
        content: `✅ **Broadcast Selesai!**\n> • Berhasil dikirim ke: **${successCount} Server**\n> • Gagal / Tidak ada channel yang terbuka: **${failedCount} Server**`,
      });
    }

    // 6. /owner setactivity
    if (sub === 'setactivity') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const type = interaction.options.getString('tipe');
      const status = interaction.options.getString('status');
      const text = interaction.options.getString('teks');
      const streamingUrl = interaction.options.getString('streaming_url') || null;

      const newConfig = {
        type,
        status,
        text,
        url: streamingUrl,
      };

      setPresenceConfig(newConfig);
      applyBotPresence(interaction.client);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Status Bot Berhasil Diperbarui')
        .setDescription(
          `Status bot telah berhasil diubah dan disimpan secara permanen:\n\n` +
          `> • **Tipe Aktivitas**: \`${type}\`\n` +
          `> • **Status Presence**: \`${status.toUpperCase()}\`\n` +
          `> • **Teks Status**: \`${text}\`\n` +
          (streamingUrl ? `> • **Streaming URL**: \`${streamingUrl}\`\n` : '')
        )
        .setFooter({ text: 'Status ini otomatis bertahan saat bot direstart' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // 7. /owner maintenance
    if (sub === 'maintenance') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const isEnabled = interaction.options.getBoolean('status');
      const reason = interaction.options.getString('alasan');

      const cfg = {
        enabled: isEnabled,
        reason: reason || (isEnabled ? 'FlyBot sedang dalam pemeliharaan rutin oleh Developer.' : 'Pemeliharaan selesai.'),
        updatedAt: new Date().toISOString(),
        updatedBy: interaction.user.tag,
      };

      setMaintenanceConfig(cfg);

      const embed = new EmbedBuilder()
        .setColor(isEnabled ? 0xED4245 : 0x57F287)
        .setTitle(isEnabled ? '🚧 Mode Maintenance DIAKTIFKAN' : '🟢 Mode Maintenance DINONAKTIFKAN')
        .setDescription(
          isEnabled
            ? `FlyBot sekarang berada dalam mode **Pemeliharaan (Maintenance)**.\n\n` +
              `> • **Alasan**: ${cfg.reason}\n` +
              `> • **Akses Perintah**: Khusus Bot Owner / Developer.\n` +
              `> • Pengguna lain yang mencoba menjalankan command akan melihat notifikasi maintenance.`
            : `Mode pemeliharaan telah **dinonaktifkan**.\n\nSeluruh pengguna di semua server kini dapat menggunakan perintah FlyBot secara normal kembali.`
        )
        .setFooter({ text: 'FlyBot Maintenance System' })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }
  },
};
