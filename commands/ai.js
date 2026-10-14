const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { askAI } = require('../aiHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Tanya apapun ke FlyBot AI yang ditenagai ChatGPT (OpenAI GPT-4o-mini)')
    .addStringOption((option) =>
      option
        .setName('prompt')
        .setDescription('Pertanyaan atau instruksi yang ingin kamu tanyakan ke AI')
        .setRequired(true)
    )
    .addBooleanOption((option) =>
      option
        .setName('private')
        .setDescription('Tampilkan jawaban hanya untukmu (privat) atau publik di channel? (Default: privat)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');
    const isPrivate = interaction.options.getBoolean('private') ?? true;

    // Defer reply agar tidak timeout
    await interaction.deferReply({
      flags: isPrivate ? MessageFlags.Ephemeral : undefined,
    });

    const result = await askAI(interaction.user.id, prompt);

    if (!result.success) {
      const errorEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('❌ Gagal Memproses AI')
        .setDescription(`Maaf, terjadi masalah saat memproses pertanyaanmu:\n\`\`\`\n${result.error}\n\`\`\``)
        .setFooter({ text: 'Pastikan OPENAI_API_KEY valid di konfigurasi bot.' });

      return interaction.editReply({ embeds: [errorEmbed] });
    }

    // Buat embed jawaban
    const displayPrompt = prompt.length > 250 ? prompt.substring(0, 247) + '...' : prompt;

    // Discord embed description maks 4096 karakter
    let replyText = result.reply;
    if (replyText.length > 3900) {
      replyText = replyText.substring(0, 3900) + '\n\n*(Jawaban dipotong karena melebihi batas karakter Discord)*';
    }

    const embed = new EmbedBuilder()
      .setColor(0x2B2D31)
      .setTitle('Fly AI Assistant')
      .setDescription(replyText)
      .addFields({
        name: 'Pertanyaan:',
        value: `>>> ${displayPrompt}`,
      })
      .setFooter({
        text: `Fly AI • Mode: ${isPrivate ? 'Privat' : 'Publik'}`,
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_ai_ask')
        .setLabel('Tanya Lagi')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_ai_clear')
        .setLabel('Reset Sesi Chat')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_back_to_main')
        .setLabel('Menu Utama')
        .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
