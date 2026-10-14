const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('buatchannel')
    .setDescription('Membuat satu channel baru dengan penamaan simbol & emoji estetik otomatis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('nama')
        .setDescription('Nama channel yang ingin dibuat (contoh: podcast, gaming, curhat)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('tipe')
        .setDescription('Tipe channel: Text (Teks) atau Voice (Suara)')
        .setRequired(true)
        .addChoices(
          { name: '💬 Text Channel (Obrolan Tulisan)', value: 'text' },
          { name: '🔊 Voice Channel (Obrolan Suara)', value: 'voice' }
        )
    )
    .addChannelOption((option) =>
      option
        .setName('kategori')
        .setDescription('Kategori tempat meletakkan channel baru ini (opsional)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    ),

  async execute(interaction) {
    const rawName = interaction.options.getString('nama').trim();
    const tipe = interaction.options.getString('tipe');
    const category = interaction.options.getChannel('kategori');

    // Berikan emoji otomatis yang cocok berdasarkan kata kunci
    let prefix = tipe === 'text' ? '💬・' : '🔊・';
    const lower = rawName.toLowerCase();

    if (lower.includes('musik') || lower.includes('music') || lower.includes('song')) {
      prefix = '🎵・';
    } else if (lower.includes('foto') || lower.includes('photo') || lower.includes('gambar') || lower.includes('art')) {
      prefix = '📸・';
    } else if (lower.includes('game') || lower.includes('mabar') || lower.includes('gaming')) {
      prefix = '🎮・';
    } else if (lower.includes('nonton') || lower.includes('movie') || lower.includes('film')) {
      prefix = '🎬・';
    } else if (lower.includes('info') || lower.includes('rule') || lower.includes('aturan')) {
      prefix = '📌・';
    }

    const formattedName = `${prefix}${rawName.replace(/\s+/g, '-')}`;

    try {
      const channel = await interaction.guild.channels.create({
        name: formattedName,
        type: tipe === 'text' ? ChannelType.GuildText : ChannelType.GuildVoice,
        parent: category ? category.id : null,
      });

      await interaction.reply({
        content: `✅ Berhasil membuat channel estetik baru: <#${channel.id}> (${tipe === 'text' ? 'Text' : 'Voice'})!`,
        flags: MessageFlags.Ephemeral,
      });
    } catch (error) {
      console.error('Error saat membuat channel estetik:', error);
      await interaction.reply({
        content: `❌ Gagal membuat channel: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
