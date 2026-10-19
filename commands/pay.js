const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const lvl = require('../levelingHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('pay')
    .setDescription('Kirim koin ke anggota lain di server')
    .addUserOption((opt) =>
      opt
        .setName('user')
        .setDescription('Pilih pengguna yang ingin dikirimi koin')
        .setRequired(true)
    )
    .addIntegerOption((opt) =>
      opt
        .setName('jumlah')
        .setDescription('Jumlah koin yang ingin dikirim')
        .setMinValue(1)
        .setRequired(true)
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('jumlah');

    if (targetUser.id === interaction.user.id) {
      return interaction.reply({
        content: 'Kamu tidak bisa mentransfer koin ke akun sendiri.',
        flags: MessageFlags.Ephemeral,
      });
    }

    if (targetUser.bot) {
      return interaction.reply({
        content: 'Akun bot tidak dapat menerima transfer koin.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const res = lvl.transferCoins(interaction.guildId, interaction.user.id, targetUser.id, amount);

    if (!res.success) {
      if (res.reason === 'INSUFFICIENT_FUNDS') {
        const myData = lvl.getUserData(interaction.guildId, interaction.user.id);
        return interaction.reply({
          content: `Saldo koin kamu tidak mencukupi. Saldo kamu saat ini: **${(myData.coins || 0).toLocaleString()} Koin**.`,
          flags: MessageFlags.Ephemeral,
        });
      }
      return interaction.reply({
        content: 'Gagal melakukan transfer koin. Pastikan jumlah koin valid.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({
        name: 'FlyBot  •  Transfer Koin',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTitle('Bukti Pengiriman Koin')
      .setDescription(
        `<@${interaction.user.id}> berhasil mentransfer **${amount.toLocaleString()} Koin** ke <@${targetUser.id}>.`
      )
      .addFields(
        {
          name: 'Pengirim',
          value: `<@${interaction.user.id}>\nSisa Saldo: \`${res.senderBalance.toLocaleString()} Koin\``,
          inline: true,
        },
        {
          name: 'Penerima',
          value: `<@${targetUser.id}>\nSaldo Baru: \`${res.receiverBalance.toLocaleString()} Koin\``,
          inline: true,
        }
      )
      .setFooter({ text: 'Transaksi otomatis tercatat dan tersimpan secara permanen' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
