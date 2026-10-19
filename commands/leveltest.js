const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const lvl = require('../levelingHelper');
const { buildLevelUpEmbed, buildAchievementEmbed } = require('../levelEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leveltest')
    .setDescription('[Admin] Preview tampilan notifikasi Level Up / Achievement (hanya kamu yang lihat)')
    .addStringOption((o) =>
      o.setName('jenis')
        .setDescription('Notifikasi yang mau di-preview')
        .setRequired(false)
        .addChoices(
          { name: 'Level Up', value: 'levelup' },
          { name: 'Achievement', value: 'achievement' },
          { name: 'Keduanya', value: 'both' },
        )
    )
    .addIntegerOption((o) =>
      o.setName('level')
        .setDescription('Level tujuan untuk simulasi (default: level kamu + 1)')
        .setMinValue(1)
        .setMaxValue(200)
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const jenis = interaction.options.getString('jenis') || 'both';
    const user = lvl.getUserData(interaction.guildId, interaction.user.id);
    const newLevel = interaction.options.getInteger('level') || user.level + 1;
    const oldLevel = newLevel - 1;
    // XP simulasi: awal level + sedikit progress
    const xp = Math.max(user.xp, lvl.totalXpForLevel(newLevel) + Math.floor(lvl.xpForLevel(newLevel + 1) * 0.35));

    const ctx = { member: interaction.member, user: interaction.user, guild: interaction.guild };
    const embeds = [];

    if (jenis !== 'achievement') {
      embeds.push(buildLevelUpEmbed(ctx, {
        oldLevel,
        newLevel,
        xp,
        totalMessages: user.totalMessages,
        position: lvl.getUserRank(interaction.guildId, interaction.user.id),
      }));
    }
    if (jenis !== 'levelup') {
      const ach = lvl.ACHIEVEMENTS.find((a) => !user.achievements.includes(a.id)) || lvl.ACHIEVEMENTS[0];
      embeds.push(buildAchievementEmbed(ctx, ach, user.achievements.length + 1));
    }

    const cfg = lvl.getLevelConfig(interaction.guildId);
    const fmt = (id) => (id ? `<#${id}>` : 'channel tempat user chat');

    await interaction.reply({
      content:
        `**Preview (hanya kamu yang bisa lihat, data tidak disimpan)**\n` +
        `Level Up → ${fmt(cfg.levelUpChannel)}  |  Achievement → ${fmt(cfg.achievementChannel)}`,
      embeds,
      flags: MessageFlags.Ephemeral,
    });
  },
};
