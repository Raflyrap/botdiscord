const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { getOfficialWebsiteUrl, getOfficialInviteUrl } = require('../ownerHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Dapatkan link resmi untuk mengundang FlyBot ke server Discord kamu'),

  async execute(interaction) {
    const client = interaction.client;
    const totalServers = client.guilds.cache.size;
    const totalMembers = client.guilds.cache.reduce((sum, g) => sum + (g.memberCount || 0), 0);

    const websiteUrl = getOfficialWebsiteUrl();
    const discordInviteUrl = getOfficialInviteUrl();

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: 'FlyBot Multi-Purpose • Official Invitation',
        iconURL: client.user.displayAvatarURL({ dynamic: true }),
      })
      .setTitle('Undang FlyBot ke Server Kamu')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setDescription(
        `Terima kasih telah tertarik menggunakan **FlyBot**! Bot serbaguna generasi baru yang siap melengkapi server Discord kamu dengan performa tinggi, stabilitas 24/7, dan otomatisasi lengkap.\n\n` +
        `**Highlight Fitur Unggulan:**\n` +
        `> • **Music Studio HD**: Pemutar audio jernih tanpa delay via Lavalink v4 engine.\n` +
        `> • **AI Chat & Voice AI**: Asisten obrolan interaktif di teks maupun voice room.\n` +
        `> • **Auto Moderation & Anti-Toxic**: Proteksi link berbahaya, spam, dan filter kata kasar.\n` +
        `> • **Dynamic Temp Voice**: Ruang voice kustom otomatis (Join-to-Create).\n` +
        `> • **Support Ticket System**: Kelola aduan & bantuan member secara profesional.\n` +
        `> • **Server Stats & Leveling**: Ranking XP interaktif, profil visual, dan statistik realtime.\n\n` +
        `**Statistik Jaringan Saat Ini:**\n` +
        `> • Total Server: **${totalServers} Server**\n` +
        `> • Total Anggota: **${totalMembers.toLocaleString('id-ID')} Pengguna**\n\n` +
        `Silakan klik tombol di bawah untuk menambahkan FlyBot langsung melalui website resmi atau bergabung ke server komunitas Discord kami.`
      )
      .setFooter({ text: 'flyneuroai.com • Official Multi-Purpose Discord Bot' })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('Add FlyBot (flyneuroai.com)')
        .setStyle(ButtonStyle.Link)
        .setURL(websiteUrl),
      new ButtonBuilder()
        .setLabel('Server Komunitas Discord')
        .setStyle(ButtonStyle.Link)
        .setURL(discordInviteUrl)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  },
};
