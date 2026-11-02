const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  getGiveaway,
  createAdminGiveawayRows,
  isGiveawayAdmin,
} = require('../giveawayHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Buka panel kontrol rahasia giveaway (Khusus Owner & Admin)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    if (!isGiveawayAdmin(interaction)) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat diakses oleh Administrator atau Pemilik Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const gw = getGiveaway(interaction.guildId);
    if (!gw || !gw.channelId) {
      return interaction.reply({
        content: 'Belum ada sistem giveaway yang disiapkan di server ini. Silakan gunakan perintah `/setgiveaway` untuk membuat atau memilih channel giveaway terlebih dahulu.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const participants = gw.participants || [];
    const isEnded = gw.status === 'ended';

    const adminEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Panel Kontrol Rahasia Giveaway')
      .setDescription(
        `Channel Giveaway: <#${gw.channelId}>\n\n` +
        `**Informasi Giveaway:**\n` +
        `> • Hadiah: **${gw.prize || 'Hadiah Spesial'}**\n` +
        `> • Kuota Pemenang: **${gw.winnersCount || 1} Orang**\n` +
        `> • Status: **${isEnded ? 'Selesai (Sudah Diundi)' : 'Sedang Berlangsung'}**\n` +
        `> • Total Peserta Rahasia: **${participants.length} Orang**\n\n` +
        `Gunakan tombol kontrol di bawah untuk mengelola giveaway tanpa diketahui member biasa:`
      )
      .setFooter({ text: 'FlyBot Giveaway Management • Panel Privat' })
      .setTimestamp();

    return interaction.reply({
      embeds: [adminEmbed],
      components: [createAdminGiveawayRows(participants.length)],
      flags: MessageFlags.Ephemeral,
    });
  },
};

