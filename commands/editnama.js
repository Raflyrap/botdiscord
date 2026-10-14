const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('editnama')
    .setDescription('Mengubah/rename nama channel atau kategori')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('nama_baru')
        .setDescription('Nama baru yang diinginkan')
        .setRequired(true)
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel atau kategori yang ingin diubah namanya (default: channel saat ini)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('gaya')
        .setDescription('Format penamaan estetik')
        .setRequired(false)
        .addChoices(
          { name: '✨ Otomatis Beri Simbol Estetik (misal: 💬・nama-channel)', value: 'aesthetic' },
          { name: '📝 Sesuai Teks Asli (Tanpa Diubah)', value: 'plain' }
        )
    ),

  async execute(interaction) {
    const rawName = interaction.options.getString('nama_baru').trim();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const gaya = interaction.options.getString('gaya') || 'plain';

    if (!targetChannel.manageable) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk mengubah nama **${targetChannel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    let finalName = rawName;

    // Jika memilih gaya estetik dan bukan kategori
    if (gaya === 'aesthetic' && targetChannel.type !== ChannelType.GuildCategory) {
      const lower = rawName.toLowerCase();
      let prefix = targetChannel.isVoiceBased() ? '🔊・' : '💬・';

      if (lower.includes('music') || lower.includes('musik') || lower.includes('lagu')) {
        prefix = '🎵・';
      } else if (lower.includes('foto') || lower.includes('gambar') || lower.includes('media')) {
        prefix = '📸・';
      } else if (lower.includes('game') || lower.includes('mabar')) {
        prefix = '🎮・';
      } else if (lower.includes('nonton') || lower.includes('movie')) {
        prefix = '🎬・';
      } else if (lower.includes('rule') || lower.includes('info') || lower.includes('aturan')) {
        prefix = '📌・';
      }

      finalName = `${prefix}${rawName.replace(/\s+/g, '-')}`;
    }

    const oldName = targetChannel.name;

    try {
      await targetChannel.setName(finalName);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✏️ Nama Channel Berhasil Diubah')
        .setDescription(`Channel <#${targetChannel.id}> telah berhasil diubah namanya:`)
        .addFields(
          { name: 'Nama Lama', value: `\`${oldName}\``, inline: true },
          { name: 'Nama Baru', value: `\`${finalName}\``, inline: true }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat rename channel:', error);
      await interaction.reply({
        content: `❌ Gagal mengubah nama: ${error.message} *(Catatan: Discord membatasi rename maksimal 2 kali per 10 menit)*`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
