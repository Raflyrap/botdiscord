const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');
const {
  updateLiveDashboard,
  updateServerListDashboard,
  formatUptime,
  ensureMonitoringChannels,
} = require('../botMonitoringHelper');

async function isBotOwner(interaction) {
  try {
    if (!interaction.client.application?.owner) {
      await interaction.client.application?.fetch().catch(() => null);
    }
    const appOwner = interaction.client.application?.owner;
    if (appOwner) {
      if (appOwner.id && interaction.user.id === appOwner.id) return true;
      if (appOwner.members && appOwner.members.has(interaction.user.id)) return true;
    }

    // Izinkan juga jika user adalah Owner dari Server Official FlyBot
    const { getOfficialGuildId } = require('../botMonitoringHelper');
    const officialGuildId = getOfficialGuildId();
    const officialGuild = interaction.client.guilds.cache.get(officialGuildId);
    if (officialGuild && officialGuild.ownerId === interaction.user.id) return true;
  } catch (err) {
    console.error('[OWNER CHECK ERROR]:', err);
  }
  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('owner')
    .setDescription('[Khusus Owner] Menu pengelolaan dan pemantauan resmi FlyBot')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Melihat status teknis, RAM, uptime, dan statistik FlyBot')
    )
    .addSubcommand((sub) =>
      sub
        .setName('updatedashboard')
        .setDescription('Memperbarui pesan live monitoring dashboard di server official')
    )
    .addSubcommand((sub) =>
      sub
        .setName('servers')
        .setDescription('Melihat daftar semua server tempat FlyBot bergabung')
    )
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
  },
};
