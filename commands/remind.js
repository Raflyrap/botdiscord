const {
  SlashCommandBuilder,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { parseDuration, createReminder } = require('../reminderHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Pasang pengingat jadwal otomatis (bebas emoji, format rapi)')
    .addStringOption((opt) =>
      opt
        .setName('waktu')
        .setDescription('Durasi waktu (contoh: 10m, 1h, 30s, atau 15 menit, 2 jam)')
        .setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('pesan')
        .setDescription('Pesan yang ingin diingatkan')
        .setRequired(true)
    ),

  async execute(interaction) {
    const timeInput = interaction.options.getString('waktu');
    const messageText = interaction.options.getString('pesan');

    const durationMs = parseDuration(timeInput);
    if (!durationMs || durationMs < 5000) {
      return interaction.reply({
        content:
          'Format waktu tidak valid. Gunakan format seperti `30s`, `10m`, `1h`, `1d` (atau `10 menit`, `1 jam`). Minimal 5 detik.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Maksimal pengingat 30 hari
    if (durationMs > 30 * 24 * 60 * 60 * 1000) {
      return interaction.reply({
        content: 'Durasi waktu pengingat maksimal adalah 30 hari.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const reminder = createReminder(
      interaction.client,
      interaction.user.id,
      interaction.channelId,
      durationMs,
      messageText
    );

    const targetSec = Math.floor(reminder.targetTime / 1000);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Pengingat Berhasil Diatur')
      .setDescription(
        `Pengingat kamu telah dijadwalkan.\n\n` +
        `• Waktu Target: <t:${targetSec}:F> (<t:${targetSec}:R>)\n` +
        `• Isi Pesan: **${messageText}**\n\n` +
        `Bot akan otomatis menandai kamu di channel ini saat waktunya tiba.`
      )
      .setFooter({ text: 'FlyBot Sistem Pengingat' })
      .setTimestamp();

    return interaction.reply({ embeds: [embed] });
  },
};
