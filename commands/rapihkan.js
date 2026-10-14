const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rapihkan')
    .setDescription('Otomatis menata urutan seluruh kategori server agar estetik dan terstruktur')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;

    try {
      // Ambil seluruh kategori di server
      const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory);

      if (categories.size === 0) {
        return interaction.editReply('⚠️ Tidak ditemukan kategori apa pun di server ini!');
      }

      // Prioritas urutan estetik berdasarkan kata kunci
      function getCategoryScore(name) {
        const lower = name.toLowerCase();
        if (lower.includes('statistik') || lower.includes('stats') || lower.includes('📊')) return 1;
        if (lower.includes('informasi') || lower.includes('info') || lower.includes('rule') || lower.includes('📁')) return 2;
        if (lower.includes('text') || lower.includes('chat') || lower.includes('obrolan') || lower.includes('💬')) return 3;
        if (lower.includes('temp voice') || lower.includes('auto voice') || lower.includes('join to create')) return 4;
        if (lower.includes('voice') || lower.includes('suara') || lower.includes('lounge') || lower.includes('🔊')) return 5;
        return 6;
      }

      const sortedCategories = Array.from(categories.values()).sort((a, b) => {
        return getCategoryScore(a.name) - getCategoryScore(b.name);
      });

      // Atur posisi kategori secara berurutan
      for (let i = 0; i < sortedCategories.length; i++) {
        await sortedCategories[i].setPosition(i).catch(console.error);
      }

      const daftarUrutan = sortedCategories.map((cat, idx) => `**${idx + 1}.** ${cat.name}`).join('\n');

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✨ Seluruh Kategori Server Berhasil Dirapikan!')
        .setDescription(
          `Posisi susunan kategori di server telah otomatis disejajarkan dengan rapi dari atas ke bawah:\n\n` +
          daftarUrutan +
          `\n\n*Server sekarang jauh lebih estetik, tertata, dan nyaman dilihat!*`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat merapikan susunan server:', error);
      await interaction.editReply(`❌ Gagal merapikan kategori: ${error.message}`);
    }
  },
};
