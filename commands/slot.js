const {
  SlashCommandBuilder,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');
const { playSlotMachine, getSlotGameRow } = require('../gameHelper');
const { dispatchLevelUpAndAchievements } = require('../levelEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slot')
    .setDescription('Mainkan mesin slot buah menggunakan koin server dan raih JACKPOT 777 hingga 15x lipat')
    .addIntegerOption((opt) =>
      opt
        .setName('taruhan')
        .setDescription('Jumlah koin yang ditaruhkan (minimal 10 koin, default: 20 koin)')
        .setMinValue(10)
        .setMaxValue(5000)
        .setRequired(false)
    ),

  async execute(interaction) {
    const bet = interaction.options.getInteger('taruhan') || 20;
    const res = playSlotMachine(interaction.guildId, interaction.user.id, bet);

    if (!res.success && res.reason === 'INSUFFICIENT_COINS') {
      const errEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Saldo Koin Tidak Mencukupi')
        .setDescription(
          `Kamu membutuhkan minimal **${res.requiredCoins} Koin** untuk memutar mesin slot.\n\n` +
          `• Saldo Koin Kamu Saat Ini: **${res.currentCoins} Koin**\n\n` +
          `Dapatkan koin gratis dengan cara:\n` +
          `1. Ketik perintah \`/daily\` untuk klaim hadiah harian.\n` +
          `2. Aktif mengobrol di channel server.\n` +
          `3. Menangkan mini game Tebak Koin, Tebak Angka, atau Suit Jepang.`
        )
        .setFooter({ text: 'FlyBot Mini Games • Slot Buah 777' })
        .setTimestamp();

      return interaction.reply({ embeds: [errEmbed], flags: MessageFlags.Ephemeral });
    }

    const [r1, r2, r3] = res.reels;
    const isWin = res.isWin;
    const color = res.winType === 'SUPER_JACKPOT' ? 0xFEE75C : isWin ? 0x57F287 : 0xED4245;

    let resultDesc =
      `> ┌───────────────────────────┐\n` +
      `> │      ${r1.tag}  |  ${r2.tag}  |  ${r3.tag}      │\n` +
      `> └───────────────────────────┘\n\n` +
      `**Hasil:** ${res.winTitle}\n\n`;

    if (isWin) {
      resultDesc +=
        `• Taruhan: **${res.bet} Koin**\n` +
        `• Pengali Hadiah: **${res.multiplier}x**\n` +
        `• Kemenangan: **+${res.winnings} Koin** (Laba: **+${res.netProfit} Koin**)\n` +
        `• Bonus XP: **+${res.xpEarned} XP**\n` +
        `• Sisa Saldo: **${res.finalCoins.toLocaleString('id-ID')} Koin**`;
    } else {
      resultDesc +=
        `• Taruhan: **${res.bet} Koin** (Hangus)\n` +
        `• XP Partisipasi: **+${res.xpEarned} XP**\n` +
        `• Sisa Saldo: **${res.finalCoins.toLocaleString('id-ID')} Koin**\n\n` +
        `*Belum beruntung kali ini, coba putar lagi untuk memburu JACKPOT 777!*`;
    }

    if (res.reward?.leveledUp) {
      resultDesc += `\n\n**LEVEL UP!** Selamat naik ke **Level ${res.reward.newLevel}**!`;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setAuthor({
        name: `${interaction.user.username}  •  Mesin Slot Buah 777`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(`Mesin Slot: ${res.winTitle}`)
      .setDescription(resultDesc)
      .setFooter({ text: `Taruhan: ${res.bet} Koin • Putar lagi dengan tombol di bawah` })
      .setTimestamp();

    await interaction.reply({
      embeds: [embed],
      components: [getSlotGameRow(res.bet)],
    });

    if (res.reward) {
      dispatchLevelUpAndAchievements(
        interaction.guild,
        interaction.member,
        interaction.user,
        interaction.channel,
        res.reward
      ).catch(() => {});
    }
  },
};
