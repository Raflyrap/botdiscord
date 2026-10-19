const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const lvl = require('../levelingHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Lihat profil lengkap pengguna: level, XP, koin, peringkat, dan prestasi')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Pilih pengguna yang ingin dilihat profilnya (opsional)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const userData = lvl.getUserData(interaction.guildId, targetUser.id);

    const level = userData.level || 0;
    const curXp = lvl.currentLevelXp(userData.xp || 0, level);
    const needXp = lvl.xpForLevel(level + 1);
    const pct = Math.max(0, Math.min(100, Math.floor((curXp / needXp) * 100)));
    const progressBar = lvl.createProgressBar(Math.max(0, curXp), needXp, 14);
    const rankTitle = lvl.getRankTitle(level);
    const xpRank = lvl.getUserRank(interaction.guildId, targetUser.id);
    const coinRank = lvl.getUserCoinRank(interaction.guildId, targetUser.id);

    const gamesPlayed = userData.gamesPlayed || 0;
    const gamesWon = userData.gamesWon || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

    const ownedAchs = userData.achievements || [];
    const badgeSummary =
      ownedAchs.length > 0
        ? ownedAchs
            .slice(0, 6)
            .map((id) => `\`[${lvl.getAchievementById(id)?.name || id}]\``)
            .join(' ') + (ownedAchs.length > 6 ? ` *...dan ${ownedAchs.length - 6} lainnya*` : '')
        : '*Belum ada prestasi yang terbuka.*';

    const createdSec = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedSec = member?.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;

    const avatar = targetUser.displayAvatarURL({ extension: 'png', forceStatic: false, size: 512 });

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor || 0x5865F2)
      .setAuthor({
        name: `Profil Anggota  •  ${targetUser.username}`,
        iconURL: avatar,
      })
      .setTitle(`[${rankTitle.toUpperCase()}]  Level ${level}`)
      .setThumbnail(avatar)
      .setDescription(
        `**Progress Menuju Level ${level + 1}**\n` +
        `\`${progressBar}\` **${pct}%**\n` +
        `\`${Math.max(0, curXp).toLocaleString()} / ${needXp.toLocaleString()} XP\`  ` +
        `*(Total: ${(userData.xp || 0).toLocaleString()} XP)*`
      )
      .addFields(
        {
          name: 'Ekonomi & Saldo',
          value:
            `• Saldo Koin: \`${(userData.coins || 0).toLocaleString()} Koin\`\n` +
            `• Daily Streak: \`${userData.dailyStreak || 0} Hari\`\n` +
            `• Peringkat Koin: \`#${coinRank}\``,
          inline: true,
        },
        {
          name: 'Peringkat & Chat',
          value:
            `• Peringkat XP: \`#${xpRank}\`\n` +
            `• Total Chat: \`${(userData.totalMessages || 0).toLocaleString()} Pesan\`\n` +
            `• Gelar Akun: \`${rankTitle}\``,
          inline: true,
        },
        {
          name: 'Statistik Mini Games',
          value:
            `• Menang: \`${gamesWon.toLocaleString()}\` kali\n` +
            `• Total Main: \`${gamesPlayed.toLocaleString()}\` kali\n` +
            `• Win Rate: \`${winRate}%\``,
          inline: true,
        },
        {
          name: `Prestasi (${ownedAchs.length} / ${lvl.ACHIEVEMENTS.length} Terbuka)`,
          value: `${badgeSummary}\n*Klik tombol Prestasi di bawah untuk melihat checklist lengkap.*`,
          inline: false,
        },
        {
          name: 'Informasi Akun',
          value:
            `• Akun Dibuat: <t:${createdSec}:D> (<t:${createdSec}:R>)\n` +
            (joinedSec ? `• Bergabung Server: <t:${joinedSec}:D> (<t:${joinedSec}:R>)` : '• Status: Bukan anggota server'),
          inline: false,
        }
      )
      .setFooter({
        text: `${interaction.guild.name} • FlyBot System`,
        iconURL: interaction.guild.iconURL() || undefined,
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_profile_ach_${targetUser.id}`)
        .setLabel(`Daftar Prestasi (${ownedAchs.length})`)
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_profile_lb')
        .setLabel('Papan Peringkat')
        .setStyle(ButtonStyle.Secondary)
    );

    return interaction.reply({ embeds: [embed], components: [row] });
  },
};
