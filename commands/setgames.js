const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  setupMiniGamesTemplate,
  getOrCreateRole,
  setTemplateConfig,
  getTemplateConfig,
} = require('../templateSetupHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setgames')
    .setDescription('Setup kategori & channel arena mini games interaktif (Tebak Koin, Tebak Angka, Suit)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus arena game (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Kategori & Channel Games)', value: 'setup' },
          { name: 'Hapus (Hapus Konfigurasi Games)', value: 'hapus' }
        )
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.options.getString('aksi') || 'setup';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const memberRole = await getOrCreateRole(interaction.guild, { name: 'Member', color: 0x99aab5 });
        const result = await setupMiniGamesTemplate(interaction.guild, { member: memberRole });

        const currentCfg = getTemplateConfig(interaction.guildId);
        setTemplateConfig(interaction.guildId, {
          channels: {
            ...(currentCfg.channels || {}),
            coinId: result.coinChannel.id,
            numberId: result.numberChannel.id,
            rpsId: result.rpsChannel.id,
          },
        });

        const embed = new EmbedBuilder()
          .setColor(0xFEE75C)
          .setAuthor({
            name: `${interaction.guild.name} • Setup Mini Games Arena`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Arena Mini Games Berhasil Dibuat')
          .setDescription(
            `Kategori **${result.category.name}** dan 3 channel mini games siap dimainkan berhadiah koin & XP:\n\n` +
            `• <#${result.coinChannel.id}> — Tebak Koin (Gambar / Angka)\n` +
            `• <#${result.numberChannel.id}> — Tebak Angka (1 - 100)\n` +
            `• <#${result.rpsChannel.id}> — Suit (Gunting Batu Kertas)\n\n` +
            `*Semua game langsung aktif dengan tombol interaktif dan chat langsung!*`
          )
          .setFooter({ text: 'Gunakan /setgames aksi:Hapus jika ingin menonaktifkannya.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setup /setgames:', err);
        return interaction.editReply({
          content: `Gagal mengatur arena Mini Games: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const currentCfg = getTemplateConfig(interaction.guildId);
        const channels = { ...(currentCfg.channels || {}) };
        delete channels.coinId;
        delete channels.numberId;
        delete channels.rpsId;
        setTemplateConfig(interaction.guildId, { channels });

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Konfigurasi Mini Games Dihapus')
          .setDescription('Pengaturan arena mini games telah dinonaktifkan dari konfigurasi FlyBot.')
          .setFooter({ text: 'Ketik /setgames kembali jika ingin mengaktifkannya sewaktu-waktu.' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        return interaction.editReply({
          content: `Gagal menghapus konfigurasi: ${err.message}`,
        });
      }
    }
  },
};
