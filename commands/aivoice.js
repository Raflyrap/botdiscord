const {
  SlashCommandBuilder,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const {
  startVoiceAiSession,
  stopVoiceAiSession,
  getVoiceAiSession,
} = require('../voiceAiHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('aivoice')
    .setDescription('Fitur ngobrol langsung dengan Fly AI lewat mic di Voice Channel (bebas emoji)')
    .addSubcommand((sub) =>
      sub
        .setName('join')
        .setDescription('Panggil Fly AI untuk bergabung ke voice channel dan ngobrol langsung via mic')
        .addStringOption((opt) =>
          opt
            .setName('suara')
            .setDescription('Pilih karakter suara AI (Default: Alloy)')
            .setRequired(false)
            .addChoices(
              { name: 'Alloy (Netral - Sangat Natural & Luwes)', value: 'alloy' },
              { name: 'Coral (Cewek - Ceria & Ekspresif)', value: 'coral' },
              { name: 'Shimmer (Cewek - Santai & Lembut)', value: 'shimmer' },
              { name: 'Ash (Cowok - Santai & Gaul)', value: 'ash' },
              { name: 'Echo (Cowok - Hangat & Ramah)', value: 'echo' },
              { name: 'Sage (Halus & Bersahabat)', value: 'sage' }
            )
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('stop')
        .setDescription('Hentikan obrolan Voice AI dan keluarkan bot dari voice channel')
    )
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Lihat status sesi Voice AI saat ini')
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (!interaction.guild) {
      return interaction.reply({
        content: '[ERROR] Perintah ini hanya dapat dijalankan di dalam server.',
        flags: MessageFlags.Ephemeral,
      });
    }

    const guildId = interaction.guild.id;

    // ================= SUBCOMMAND: STOP ================= //
    if (subcommand === 'stop') {
      const session = getVoiceAiSession(guildId);
      if (!session) {
        return interaction.reply({
          content: '[INFO] Tidak ada sesi Voice AI yang sedang aktif di server ini.',
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply();
      await stopVoiceAiSession(guildId);

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setAuthor({
          name: 'FlyBot  •  Voice AI Assistant',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle('Sesi Voice AI Selesai')
        .setDescription(
          `Fly AI telah berhenti mendengarkan dan keluar dari voice channel.\n` +
          `Total pertanyaan terjawab: **${session.stats.questionsAnswered}** pertanyaan.\n\n` +
          `Gunakan \`/aivoice join\` jika ingin ngobrol lagi.`
        )
        .setFooter({ text: `Dihentikan oleh ${interaction.user.username}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    }

    // ================= SUBCOMMAND: STATUS ================= //
    if (subcommand === 'status') {
      const session = getVoiceAiSession(guildId);
      if (!session) {
        return interaction.reply({
          content: '[INFO] Status: Voice AI saat ini **TIDAK AKTIF** di server ini. Ketik `/aivoice join` untuk memulai.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const uptimeSec = Math.floor((Date.now() - session.stats.startTime) / 1000);
      const minutes = Math.floor(uptimeSec / 60);
      const seconds = uptimeSec % 60;

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setAuthor({
          name: 'FlyBot  •  Status Voice AI',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle('Voice AI Sedang Aktif')
        .addFields(
          { name: 'Voice Channel', value: `<#${session.channelId}>`, inline: true },
          { name: 'Karakter Suara', value: session.voiceType.toUpperCase(), inline: true },
          { name: 'Pertanyaan Terjawab', value: `${session.stats.questionsAnswered}`, inline: true },
          { name: 'Durasi Aktif', value: `${minutes}m ${seconds}s`, inline: true },
          { name: 'Status Mic', value: session.isSpeaking ? 'Sedang Berbicara' : 'Mendengarkan Mic', inline: true }
        )
        .setFooter({ text: 'Gunakan /aivoice stop untuk mematikan' })
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    // ================= SUBCOMMAND: JOIN ================= //
    if (subcommand === 'join') {
      let member = interaction.member;
      if (!member?.voice) {
        member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
      }

      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel) {
        return interaction.reply({
          content: '[PERINGATAN] Kamu harus bergabung ke voice channel terlebih dahulu untuk menggunakan fitur ini!',
          flags: MessageFlags.Ephemeral,
        });
      }

      // Periksa apakah bot memiliki izin Connect dan Speak
      const permissions = voiceChannel.permissionsFor(interaction.client.user);
      if (!permissions.has('Connect') || !permissions.has('Speak')) {
        return interaction.reply({
          content: '[ERROR] Bot tidak memiliki izin CONNECT atau SPEAK di voice channel tersebut.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const voiceType = interaction.options.getString('suara') || 'alloy';

      // Cek jika bot sudah ada di voice channel ini, alihkan fokus pendengar ke pengguna yang memanggil
      const existingSession = getVoiceAiSession(guildId);
      if (existingSession && existingSession.channelId === voiceChannel.id) {
        existingSession.callerUserId = interaction.user.id;
        const embed = new EmbedBuilder()
          .setColor(0x57F287)
          .setAuthor({
            name: 'FlyBot  •  Voice AI Assistant',
            iconURL: interaction.client.user.displayAvatarURL(),
          })
          .setTitle('Fokus Obrolan Voice AI Dialihkan')
          .setDescription(
            `Fly AI sekarang **fokus mendengarkan <@${interaction.user.id}>**!\n\n` +
            `• Suara dari orang lain di voice channel otomatis di-mute pada sisi bot agar tidak bocor atau mengganggu.\n` +
            `• Langsung bicara lewat mic kamu, AI akan merespons khusus untukmu.\n` +
            `• Jika teman lain ingin gantian ngobrol, cukup ketik \`/aivoice join\` lagi.`
          )
          .setFooter({ text: `Fokus diubah oleh ${interaction.user.username}  •  Bebas emoji` })
          .setTimestamp();

        return interaction.reply({ embeds: [embed] });
      }

      await interaction.deferReply();

      try {
        await startVoiceAiSession(voiceChannel, interaction.channel, voiceType, {
          callerUserId: interaction.user.id,
        });

        const embed = new EmbedBuilder()
          .setColor(0x5865F2)
          .setAuthor({
            name: 'FlyBot  •  Voice AI Assistant',
            iconURL: interaction.client.user.displayAvatarURL(),
          })
          .setTitle('Voice AI Realtime Aktif')
          .setDescription(
            `Fly AI telah bergabung ke **<#${voiceChannel.id}>** menggunakan teknologi **Speech-to-Speech Realtime Streaming**!\n\n` +
            `Panduan Singkat:\n` +
            `• **Fokus Suara Aktif**: AI hanya mendengarkan suara dari <@${interaction.user.id}> (pemanggil perintah) agar obrolan fokus dan suara orang lain tidak bocor/ngaco.\n` +
            `• Jika teman lain di room ingin gantian ngobrol, cukup ketik \`/aivoice join\` untuk mengalihkan fokus AI.\n` +
            `• Langsung bicara santai di mic kamu seperti sedang menelepon teman.\n` +
            `• Suara AI akan langsung menjawab secara ekspresif, luwes, dan tanpa jeda.\n` +
            `• Ketik \`/aivoice stop\` atau klik tombol di bawah untuk mengakhiri obrolan.`
          )
          .addFields(
            { name: 'Voice Channel', value: `<#${voiceChannel.id}>`, inline: true },
            { name: 'Fokus Penanya', value: `<@${interaction.user.id}>`, inline: true },
            { name: 'Karakter Suara', value: voiceType.toUpperCase(), inline: true }
          )
          .setFooter({ text: `Dimulai oleh ${interaction.user.username}  •  Bebas emoji` })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_aivoice_stop')
            .setLabel('Hentikan Obrolan Voice AI')
            .setStyle(ButtonStyle.Danger)
        );

        return interaction.editReply({ embeds: [embed], components: [row] });
      } catch (err) {
        console.error('[AIVOICE JOIN ERROR]', err);
        return interaction.editReply({
          content: `[GAGAL] Tidak dapat memulai sesi Voice AI: ${err.message}`,
        });
      }
    }
  },
};
