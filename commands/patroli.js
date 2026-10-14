const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
} = require('discord.js');
const { setPatroliActive, joinPatroliChannel } = require('../patroliHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('patroli')
    .setDescription('Menjaga voice channel 24 jam nonstop tanpa keluar room')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Pilih voice channel yang ingin dijaga (opsional, default: voice tempat kamu berada)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    ),

  async execute(interaction) {
    // 1. Defer reply agar tidak timeout
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    if (!interaction.guild) {
      return interaction.editReply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server.',
      });
    }

    let targetVoice = interaction.options?.getChannel ? interaction.options.getChannel('channel') : null;

    // Jika channel tidak dipilih dari opsi, cari voice tempat user berada
    if (!targetVoice) {
      let member = interaction.member;
      if (!member?.voice) {
        member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      }

      targetVoice = member?.voice?.channel;

      if (!targetVoice && member?.voice?.channelId) {
        targetVoice = await interaction.guild.channels.fetch(member.voice.channelId).catch(() => null);
      }

      if (!targetVoice) {
        const vs = interaction.guild.voiceStates?.cache?.get(interaction.user.id);
        if (vs?.channelId) {
          targetVoice = vs.channel || (await interaction.guild.channels.fetch(vs.channelId).catch(() => null));
        }
      }
    }

    if (!targetVoice) {
      return interaction.editReply({
        content: 'Kamu harus masuk ke voice channel terlebih dahulu atau pilih channel di opsi perintah `/patroli`.',
      });
    }

    // Periksa izin bot untuk join voice
    const botPerms = targetVoice.permissionsFor(interaction.client.user);
    if (botPerms && !botPerms.has(PermissionsBitField.Flags.Connect)) {
      return interaction.editReply({
        content: `Bot tidak memiliki izin untuk bergabung ke voice channel **${targetVoice.name}**.`,
      });
    }

    try {
      // 1. Simpan konfigurasi patroli aktif
      setPatroliActive(interaction.guildId, targetVoice.id, interaction.channelId);

      // 2. Hubungkan bot langsung ke voice channel
      joinPatroliChannel(targetVoice);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🛡️ Patroli Voice 24 Jam Aktif')
        .setDescription(
          `Bot telah masuk ke saluran <#${targetVoice.id}> untuk berjaga 24 jam nonstop.\n\n` +
          `• **Status:** Berjaga Nonstop (24/7)\n` +
          `• **Mode:** Standby Room Guard\n` +
          `• **Voice Channel:** <#${targetVoice.id}>\n\n` +
          `*Gunakan perintah \`/stop\` jika ingin menghentikan patroli dan mengeluarkan bot dari voice channel.*`
        )
        .setFooter({ text: `${interaction.guild.name} • Sistem Keamanan Voice` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      console.error('Error saat menjalankan /patroli:', err);
      await interaction.editReply(`Gagal mengaktifkan mode patroli: ${err.message}`);
    }
  },
};
