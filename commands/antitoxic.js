const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { addBadword, removeBadword, getAllBadwords, getServerConfig } = require('../autoModHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antitoxic')
    .setDescription('Kelola sistem Anti-Toxic & Kata Kasar Server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('tambah')
        .setDescription('Tambah kata yang dilarang (dianggap toxic)')
        .addStringOption((opt) =>
          opt
            .setName('kata')
            .setDescription('Kata yang ingin dilarang di server')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('hapus')
        .setDescription('Hapus kata dari daftar kata terlarang')
        .addStringOption((opt) =>
          opt
            .setName('kata')
            .setDescription('Kata yang ingin dihapus')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat daftar kata terlarang di server ini')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    if (sub === 'tambah') {
      const kata = interaction.options.getString('kata');
      const success = addBadword(guildId, kata);
      if (success) {
        return interaction.reply({
          content: `✅ Kata \`${kata.toLowerCase()}\` berhasil ditambahkan ke daftar kata terlarang (toxic)!`,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `⚠️ Kata \`${kata.toLowerCase()}\` sudah ada di daftar kata terlarang!`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'hapus') {
      const kata = interaction.options.getString('kata');
      const success = removeBadword(guildId, kata);
      if (success) {
        return interaction.reply({
          content: `✅ Kata \`${kata.toLowerCase()}\` berhasil dihapus dari daftar kata terlarang khusus server!`,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `⚠️ Kata \`${kata.toLowerCase()}\` tidak ditemukan di daftar custom kata terlarang server ini.`,
          ephemeral: true,
        });
      }
    }

    if (sub === 'list') {
      const config = getServerConfig(guildId);
      const allWords = getAllBadwords(guildId);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🛡️ Daftar Anti-Toxic Server: ${interaction.guild.name}`)
        .setDescription(
          `**Kata Custom Server (${config.customBadwords.length}):**\n` +
          (config.customBadwords.length > 0
            ? config.customBadwords.map((w) => `• \`${w}\``).join(', ')
            : '*Belum ada kata khusus yang ditambahkan admin.*') +
          `\n\n**Total Terdeteksi:** \`${allWords.length}\` kata (termasuk kata kasar umum bahasa Indonesia & Inggris).`
        )
        .setFooter({ text: 'Gunakan /antitoxic tambah <kata> untuk menambah kata terlarang baru.' });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
