const { EmbedBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const lvl = require('./levelingHelper');
const { syncMemberLevelRole, syncMemberAchievementRole } = require('./levelRoleHelper');

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
    .setColor(0x5865F2)
    .setAuthor({
      name: member?.displayName || user.username,
      iconURL: (member || user).displayAvatarURL({ extension: 'png', forceStatic: false }),
    })
    .setTitle('PRESTASI DIBUKA (ACHIEVEMENT)')
    .setDescription(
      `<@${user.id}> telah membuka prestasi baru:\n\n` +
      `> **${ach.tag || '[ACH]'} ${ach.name}**\n` +
      `> *${ach.desc}*`
    )
    .setFooter({ text: `Koleksi Prestasi: ${ownedCount} / ${lvl.ACHIEVEMENTS.length}` })
    .setTimestamp();
}

function hasSendPermission(guild, ch) {
  if (!ch || !ch.isTextBased()) return false;
  const me = guild.members.me;
  if (!me) return true;
  const perms = ch.permissionsFor(me);
  if (!perms) return false;
  return perms.has([
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
  ]);
}

async function dispatchLevelUpAndAchievements(guild, member, user, fallbackChannel, result) {
  if (!result || !guild) return;
  const lvlCfg = lvl.getLevelConfig(guild.id) || {};

  // Pastikan member objek ada untuk pemberian role
  let memberObj = member;
  if (!memberObj && user && guild.members) {
    memberObj = await guild.members.fetch(user.id).catch(() => null);
  }

  // Ambil userData dengan fallback aman jika result.userData tidak dikirim
  const userData = result.userData || (user ? lvl.getUserData(guild.id, user.id) : null) || {};

  const resolveTargetChannel = async (configId, keywords) => {
    if (configId) {
      const ch = guild.channels.cache.get(configId) || (await guild.channels.fetch(configId).catch(() => null));
      if (ch && hasSendPermission(guild, ch)) return ch;
    }

    let found = guild.channels.cache.find(
      (c) => c.isTextBased() && hasSendPermission(guild, c) && keywords.some((kw) => c.name.toLowerCase().includes(kw))
    );
    if (found) return found;

    const fetchedChannels = await guild.channels.fetch().catch(() => null);
    if (fetchedChannels) {
      found = fetchedChannels.find(
        (c) => c && c.isTextBased() && hasSendPermission(guild, c) && keywords.some((kw) => c.name.toLowerCase().includes(kw))
      );
      if (found) return found;
    }

    return fallbackChannel && hasSendPermission(guild, fallbackChannel) ? fallbackChannel : null;
  };

  const ctx = { member: memberObj || member, user, guild };

  if (result.leveledUp) {
    // Sinkronkan role level (Role Level 1 s/d Level 99, atau Level MAX)
    if (memberObj) {
      await syncMemberLevelRole(guild, memberObj, result.newLevel).catch(console.error);
    }

    const levelUpEmbed = buildLevelUpEmbed(ctx, {
      oldLevel: result.oldLevel,
      newLevel: result.newLevel,
      xp: userData.xp ?? result.totalXp ?? 0,
      totalMessages: userData.totalMessages || 0,
      position: lvl.getUserRank(guild.id, user.id),
    });

    const ch = await resolveTargetChannel(lvlCfg.levelUpChannel, ['level', 'levels']);
    if (ch) {
      await ch.send({
        content: `<@${user.id}>`,
        embeds: [levelUpEmbed],
        flags: MessageFlags.SuppressNotifications,
        allowedMentions: { parse: [] }, // Auto-mute agar tidak spam notifikasi suara/popup
      }).catch((err) => {
        if (err.code === 50001 || err.code === 50013) {
          console.warn(`[Leveling] Bot tidak memiliki akses kirim level-up di channel #${ch.name || ch.id}`);
        } else {
          console.error(`[Leveling] Gagal mengirim level up di #${ch.name || ch.id}:`, err.message);
        }
      });
    }
  }

  if (result.newAchievements && result.newAchievements.length > 0) {
    const totalAch = Array.isArray(userData.achievements) ? userData.achievements.length : 0;

    // Sinkronkan role achievement (Role Achievement 1/100 s/d 99/100, atau Achievement MAX)
    if (memberObj) {
      await syncMemberAchievementRole(guild, memberObj, totalAch).catch(console.error);
    }

    const achChannel = await resolveTargetChannel(lvlCfg.achievementChannel, ['achiev', 'prestasi']);
    if (achChannel) {
      for (const ach of result.newAchievements) {
        const achEmbed = buildAchievementEmbed(ctx, ach, totalAch);
        await achChannel.send({
          embeds: [achEmbed],
          flags: MessageFlags.SuppressNotifications,
          allowedMentions: { parse: [] }, // Auto-mute agar tidak spam notifikasi suara/popup
        }).catch((err) => {
          if (err.code === 50001 || err.code === 50013) {
            console.warn(`[Leveling] Bot tidak memiliki akses kirim prestasi di channel #${achChannel.name || achChannel.id}`);
          } else {
            console.error(`[Leveling] Gagal mengirim prestasi di #${achChannel.name || achChannel.id}:`, err.message);
          }
        });
      }
    }
  }
}

module.exports = { buildLevelUpEmbed, buildAchievementEmbed, dispatchLevelUpAndAchievements };
