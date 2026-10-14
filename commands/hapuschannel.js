const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('hapuschannel')
    .setDescription('Menghapus channel atau kategori tertentu (atau channel saat ini)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Channel yang ingin dihapus (kosongkan jika ingin menghapus channel ini)')
        .setRequired(false)
    )
    .addStringOption((option) =>
      option
        .setName('alasan')
        .setDescription('Alasan penghapusan channel')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const alasan = interaction.options.getString('alasan') || 'Dihapus oleh admin';

    // Cek izin bot
    if (!targetChannel.deletable) {
      return interaction.reply({
        content: `❌ Bot tidak memiliki izin untuk menghapus channel **${targetChannel.name}**!`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const channelName = targetChannel.name;
    const isCurrentChannel = targetChannel.id === interaction.channel.id;

    try {
      if (isCurrentChannel) {
        // Jika menghapus channel saat ini, balas singkat sebelum dihapus
        await interaction.reply({
          content: `🗑️ Menghapus channel **#${channelName}** dalam 2 detik...`,
        });
        setTimeout(async () => {
          await targetChannel.delete(alasan).catch(console.error);
        }, 2000);
      } else {
        // Jika menghapus channel lain
        await targetChannel.delete(alasan);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🗑️ Channel Berhasil Dihapus')
          .setDescription(`Channel **${channelName}** telah berhasil dihapus dari server.`)
          .addFields({ name: 'Alasan', value: alasan })
          .setTimestamp();

        await interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error('Error saat menghapus channel:', error);
      await interaction.reply({
        content: `❌ Gagal menghapus channel: ${error.message}`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
