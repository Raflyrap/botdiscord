const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const lvl = require('../levelingHelper');
const { dispatchLevelUpAndAchievements } = require('../levelEmbeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Klaim hadiah koin dan XP harian kamu setiap 24 jam'),

  async execute(interaction) {
    const res = lvl.claimDaily(interaction.guildId, interaction.user.id);

    if (!res.success) {
      const hours = Math.floor(res.remainingMs / (1000 * 60 * 60));
      const mins = Math.floor((res.remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const cooldownText = hours > 0 ? `${hours} jam ${mins} menit` : `${mins} menit`;

      const cdEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Hadiah Harian Belum Siap')
        .setDescription(
          `Kamu sudah mengklaim jatah hadiah harian hari ini.\n\n` +
          `• Waktu tunggu tersisa: **${cooldownText}**\n` +
          `• Kembalilah setelah waktu tunggu selesai untuk melanjutkan streak harianmu.`
        )
        .setFooter({ text: 'Klaim hadiah tersedia setiap 24 jam sekali' })
        .setTimestamp();

      return interaction.reply({ embeds: [cdEmbed] });
    }

    // Trigger level up and achievements notification jika ada
    await dispatchLevelUpAndAchievements(
      interaction.guild,
      interaction.member,
      interaction.user,
      interaction.channel,
      res
    );

    let levelUpNotice = res.leveledUp
      ? `\n\n**LEVEL UP!** Selamat kamu naik ke **Level ${res.newLevel}**!`
      : '';

    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setAuthor({
        name: 'FlyBot  •  Hadiah Harian',
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTitle('Klaim Hadiah Harian Berhasil')
      .setDescription(
        `Halo <@${interaction.user.id}>, berikut rincian hadiah harian yang berhasil kamu klaim hari ini:${levelUpNotice}`
      )
      .addFields(
        {
          name: 'Koin Diperoleh',
          value: `\`+${res.coins.toLocaleString()} Koin\``,
          inline: true,
        },
        {
          name: 'XP Diperoleh',
          value: `\`+${res.xp.toLocaleString()} XP\``,
          inline: true,
        },
        {
          name: 'Daily Streak',
          value: `\`${res.streak} Hari\` ${res.streak >= 3 ? '*(Bonus Aktif)*' : ''}`,
          inline: true,
        },
        {
          name: 'Total Saldo Koin',
          value: `\`${res.totalCoins.toLocaleString()} Koin\``,
          inline: true,
        },
        {
          name: 'Total Akumulasi XP',
          value: `\`${res.totalXp.toLocaleString()} XP\``,
          inline: true,
        },
        {
          name: 'Klaim Berikutnya',
          value: '`24 Jam dari sekarang`',
          inline: true,
        }
      )
      .setFooter({
        text: 'Tips: Pertahankan streak harian setiap hari untuk bonus reward yang semakin besar!',
      })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
