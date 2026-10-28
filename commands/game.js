const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  getGameConfig,
  setupMiniGames,
  removeMiniGames,
} = require('../gameHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('game')
    .setDescription('Setup otomatis kategori dan 5 channel arena mini games interaktif (termasuk Sambung Kata & Slot)')
    .addStringOption((opt) =>
      opt
        .setName('aksi')
        .setDescription('Pilih aksi: Setup atau Hapus (Default: Setup)')
        .setRequired(false)
        .addChoices(
          { name: 'Setup (Buat Kategori & 5 Channel Game)', value: 'setup' },
          { name: 'Hapus (Hapus Kategori & 5 Channel Game)', value: 'hapus' }
        )
    ),

  async execute(interaction) {
    const hasPerm =
      interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageChannels) ||
      interaction.guild?.ownerId === interaction.user.id;

    if (!hasPerm) {
      return interaction.reply({
        content: 'Perintah ini hanya bisa dijalankan oleh Administrator atau Pengelola Server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const action = interaction.options.getString('aksi') || 'setup';
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    if (action === 'setup') {
      try {
        const result = await setupMiniGames(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: `${interaction.guild.name}  •  Mini Games`,
            iconURL: interaction.guild.iconURL() || undefined,
          })
          .setTitle('Arena Mini Games Berhasil Dibuat')
          .setDescription(
            `Kategori **${result.category.name}** dan 5 channel game khusus telah siap:\n\n` +
            `• <#${result.coinChannel.id}> — Tebak Koin (Gambar / Angka)\n` +
            `• <#${result.numberChannel.id}> — Tebak Angka (1 - 100)\n` +
            `• <#${result.rpsChannel.id}> — Suit (Gunting Batu Kertas)\n` +
            `• <#${result.slotChannel.id}> — Mesin Slot Buah 777 (Gacha Koin)\n` +
            `• <#${result.sambungKataChannel.id}> — Sambung Kata KBBI (2 Huruf vs Bot)\n\n` +
            `Setiap channel telah dilengkapi panduan bermain yang disematkan permanen dan tombol interaktif.`
          )
          .setFooter({ text: 'Ketik /game aksi:Hapus jika ingin menghapus arena game' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat setupMiniGames:', err);
        return interaction.editReply({
          content: `Gagal membuat arena mini games: ${err.message}`,
        });
      }
    }

    if (action === 'hapus') {
      try {
        const cfg = getGameConfig(interaction.guildId);
        if (!cfg || !cfg.enabled) {
          return interaction.editReply({
            content: 'Arena mini games saat ini belum ada atau belum diaktifkan.',
          });
        }

        await removeMiniGames(interaction.guild);

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Arena Mini Games Dihapus')
          .setDescription(
            'Seluruh channel mini games dan kategori telah berhasil dihapus secara bersih.\n\n' +
            'Ketik `/game` kembali jika ingin membuatnya lagi sewaktu-waktu.'
          )
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        console.error('Error saat removeMiniGames:', err);
        return interaction.editReply({
          content: `Gagal menghapus arena mini games: ${err.message}`,
        });
      }
    }
  },
};
