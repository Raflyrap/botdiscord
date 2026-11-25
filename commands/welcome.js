const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { enableFeature, disableFeature, isFeatureDisabled } = require('../featureToggleHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Nyalakan atau matikan fitur & channel Welcome secara otomatis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('on')
        .setDescription('Aktifkan fitur Welcome & munculkan kembali channel #welcome otomatis')
    )
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Matikan fitur Welcome & hilangkan channel #welcome secara otomatis')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Cek apakah fitur Welcome sedang aktif atau nonaktif')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (sub === 'off') {
        const res = await disableFeature(interaction.guild, 'welcome');
        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('🔴 Fitur Welcome Dimatikan (OFF)')
          .setDescription(
            `Fitur **Welcome** telah dinonaktifkan di server ini.\n\n` +
            (res.deletedNames.length > 0
              ? `• Channel dihapus otomatis: ${res.deletedNames.map((n) => `\`#${n}\``).join(', ')}\n`
              : `• Tidak ada channel welcome yang perlu dihapus.\n`) +
            `• Ketik \`/welcome on\` kapan saja untuk memunculkannya kembali.`
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => {
          interaction.user.send({ embeds: [embed] }).catch(() => {});
        });
      }

      if (sub === 'on') {
        const res = await enableFeature(interaction.guild, 'welcome');
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle('🟢 Fitur Welcome Diaktifkan (ON)')
          .setDescription(
            `Fitur **Welcome** berhasil diaktifkan kembali!\n\n` +
            (res.channel ? `• Channel Welcome: <#${res.channel.id}>\n` : '') +
            `• Pesan sambutan otomatis akan kembali dikirim setiap ada member baru yang bergabung.\n` +
            `• Ketik \`/welcome off\` jika ingin mematikannya lagi.`
          )
          .setTimestamp();
        return interaction.editReply({ embeds: [embed] }).catch(() => {
          interaction.user.send({ embeds: [embed] }).catch(() => {});
        });
      }

      const disabled = isFeatureDisabled(interaction.guild.id, 'welcome');
      return interaction.editReply({
        content: disabled
          ? '🔴 Status fitur **Welcome**: **NONAKTIF (OFF)**. Ketik `/welcome on` untuk mengaktifkan.'
          : '🟢 Status fitur **Welcome**: **AKTIF (ON)**. Ketik `/welcome off` untuk mematikan.',
      });
    } catch (err) {
      return interaction.editReply({
        content: `Gagal mengubah status Welcome: ${err.message}`,
      });
    }
  },
};
