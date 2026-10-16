const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Lihat informasi lengkap dan statistik server (bebas emoji)'),

  async execute(interaction) {
    const guild = interaction.guild;

    let members;
    try {
      members = await guild.members.fetch().catch(() => guild.members.cache);
    } catch {
      members = guild.members.cache;
    }

    const humans = members.filter((m) => !m.user.bot).size;
    const bots = members.filter((m) => m.user.bot).size;

    const textCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categoryCount = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;

    const verificationMap = {
      0: 'None (Tanpa batasan)',
      1: 'Low (Email terverifikasi)',
      2: 'Medium (Terdaftar lebih dari 5 menit)',
      3: 'High (Member server lebih dari 10 menit)',
      4: 'Highest (Nomor telepon terverifikasi)',
    };

    const createdSec = Math.floor(guild.createdTimestamp / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: 'FlyBot  •  Informasi Server',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ size: 256 }) || undefined)
      .addFields(
        { name: 'Pemilik Server', value: `<@${guild.ownerId}>`, inline: true },
        { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
        { name: 'Dibuat Pada', value: `<t:${createdSec}:D>\n(<t:${createdSec}:R>)`, inline: true },
        {
          name: 'Total Member',
          value: `**${guild.memberCount.toLocaleString()}** (Pengguna: ${humans}, Bot: ${bots})`,
          inline: true,
        },
        {
          name: 'Saluran Channel',
          value: `${textCount} Teks | ${voiceCount} Suara | ${categoryCount} Kategori`,
          inline: true,
        },
        { name: 'Jumlah Role', value: `${guild.roles.cache.size} role`, inline: true },
        {
          name: 'Tingkat Keamanan',
          value: verificationMap[guild.verificationLevel] || 'Standar',
          inline: true,
        },
        {
          name: 'Server Boost',
          value: `Tingkat ${guild.premiumTier} (${guild.premiumSubscriptionCount || 0} Boost)`,
          inline: true,
        }
      )
      .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
