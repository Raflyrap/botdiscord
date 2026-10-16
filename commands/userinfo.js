const {
  SlashCommandBuilder,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Lihat informasi teknis dan detail akun pengguna (bebas emoji)')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Pilih pengguna yang ingin dilihat informasinya (opsional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    const createdSec = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedSec = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const roles = member
      ? member.roles.cache
          .filter((r) => r.id !== interaction.guild.id)
          .sort((a, b) => b.position - a.position)
          .map((r) => `<@&${r.id}>`)
      : [];

    const roleText =
      roles.length > 0
        ? roles.length > 15
          ? `${roles.slice(0, 15).join(', ')} ...dan ${roles.length - 15} lainnya`
          : roles.join(', ')
        : 'Tidak ada role';

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865F2)
      .setAuthor({
        name: 'FlyBot  •  Informasi Pengguna',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTitle(`Profil: ${targetUser.username}`)
      .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'Username & Tag', value: `\`${targetUser.tag}\``, inline: true },
        { name: 'User ID', value: `\`${targetUser.id}\``, inline: true },
        { name: 'Tipe Akun', value: targetUser.bot ? 'Bot Sistem' : 'Pengguna Manusia', inline: true },
        { name: 'Dibuat Pada', value: `<t:${createdSec}:D>\n(<t:${createdSec}:R>)`, inline: true },
        {
          name: 'Bergabung Server',
          value: joinedSec ? `<t:${joinedSec}:D>\n(<t:${joinedSec}:R>)` : 'Bukan member server ini',
          inline: true,
        },
        {
          name: 'Role Tertinggi',
          value: member?.roles?.highest ? `<@&${member.roles.highest.id}>` : '-',
          inline: true,
        },
        { name: `Daftar Role (${roles.length})`, value: roleText }
      )
      .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
