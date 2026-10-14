const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { setTempVoiceConfig } = require('../tempVoiceHelper');
const { setGuildConfig } = require('../welcomeHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setupserver')
    .setDescription('Otomatis membuat paket kategori dan channel estetik lengkap (Text & Voice)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;

    try {
      // 1. Kategori INFORMASI
      const catInfo = await guild.channels.create({
        name: '📁 ━━━━━ INFORMASI ━━━━━',
        type: ChannelType.GuildCategory,
      });

      const chRules = await guild.channels.create({
        name: '📌・rules-and-info',
        type: ChannelType.GuildText,
        parent: catInfo.id,
      });

      const chAnnounce = await guild.channels.create({
        name: '📢・pengumuman',
        type: ChannelType.GuildText,
        parent: catInfo.id,
      });

      const chWelcome = await guild.channels.create({
        name: '👋・welcome',
        type: ChannelType.GuildText,
        parent: catInfo.id,
      });

      // Otomatis simpan channel welcome ke konfigurasi welcome
      setGuildConfig(guild.id, { welcomeChannel: chWelcome.id, leaveChannel: chWelcome.id });

      // 2. Kategori TEXT CHAT
      const catText = await guild.channels.create({
        name: '💬 ━━━━━ TEXT CHAT ━━━━━',
        type: ChannelType.GuildCategory,
      });

      await guild.channels.create({
        name: '💬・chat-santai',
        type: ChannelType.GuildText,
        parent: catText.id,
      });

      await guild.channels.create({
        name: '🎵・req-music',
        type: ChannelType.GuildText,
        parent: catText.id,
      });

      await guild.channels.create({
        name: '📸・share-foto',
        type: ChannelType.GuildText,
        parent: catText.id,
      });

      await guild.channels.create({
        name: '🤖・bot-command',
        type: ChannelType.GuildText,
        parent: catText.id,
      });

      // 3. Kategori VOICE LOUNGE
      const catVoice = await guild.channels.create({
        name: '🔊 ━━━━━ VOICE LOUNGE ━━━━━',
        type: ChannelType.GuildCategory,
      });

      // Trigger Join-to-Create
      const chHubVoice = await guild.channels.create({
        name: '➕・Buat Room',
        type: ChannelType.GuildVoice,
        parent: catVoice.id,
      });

      // Otomatis daftarkan channel trigger temp voice
      setTempVoiceConfig(guild.id, chHubVoice.id, catVoice.id);

      await guild.channels.create({
        name: '🔊・yapping-lounge',
        type: ChannelType.GuildVoice,
        parent: catVoice.id,
      });

      await guild.channels.create({
        name: '🔊・nonton-bareng',
        type: ChannelType.GuildVoice,
        parent: catVoice.id,
      });

      await guild.channels.create({
        name: '🔊・music-vibes',
        type: ChannelType.GuildVoice,
        parent: catVoice.id,
      });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✨ Setup Room Estetik Berhasil Selesai!')
        .setDescription(
          `Semua kategori dan channel estetik telah berhasil dibuat secara rapi:\n\n` +
          `**📁 INFORMASI:**\n` +
          `▸ <#${chRules.id}> (Rules & Tata Tertib)\n` +
          `▸ <#${chAnnounce.id}> (Pengumuman Resmi)\n` +
          `▸ <#${chWelcome.id}> *(Otomatis terhubung ke bot Welcome)*\n\n` +
          `**💬 TEXT CHAT:**\n` +
          `▸ \`#💬・chat-santai\` | \`#🎵・req-music\` | \`#📸・share-foto\` | \`#🤖・bot-command\`\n\n` +
          `**🔊 VOICE LOUNGE:**\n` +
          `▸ <#${chHubVoice.id}> *(Otomatis aktif: Klik untuk buat voice room pribadi!)*\n` +
          `▸ \`🔊・yapping-lounge\` | \`🔊・nonton-bareng\` | \`🔊・music-vibes\`\n\n` +
          `*Semua sistem otomatis (Welcome & Join-to-Create) sudah langsung terhubung!*`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat setup server:', error);
      await interaction.editReply({
        content: `❌ Gagal membuat setup channel: ${error.message}`,
      });
    }
  },
};
