const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editkategori')
    .setDescription('Mengubah/rename nama sub-judul atau kategori di server')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) =>
      option
        .setName('kategori')
        .setDescription('Pilih sub-judul / kategori yang ingin diubah namanya')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('nama_baru')
        .setDescription('Nama baru untuk sub-judul / kategori ini')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('gaya')
        .setDescription('Pilihan format gaya tampilan')
        .setRequired(false)
        .addChoices(
          { name: '✨ Bersih / Standar (Contoh: Text Channels)', value: 'clean' },
          { name: '📁 Garis Estetik (Contoh: 💬 ━━━━━ TEXT CHANNELS ━━━━━)', value: 'lines' },
          { name: '✦ Simbol Elegan (Contoh: ✦ TEXT CHANNELS ✦)', value: 'stars' },
          { name: '🔠 Huruf Kapital Saja (Contoh: TEXT CHANNELS)', value: 'upper' },
          { name: '📝 Sesuai Teks Asli (Tanpa Diubah)', value: 'plain' }
        )
    ),

  async execute(interaction) {
    const targetCategory = interaction.options.getChannel('kategori');
    const rawName = interaction.options.getString('nama_baru').trim();
    const gaya = interaction.options.getString('gaya') || 'clean';

    if (!targetCategory.manageable) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk mengubah kategori **${targetCategory.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let formattedName = rawName;
    const upperName = rawName.toUpperCase();
    const lower = rawName.toLowerCase();

    let icon = '📁';
    if (lower.includes('text') || lower.includes('chat') || lower.includes('obrolan')) {
      icon = '💬';
    } else if (lower.includes('voice') || lower.includes('suara') || lower.includes('lounge') || lower.includes('talk')) {
      icon = '🔊';
    } else if (lower.includes('music') || lower.includes('musik')) {
      icon = '🎵';
    } else if (lower.includes('game') || lower.includes('mabar')) {
      icon = '🎮';
    }

    if (gaya === 'clean') {
      formattedName = rawName;
    } else if (gaya === 'lines') {
      formattedName = `${icon} ━━━━━ ${upperName} ━━━━━`;
    } else if (gaya === 'stars') {
      formattedName = `✦ ${upperName} ✦`;
    } else if (gaya === 'upper') {
      formattedName = upperName;
    } else if (gaya === 'plain') {
      formattedName = rawName;
    }

    const oldName = targetCategory.name;

    try {
      await targetCategory.setName(formattedName);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✏️ Sub-Judul / Kategori Berhasil Diubah')
        .setDescription(`Nama sub-judul kategori telah berhasil diperbarui:`)
        .addFields(
          { name: 'Nama Lama', value: `\`${oldName}\``, inline: true },
          { name: 'Nama Baru', value: `\`${formattedName}\``, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat rename kategori:', error);
      await interaction.reply({
        content: `❌ Gagal mengubah nama kategori: ${error.message} *(Catatan: Discord membatasi pergantian nama maksimal 2 kali per 10 menit)*`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
