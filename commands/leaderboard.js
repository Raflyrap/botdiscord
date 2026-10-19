const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const lvl = require('../levelingHelper');

function buildLeaderboardEmbed(guild, type, requesterUser) {
  const isXp = type === 'xp';
  const topList = isXp ? lvl.getLeaderboard(guild.id, 10) : lvl.getCoinLeaderboard(guild.id, 10);
  const myXpRank = lvl.getUserRank(guild.id, requesterUser.id);
  const myCoinRank = lvl.getUserCoinRank(guild.id, requesterUser.id);
  const myData = lvl.getUserData(guild.id, requesterUser.id);

  const rankTag = (i) => `\`[#${i + 1}]\``;

  let descriptionLines = [];
  if (topList.length === 0) {
    descriptionLines.push('*Belum ada data aktivitas di server ini.*');
  } else {
    topList.forEach((entry, idx) => {
      const level = entry.level || 0;
      const coins = (entry.coins || 0).toLocaleString();
      const xp = (entry.xp || 0).toLocaleString();
      const rankTitle = lvl.getRankTitle(level);

      if (isXp) {
        descriptionLines.push(
          `${rankTag(idx)} <@${entry.userId}>\n` +
          `   • Level ${level} (${rankTitle})  |  \`${xp} XP\`  |  \`${(entry.totalMessages || 0).toLocaleString()} Pesan\``
        );
      } else {
        descriptionLines.push(
          `${rankTag(idx)} <@${entry.userId}>\n` +
          `   • Saldo: \`${coins} Koin\`  |  Menang Game: \`${entry.gamesWon || 0}x\`  |  Streak: \`${entry.dailyStreak || 0} Hari\``
        );
      }
    });
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `Papan Peringkat Server  •  ${guild.name}`,
      iconURL: guild.iconURL() || undefined,
    })
    .setTitle(isXp ? 'Top 10 Level & XP Terbanyak' : 'Top 10 Saldo Koin Terbanyak')
    .setDescription(descriptionLines.join('\n\n'))
    .addFields({
      name: 'Posisi Kamu Saat Ini',
      value:
        `• Peringkat XP  : \`#${myXpRank}\` (Level ${myData.level || 0} • ${(myData.xp || 0).toLocaleString()} XP)\n` +
        `• Peringkat Koin: \`#${myCoinRank}\` (${(myData.coins || 0).toLocaleString()} Koin)`,
      inline: false,
    })
    .setFooter({ text: 'Klik tombol di bawah untuk beralih antara ranking XP dan Koin' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('btn_lb_xp')
      .setLabel('Top Level & XP')
      .setStyle(isXp ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(isXp),
    new ButtonBuilder()
      .setCustomId('btn_lb_coins')
      .setLabel('Top Koin & Ekonomi')
      .setStyle(!isXp ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(!isXp)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Lihat papan peringkat Level XP atau Koin terkaya di server')
    .addStringOption((opt) =>
      opt
        .setName('kategori')
        .setDescription('Pilih kategori peringkat')
        .setRequired(false)
        .addChoices(
          { name: 'Level & XP', value: 'xp' },
          { name: 'Koin & Ekonomi', value: 'coins' }
        )
    ),

  async execute(interaction) {
    const type = interaction.options.getString('kategori') || 'xp';
    const payload = buildLeaderboardEmbed(interaction.guild, type, interaction.user);
    return interaction.reply(payload);
  },

  buildLeaderboardEmbed,
};
