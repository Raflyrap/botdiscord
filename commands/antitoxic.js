const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const {
  addBadword,
  removeBadword,
  getAllBadwords,
  getBadwordsBreakdown,
} = require('../autoModHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('antitoxic')
    .setDescription('Kelola sistem Anti-Toxic & Kata Kasar Server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Lihat seluruh daftar kata terlarang (1 per 1) di server ini')
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Hapus kata dari daftar kata terlarang')
        .addStringOption((opt) =>
          opt
            .setName('kata')
            .setDescription('Kata yang ingin dihapus dari daftar terlarang')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('hapus')
        .setDescription('Hapus kata dari daftar kata terlarang (alias /delete)')
        .addStringOption((opt) =>
          opt
            .setName('kata')
            .setDescription('Kata yang ingin dihapus dari daftar terlarang')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
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
        .setName('add')
        .setDescription('Tambah kata yang dilarang (alias /tambah)')
        .addStringOption((opt) =>
          opt
            .setName('kata')
            .setDescription('Kata yang ingin dilarang di server')
            .setRequired(true)
        )
    ),

  async autocomplete(interaction) {
    try {
      const focusedOption = interaction.options.getFocused(true);
      if (focusedOption.name === 'kata') {
        const guildId = interaction.guildId;
        const allWords = getAllBadwords(guildId);
        const query = (focusedOption.value || '').toLowerCase().trim();

        const filtered = allWords
          .filter((w) => w.toLowerCase().includes(query))
          .slice(0, 25)
          .map((w) => ({ name: w, value: w }));

        await interaction.respond(filtered).catch(() => {});
      }
    } catch (err) {
      console.error('Error autocomplete /antitoxic:', err);
    }
  },

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    // Subcommand: Tambah kata (tambah / add)
    if (sub === 'tambah' || sub === 'add') {
      const kata = interaction.options.getString('kata');
      const clean = (kata || '').toLowerCase().trim();
      const success = addBadword(guildId, clean);
      if (success) {
        return interaction.reply({
          content: `✅ Kata \`${clean}\` berhasil ditambahkan ke daftar kata terlarang! Bot akan otomatis menghapus pesan yang mengandung kata ini.`,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `⚠️ Kata \`${clean}\` sudah ada di daftar kata terlarang aktif server ini!`,
          ephemeral: true,
        });
      }
    }

    // Subcommand: Hapus kata (delete / hapus)
    if (sub === 'delete' || sub === 'hapus') {
      const kata = interaction.options.getString('kata');
      const clean = (kata || '').toLowerCase().trim();
      const success = removeBadword(guildId, clean);
      if (success) {
        return interaction.reply({
          content: `✅ Kata \`${clean}\` berhasil dihapus dari daftar kata terlarang! Kata ini sekarang diperbolehkan di server ini.`,
          ephemeral: true,
        });
      } else {
        return interaction.reply({
          content: `⚠️ Kata \`${clean}\` tidak ditemukan di daftar kata terlarang aktif server ini.\nGunakan \`/antitoxic list\` untuk mengecek semua kata yang sedang aktif.`,
          ephemeral: true,
        });
      }
    }

    // Subcommand: List kata (ditampilkan 1 per 1 tanpa disembunyikan)
    if (sub === 'list') {
      const { defaults, customs, disabled, all } = getBadwordsBreakdown(guildId);

      const defaultLines = defaults.length > 0
        ? defaults.map((w, i) => `${i + 1}. \`${w}\``).join('\n')
        : '*Semua kata bawaan telah dinonaktifkan oleh admin.*';

      const customLines = customs.length > 0
        ? customs.map((w, i) => `${i + 1}. \`${w}\``).join('\n')
        : '*Belum ada kata khusus tambahan dari admin.*';

      const disabledSection = disabled.length > 0
        ? `\n\n🔓 **Kata Bawaan Yang Diizinkan (Dihapus Admin):**\n` +
          disabled.map((w) => `• ~~${w}~~`).join(', ')
        : '';

      const baseDesc =
        `Seluruh kata berikut akan otomatis disensor/dihapus jika dikirim member (terdaftar 1 per 1 tanpa disembunyikan):\n\n` +
        `📊 **Ringkasan:**\n` +
        `• Total Kata Aktif: **${all.length} kata**\n` +
        `• Kata Bawaan Sistem: **${defaults.length} kata**\n` +
        `• Kata Tambahan Server: **${customs.length} kata**\n` +
        `${disabled.length > 0 ? `• Kata Dikecualikan: **${disabled.length} kata**\n` : ''}` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📋 **Daftar Kata Bawaan Sistem (${defaults.length}):**\n` +
        `${defaultLines}\n\n` +
        `⭐ **Daftar Kata Tambahan Server (${customs.length}):**\n` +
        `${customLines}` +
        `${disabledSection}`;

      // Discord embed description limit is 4096 characters.
      // If description fits in one embed:
      if (baseDesc.length <= 4000) {
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🛡️ Daftar Anti-Toxic Server: ${interaction.guild.name}`)
          .setDescription(baseDesc)
          .setFooter({ text: 'Tambah: /antitoxic tambah <kata> | Hapus: /antitoxic delete <kata>' })
          .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      // Jika sangat panjang (admin menambah banyak kata), pisah menjadi beberapa embed
      const embed1 = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🛡️ Daftar Anti-Toxic Server: ${interaction.guild.name} (Bagian 1)`)
        .setDescription(
          `📊 **Total Kata Aktif:** **${all.length} kata**\n\n` +
          `📋 **Daftar Kata Bawaan Sistem (${defaults.length}):**\n${defaultLines}` +
          `${disabledSection}`
        );

      const embed2 = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle(`🛡️ Daftar Anti-Toxic Server: ${interaction.guild.name} (Bagian 2 - Kata Tambahan)`)
        .setDescription(
          `⭐ **Daftar Kata Tambahan Server (${customs.length}):**\n${customLines.slice(0, 3900)}`
        )
        .setFooter({ text: 'Tambah: /antitoxic tambah <kata> | Hapus: /antitoxic delete <kata>' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed1, embed2], ephemeral: true });
    }
  },
};

