const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { DEFAULT_PATROLI_SONG, setPatroliActive } = require('../patroliHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('patroli')
    .setDescription('Menjaga voice channel 24 jam nonstop sambil memutar lagu patroli secara looping')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('Pilih voice channel yang ingin dijaga (opsional, default: voice channel tempat kamu berada)')
        .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: 'Perintah ini hanya dapat dijalankan di dalam server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    let targetVoice = interaction.options.getChannel('channel');

    // Jika channel tidak dipilih, gunakan voice channel tempat user berada saat ini
    if (!targetVoice) {
      const member = interaction.member?.voice
        ? interaction.member
        : await interaction.guild.members.fetch(interaction.user.id).catch(() => null);

      targetVoice = member?.voice?.channel;
    }

    if (!targetVoice) {
      return interaction.reply({
        content: 'Kamu harus masuk ke voice channel terlebih dahulu atau pilih channel di opsi perintah `/patroli`.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Periksa izin bot
    const botPerms = targetVoice.permissionsFor(interaction.client.user);
    if (botPerms && !botPerms.has(PermissionsBitField.Flags.Connect)) {
      return interaction.reply({
        content: `Bot tidak memiliki izin untuk bergabung ke voice channel **${targetVoice.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }
    if (botPerms && !botPerms.has(PermissionsBitField.Flags.Speak)) {
      return interaction.reply({
        content: `Bot tidak memiliki izin bersuara di voice channel **${targetVoice.name}**.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      // Simpan konfigurasi patroli aktif
      setPatroliActive(interaction.guildId, targetVoice.id, interaction.channelId, DEFAULT_PATROLI_SONG);

      // Mainkan lagu patroli dengan DisTube
      await interaction.client.distube.play(targetVoice, DEFAULT_PATROLI_SONG, {
        textChannel: interaction.channel,
        member: interaction.member,
      });

      // Atur looping ke mode repeat single song (1 = Repeat Song)
      const queue = interaction.client.distube.getQueue(interaction.guildId);
      if (queue) {
        queue.setRepeatMode(1);
      }

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Patroli Voice 24 Jam Aktif')
        .setDescription(
          `Bot telah masuk ke saluran <#${targetVoice.id}> untuk berjaga 24 jam nonstop.\n\n` +
          `• **Status:** Berjaga Nonstop (24/7)\n` +
          `• **Mode Pemutaran:** Loop 1 Lagu Berulang Kali\n` +
          `• **Lagu:** [Klik di sini untuk melihat lagu](${DEFAULT_PATROLI_SONG})\n\n` +
          `*Gunakan perintah \`/stop\` jika ingin menghentikan patroli dan mengeluarkan bot dari voice.*`
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
