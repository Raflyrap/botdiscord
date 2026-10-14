const {
  SlashCommandBuilder,
  ChannelType,
  PermissionFlagsBits,
  MessageFlags,
  EmbedBuilder,
} = require('discord.js');
const { setTempVoiceConfig } = require('../tempVoiceHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setuptempvoice')
    .setDescription('Membuat sistem Voice Room otomatis (Join-to-Create)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guild = interaction.guild;

    try {
      // 1. Buat kategori voice jika belum ada
      const category = await guild.channels.create({
        name: '🔊 ━━━━ AUTO VOICE ROOM ━━━━',
        type: ChannelType.GuildCategory,
      });

      // 2. Buat channel pemicu (Hub)
      const hubChannel = await guild.channels.create({
        name: '➕・Buat Room',
        type: ChannelType.GuildVoice,
        parent: category.id,
      });

      // 3. Simpan konfigurasi
      setTempVoiceConfig(guild.id, hubChannel.id, category.id);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Sistem Join-to-Create Berhasil Dipasang!')
        .setDescription(
          `Kategori dan channel trigger voice room telah berhasil dibuat:\n\n` +
          `📁 Kategori: **${category.name}**\n` +
          `🔊 Channel Trigger: <#${hubChannel.id}>\n\n` +
          `**Cara Kerja:**\n` +
          `1. Member klik dan masuk ke channel <#${hubChannel.id}>.\n` +
          `2. Bot otomatis membuatkan voice channel baru (contoh: *🔊・Ruang Member*).\n` +
          `3. Member langsung dipindahkan ke room tersebut secara otomatis.\n` +
          `4. Jika semua orang sudah keluar, room akan otomatis **dihapus bersih**!`
        )
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Error saat setup temp voice:', error);
      await interaction.editReply({
        content: `❌ Gagal membuat sistem temp voice: ${error.message}`,
      });
    }
  },
};
