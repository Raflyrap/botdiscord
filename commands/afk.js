const { SlashCommandBuilder } = require('discord.js');
const { setAfk } = require('../afkHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set status AFK (Away From Keyboard) kamu dengan alasan')
    .addStringOption((opt) =>
      opt
        .setName('alasan')
        .setDescription('Alasan kamu AFK (contoh: lagi makan / tidur / mandi)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const alasan = interaction.options.getString('alasan') || 'Sedang sibuk / AFK';
    setAfk(interaction.guild.id, interaction.user.id, alasan);

    // Ubah nickname user jika bot punya izin
    if (interaction.member && interaction.guild.members.me.permissions.has('ManageNicknames')) {
      const currentNick = interaction.member.displayName;
      if (!currentNick.startsWith('[AFK]')) {
        await interaction.member.setNickname(`[AFK] ${currentNick.substring(0, 25)}`).catch(() => {});
      }
    }

    await interaction.reply({
      content: `💤 <@${interaction.user.id}> sekarang berstatus **AFK**: *${alasan}*\n*(Status AFK akan otomatis hilang saat kamu mengirim pesan lagi)*`
    });
  },
};
