const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buatkategori')
    .setDescription('Membuat sub-judul / kategori baru di server (seperti Text Channels, Voice Channels)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('nama')
        .setDescription('Nama sub-judul / kategori (contoh: Text Channels, Voice Channels, Gaming Lounge)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('gaya')
        .setDescription('Gaya tampilan sub-judul')
        .setRequired(false)
        .addChoices(
          { name: '✨ Bersih / Standar (Contoh: Text Channels)', value: 'clean' },
          { name: '📁 Garis Estetik (Contoh: 💬 ━━━━ TEXT CHANNELS ━━━━)', value: 'lines' },
          { name: '✦ Simbol Elegan (Contoh: ✦ TEXT CHANNELS ✦)', value: 'stars' },
          { name: '🔠 Huruf Kapital Saja (Contoh: TEXT CHANNELS)', value: 'upper' }
        )
    )
    .addStringOption((option) =>
      option
        .setName('posisi')
        .setDescription('Penempatan posisi kategori')
        .setRequired(false)
        .addChoices(
          { name: 'Normal (Di Bawah)', value: 'bottom' },
          { name: 'Paling Atas', value: 'top' }
        )
    ),

  async execute(interaction) {
    const rawName = interaction.options.getString('nama').trim();
    const gaya = interaction.options.getString('gaya') || 'clean';
    const posisi = interaction.options.getString('posisi') || 'bottom';

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
    }

    try {
      const category = await interaction.guild.channels.create({
        name: formattedName,
        type: ChannelType.GuildCategory,
        position: posisi === 'top' ? 0 : undefined,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('📂 Sub-Judul / Kategori Baru Berhasil Dibuat')
        .setDescription(
          `Kategori pembatas baru telah aktif di server:\n\n` +
          `📁 **Nama Kategori:** \`${category.name}\`\n` +
          `📍 **ID Kategori:** \`${category.id}\`\n\n` +
          `*Sekarang kamu bisa memindahkan atau membuat channel teks & suara ke dalam sub-judul ini!*`
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat membuat kategori:', error);
      await interaction.reply({
        content: `❌ Gagal membuat kategori: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
