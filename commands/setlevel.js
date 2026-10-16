const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder } = require('discord.js');
const { setLevelConfig, getLevelConfig } = require('../levelingHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setlevel')
    .setDescription('Atur channel khusus notifikasi Level Up & Achievement')
    .addChannelOption((o) =>
      o.setName('channel_levelup')
        .setDescription('Channel khusus pengumuman naik level')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((o) =>
      o.setName('channel_achievement')
        .setDescription('Channel khusus pengumuman achievement')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addBooleanOption((o) =>
      o.setName('reset')
        .setDescription('Reset: notifikasi kembali dikirim di channel tempat user chat')
        .setRequired(false)
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: '⚠️ Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }
    const lvlCh = interaction.options.getChannel('channel_levelup');
    const achCh = interaction.options.getChannel('channel_achievement');
    const reset = interaction.options.getBoolean('reset');

    if (reset) {
      setLevelConfig(interaction.guildId, { levelUpChannel: null, achievementChannel: null });
    } else {
      const updates = {};
      if (lvlCh) updates.levelUpChannel = lvlCh.id;
      if (achCh) updates.achievementChannel = achCh.id;
      if (Object.keys(updates).length) setLevelConfig(interaction.guildId, updates);
    }

    const cfg = getLevelConfig(interaction.guildId);
    const fmt = (id) => (id ? `<#${id}>` : '*Channel tempat user chat*');

    const embed = new EmbedBuilder()
      .setColor(0x9B59FF)
      .setTitle('⚙️ Pengaturan Notifikasi Leveling')
      .addFields(
        { name: '🆙 Level Up', value: fmt(cfg.levelUpChannel), inline: true },
        { name: '🏅 Achievement', value: fmt(cfg.achievementChannel), inline: true },
      )
      .setFooter({ text: 'Gunakan /setlevel reset:True untuk mengembalikan ke default' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
