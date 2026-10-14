const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
  ChannelType,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('geserchannel')
    .setDescription('Menggeser posisi channel ke atas/bawah atau memindahkannya ke kategori lain')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption((option) =>
      option
        .setName('arah')
        .setDescription('Pilih arah pergeseran channel')
        .setRequired(true)
        .addChoices(
          { name: '⬆️ Naik 1 Posisi (Ke Atas)', value: 'up' },
          { name: '⬇️ Turun 1 Posisi (Ke Bawah)', value: 'down' },
          { name: '🔝 Paling Atas', value: 'top' },
          { name: '🔚 Paling Bawah', value: 'bottom' }
        )
    )
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel yang ingin digeser (kosongkan jika channel saat ini)')
        .setRequired(false)
    )
    .addChannelOption((option) =>
      option
        .setName('pindah_kategori')
        .setDescription('Pindahkan channel ini ke dalam kategori tertentu (opsional)')
        .addChannelTypes(ChannelType.GuildCategory)
        .setRequired(false)
    ),

  async execute(interaction) {
    const arah = interaction.options.getString('arah');
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const targetCategory = interaction.options.getChannel('pindah_kategori');

    if (!targetChannel.manageable) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk menggeser channel **${targetChannel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      let infoKategori = '';

      // Jika ada instruksi pindah kategori
      if (targetCategory) {
        await targetChannel.setParent(targetCategory.id, { lockPermissions: false });
        infoKategori = ` dan dipindahkan ke kategori **${targetCategory.name}**`;
      }

      const currentPos = targetChannel.position;
      let newPos = currentPos;

      if (arah === 'up') {
        newPos = Math.max(0, currentPos - 1);
      } else if (arah === 'down') {
        newPos = currentPos + 1;
      } else if (arah === 'top') {
        newPos = 0;
      } else if (arah === 'bottom') {
        newPos = 999;
      }

      await targetChannel.setPosition(newPos);

      const labelArah = {
        up: '⬆️ Naik 1 Posisi',
        down: '⬇️ Turun 1 Posisi',
        top: '🔝 Paling Atas',
        bottom: '🔚 Paling Bawah',
      }[arah];

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📐 Posisi Channel Berhasil Diubah')
        .setDescription(`Channel <#${targetChannel.id}> berhasil digeser **${labelArah}**${infoKategori}!`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat menggeser channel:', error);
      await interaction.reply({
        content: `❌ Gagal menggeser channel: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
