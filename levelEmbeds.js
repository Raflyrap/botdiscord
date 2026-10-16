const { EmbedBuilder } = require('discord.js');
const lvl = require('./levelingHelper');

const COLORS = [0x57F287, 0x5865F2, 0xFEE75C, 0xEB459E, 0xFF7A00, 0x9B59FF, 0x00D9FF];
const stripEmoji = (s) => s.replace(/[^\p{L}\p{N}\s]/gu, '').trim();

// member: GuildMember, user: User, guild: Guild
// data: { oldLevel, newLevel, xp, totalMessages, position }
function buildLevelUpEmbed({ member, user, guild }, data) {
  const level = data.newLevel;
  const cur = lvl.currentLevelXp(data.xp, level);
  const need = lvl.xpForLevel(level + 1);
  const pct = Math.max(0, Math.min(100, Math.floor((cur / need) * 100)));
  const bar = lvl.createProgressBar(Math.max(0, cur), need, 16);
  const rank = stripEmoji(lvl.getRankTitle(level));
  const oldRank = stripEmoji(lvl.getRankTitle(data.oldLevel));
  const avatar = (member || user).displayAvatarURL({ extension: 'png', forceStatic: false, size: 512 });
  const name = member?.displayName || user.username;

  return new EmbedBuilder()
    .setColor(COLORS[level % COLORS.length])
    .setAuthor({ name: `${name} naik level!`, iconURL: avatar })
    .setTitle(`LEVEL UP  •  ${data.oldLevel} → ${level}`)
    .setDescription(
      `Selamat <@${user.id}>! Kamu sekarang **Level ${level}**\n` +
      (rank !== oldRank ? `**Rank baru:** ${oldRank} → **${rank}**\n` : `Rank: **${rank}**\n`) +
      `\n**Progress ke Level ${level + 1}**\n` +
      `\`${bar}\` **${pct}%**\n` +
      `\`${Math.max(0, cur).toLocaleString()} / ${need.toLocaleString()} XP\``
    )
    .addFields(
      { name: 'Total XP', value: `\`${data.xp.toLocaleString()}\``, inline: true },
      { name: 'Pesan', value: `\`${data.totalMessages.toLocaleString()}\``, inline: true },
      { name: 'Peringkat', value: `\`#${data.position}\``, inline: true },
    )
    .setThumbnail(avatar)
    .setFooter({ text: `${guild.name} • Terus aktif ya!`, iconURL: guild.iconURL() || undefined })
    .setTimestamp();
}

function buildAchievementEmbed({ member, user }, ach, ownedCount) {
  return new EmbedBuilder()
    .setColor(0xE91E63)
    .setAuthor({
      name: member?.displayName || user.username,
      iconURL: (member || user).displayAvatarURL({ extension: 'png', forceStatic: false }),
    })
    .setTitle('🏅 ACHIEVEMENT UNLOCKED!')
    .setDescription(
      `<@${user.id}> membuka achievement baru:\n\n` +
      `> ${ach.emoji} **${ach.name}**\n` +
      `> *${ach.desc}*`
    )
    .setFooter({ text: `Koleksi: ${ownedCount}/${lvl.ACHIEVEMENTS.length} achievement` })
    .setTimestamp();
}

module.exports = { buildLevelUpEmbed, buildAchievementEmbed };
