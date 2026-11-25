const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const {
  FEATURE_CATALOG,
  enableFeature,
  disableFeature,
  getFeaturesOverview,
} = require('../featureToggleHelper');

const featureChoices = FEATURE_CATALOG.map((f) => ({
  name: f.label,
  value: f.key,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fitur')
    .setDescription('Matikan (OFF) atau nyalakan (ON) fitur bot satu per satu secara otomatis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .setDMPermission(false)
    .addSubcommand((sub) =>
      sub
        .setName('off')
        .setDescription('Matikan 1 fitur & otomatis hilangkan channel fitur tersebut')
        .addStringOption((opt) =>
          opt
            .setName('nama')
            .setDescription('Pilih fitur yang ingin dimatikan')
            .setRequired(true)
            .addChoices(...featureChoices)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('on')
        .setDescription('Nyalakan 1 fitur & otomatis munculkan kembali channel fitur tersebut')
        .addStringOption((opt) =>
          opt
            .setName('nama')
            .setDescription('Pilih fitur yang ingin dinyalakan')
            .setRequired(true)
            .addChoices(...featureChoices)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Lihat daftar seluruh fitur yang sedang ON / OFF di server ini')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (sub === 'off') {
        const key = interaction.options.getString('nama');
        const res = await disableFeature(interaction.guild, key);

        if (!res.success) {
          return interaction.editReply({ content: `❌ ${res.error}` });
        }

        const embed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle(`🔴 Fitur ${res.feature.label} Dimatikan (OFF)`)
          .setDescription(
            `Fitur **${res.feature.label}** telah dinonaktifkan di server **${interaction.guild.name}**.\n\n` +
            (res.deletedNames.length > 0
              ? `• Channel dihapus otomatis (${res.deletedNames.length}): ${res.deletedNames.map((n) => `\`#${n}\``).join(', ')}\n`
              : `• Tidak ada channel aktif yang perlu dihapus.\n`) +
            `• Ketik \`/fitur on nama:${res.feature.label}\` kapan saja untuk memunculkannya kembali.`
          )
          .setFooter({ text: 'FlyBot Individual Feature Manager' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => {
          interaction.user.send({ embeds: [embed] }).catch(() => {});
        });
      }

      if (sub === 'on') {
        const key = interaction.options.getString('nama');
        const res = await enableFeature(interaction.guild, key);

        if (!res.success) {
          return interaction.editReply({ content: `❌ ${res.error}` });
        }

        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setTitle(`🟢 Fitur ${res.feature.label} Diaktifkan (ON)`)
          .setDescription(
            `Fitur **${res.feature.label}** berhasil diaktifkan kembali di server **${interaction.guild.name}**!\n\n` +
            (res.channel ? `• Channel Aktif: <#${res.channel.id}>\n` : '') +
            `• Panel dan konfigurasi fitur sudah dipasang ulang secara otomatis.\n` +
            `• Ketik \`/fitur off nama:${res.feature.label}\` jika ingin mematikannya lagi.`
          )
          .setFooter({ text: 'FlyBot Individual Feature Manager' })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] }).catch(() => {
          interaction.user.send({ embeds: [embed] }).catch(() => {});
        });
      }

      // Subcommand: status
      const overview = await getFeaturesOverview(interaction.guild);
      const lines = overview.map((item) => {
        const icon = item.isOn ? '🟢 ON ' : '🔴 OFF';
        const chText = item.firstChannelId ? ` → <#${item.firstChannelId}>` : '';
        return `\`${icon}\` **${item.label}**${chText}`;
      });

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: `${interaction.guild.name} • Status Fitur FlyBot`,
          iconURL: interaction.guild.iconURL() || undefined,
        })
        .setTitle('Dashboard Status Fitur Per-Personal')
        .setDescription(
          lines.join('\n') +
          `\n\n> Gunakan \`/fitur off\` untuk mematikan & menghapus channel fitur tertentu, atau \`/fitur on\` untuk memunculkannya kembali.`
        )
        .setFooter({ text: `Total ${overview.length} Fitur Modular FlyBot` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('[FITUR TOGGLE ERROR]:', err);
      return interaction.editReply({
        content: `Terjadi kesalahan saat memproses toggle fitur: ${err.message}`,
      });
    }
  },
};
