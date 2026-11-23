const {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} = require('discord.js');
const { fetchSiputzxImage, DEFAULT_SHIP_BG } = require('../memeCanvasHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Generator Meme & Canvas Seru (Brat, Fake Tweet, Ship, Batslap, Kiss, Sertifikat, Efek Foto)')
    .addSubcommand((sub) =>
      sub
        .setName('brat')
        .setDescription('Buat gambar atau GIF animasi teks Brat viral')
        .addStringOption((opt) =>
          opt.setName('teks').setDescription('Teks yang ingin dijadikan Brat').setRequired(true).setMaxLength(150)
        )
        .addBooleanOption((opt) =>
          opt.setName('animasi').setDescription('Jadikan GIF animasi bergerak? (Default: False / Gambar PNG)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('tweet')
        .setDescription('Buat gambar Fake Tweet pakai profil & avatar user Discord')
        .addStringOption((opt) =>
          opt.setName('komentar').setDescription('Isi teks tweet palsu').setRequired(true).setMaxLength(280)
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('User yang ingin dijadikan pembuat tweet (Default: kamu)').setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('tema')
            .setDescription('Tema tampilan Tweet')
            .setRequired(false)
            .addChoices(
              { name: 'Gelap (Dark)', value: 'dark' },
              { name: 'Terang (Light)', value: 'light' }
            )
        )
        .addBooleanOption((opt) =>
          opt.setName('verified').setDescription('Tampilkan centang biru Verified? (Default: True)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('ship')
        .setDescription('Cek kecocokan & buat kartu Ship antara 2 member Discord')
        .addUserOption((opt) =>
          opt.setName('user1').setDescription('Member pertama').setRequired(true)
        )
        .addUserOption((opt) =>
          opt.setName('user2').setDescription('Member kedua (Kosongkan untuk ship dengan dirimu sendiri)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('sertifikat')
        .setDescription('Buat gambar Sertifikat Tolol kocak untuk teman')
        .addStringOption((opt) =>
          opt.setName('nama').setDescription('Nama yang tertera di sertifikat').setRequired(true).setMaxLength(50)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('batslap')
        .setDescription('Meme Batman Tampar pakai avatar kamu & target')
        .addUserOption((opt) =>
          opt.setName('target').setDescription('Member yang ingin ditampar (candaan)').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('kiss')
        .setDescription('Meme Kiss pakai avatar kamu & target')
        .addUserOption((opt) =>
          opt.setName('target').setDescription('Member yang ingin di-kiss').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('gay')
        .setDescription('Meme Rainbow Meter kocak pakai avatar user')
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Target user (Default: dirimu sendiri)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('spotify')
        .setDescription('Buat kartu Spotify Now Playing estetik')
        .addStringOption((opt) =>
          opt.setName('judul').setDescription('Judul lagu').setRequired(true).setMaxLength(80)
        )
        .addStringOption((opt) =>
          opt.setName('artis').setDescription('Nama artis / penyanyi').setRequired(true).setMaxLength(60)
        )
        .addStringOption((opt) =>
          opt.setName('album').setDescription('Nama album (Opsional)').setRequired(false).setMaxLength(60)
        )
        .addAttachmentOption((opt) =>
          opt.setName('cover').setDescription('Cover lagu (Kosongkan untuk pakai avatarmu)').setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('efek')
        .setDescription('Terapkan efek Canvas/Meme keren ke avatar user atau foto')
        .addStringOption((opt) =>
          opt
            .setName('jenis')
            .setDescription('Pilih jenis efek meme/canvas')
            .setRequired(true)
            .addChoices(
              { name: '🤦 Facepalm', value: 'facepalm' },
              { name: '✨ Oh This Is Beautiful', value: 'beautiful' },
              { name: '🗑️ Delete File Meme', value: 'delete' },
              { name: '👶 No It Doesnt Affect My Baby', value: 'affect' },
              { name: '🌫️ Blur', value: 'blur' },
              { name: '🖤 Hitam Putih (Greyscale)', value: 'greyscale' },
              { name: '🔄 Negatif (Invert)', value: 'invert' },
              { name: '⭕ Lingkaran (Circle)', value: 'circle' }
            )
        )
        .addUserOption((opt) =>
          opt.setName('user').setDescription('Ambil avatar dari user (Default: dirimu sendiri)').setRequired(false)
        )
        .addAttachmentOption((opt) =>
          opt.setName('gambar').setDescription('Atau upload file foto langsung').setRequired(false)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    try {
      let result = null;
      let title = 'FlyBot Meme & Canvas';
      let description = '';
      let color = 0x5865F2;

      if (sub === 'brat') {
        const text = interaction.options.getString('teks');
        const isAnimated = interaction.options.getBoolean('animasi') || false;
        result = await fetchSiputzxImage('/api/m/brat', {
          text,
          isAnimated: isAnimated ? 'true' : 'false',
        }, isAnimated ? 'gif' : 'png');
        title = isAnimated ? 'Brat Animated Generator' : 'Brat Image Generator';
        description = `> *"${text}"*`;
        color = 0x8ACE00;
      } else if (sub === 'tweet') {
        const comment = interaction.options.getString('komentar');
        const target = interaction.options.getUser('user') || interaction.user;
        const theme = interaction.options.getString('tema') || 'dark';
        const verified = interaction.options.getBoolean('verified') ?? true;
        const avatar = target.displayAvatarURL({ extension: 'png', size: 256 });

        result = await fetchSiputzxImage('/api/canvas/tweet', {
          displayName: target.globalName || target.username,
          username: target.username,
          comment,
          avatar,
          verified: verified ? 'true' : 'false',
          theme,
        });
        title = `Fake Tweet • @${target.username}`;
        color = 0x1DA1F2;
      } else if (sub === 'ship') {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2') || interaction.user;
        // Hitung persentase deterministik + seru berdasarkan ID pasangan
        const combined = [user1.id, user2.id].sort().join('');
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
          hash = (hash * 31 + combined.charCodeAt(i)) % 101;
        }
        const persen = Math.max(1, Math.min(100, hash));

        result = await fetchSiputzxImage('/api/canvas/ship', {
          avatar1: user1.displayAvatarURL({ extension: 'png', size: 256 }),
          avatar2: user2.displayAvatarURL({ extension: 'png', size: 256 }),
          background: DEFAULT_SHIP_BG,
          persen,
        });

        let komentar = 'Masih butuh pendekatan lebih nih! 😅';
        if (persen >= 85) komentar = 'Jodoh sejati! Langsung halalin bray! 💍🔥';
        else if (persen >= 65) komentar = 'Cocok banget, tinggal nunggu kode keras! 💕';
        else if (persen >= 40) komentar = 'Lumayan cocok, coba sering mabar bareng! 😉';

        title = `💘 Ship Meter: ${persen}%`;
        description = `<@${user1.id}> ❤️ <@${user2.id}>\n> ${komentar}`;
        color = 0xFF69B4;
      } else if (sub === 'sertifikat') {
        const nama = interaction.options.getString('nama');
        result = await fetchSiputzxImage('/api/canvas/sertifikat-tolol', { text: nama }, 'jpg');
        title = `📜 Sertifikat Resmi untuk ${nama}`;
        color = 0xFEE75C;
      } else if (sub === 'batslap') {
        const target = interaction.options.getUser('target');
        result = await fetchSiputzxImage('/api/canvas/batslap', {
          image1: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
          image2: target.displayAvatarURL({ extension: 'png', size: 256 }),
        });
        title = `💥 ${interaction.user.username} menampar ${target.username}!`;
        color = 0xED4245;
      } else if (sub === 'kiss') {
        const target = interaction.options.getUser('target');
        result = await fetchSiputzxImage('/api/canvas/kiss', {
          image1: interaction.user.displayAvatarURL({ extension: 'png', size: 256 }),
          image2: target.displayAvatarURL({ extension: 'png', size: 256 }),
        });
        title = `💋 ${interaction.user.username} ❤️ ${target.username}`;
        color = 0xEB459E;
      } else if (sub === 'gay') {
        const target = interaction.options.getUser('user') || interaction.user;
        const num = Math.floor(Math.random() * 100) + 1;
        result = await fetchSiputzxImage('/api/canvas/gay', {
          nama: target.globalName || target.username,
          avatar: target.displayAvatarURL({ extension: 'png', size: 256 }),
          num,
        });
        title = `🌈 Rainbow Meter • ${target.username} (${num}%)`;
        color = 0x9B59B6;
      } else if (sub === 'spotify') {
        const judul = interaction.options.getString('judul');
        const artis = interaction.options.getString('artis');
        const album = interaction.options.getString('album') || judul;
        const coverAtt = interaction.options.getAttachment('cover');
        const image = coverAtt?.url || interaction.user.displayAvatarURL({ extension: 'png', size: 512 });

        result = await fetchSiputzxImage('/api/canvas/spotify', {
          title: judul,
          artist: artis,
          album,
          start: 45000,
          end: 215000,
          image,
        });
        title = `🎵 Spotify Card • ${judul}`;
        description = `**${artis}** — *${album}*`;
        color = 0x1DB954;
      } else if (sub === 'efek') {
        const jenis = interaction.options.getString('jenis');
        const target = interaction.options.getUser('user') || interaction.user;
        const att = interaction.options.getAttachment('gambar');
        const image = att?.url || target.displayAvatarURL({ extension: 'png', size: 512 });

        result = await fetchSiputzxImage(`/api/canvas/${jenis}`, { image });
        title = `🎨 Canvas Efek: ${jenis.toUpperCase()}`;
        description = att ? 'Efek diterapkan pada gambar yang di-upload.' : `Efek diterapkan pada avatar <@${target.id}>.`;
      }

      if (!result || !result.buffer) {
        return interaction.editReply({ content: 'Gagal membuat gambar meme/canvas. Silakan coba lagi.' });
      }

      const file = new AttachmentBuilder(result.buffer, { name: result.fileName });
      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(title)
        .setImage(`attachment://${result.fileName}`)
        .setFooter({ text: `FlyBot Meme & Canvas • ${result.size} • Diminta oleh ${interaction.user.username}` })
        .setTimestamp();

      if (description) embed.setDescription(description);

      return interaction.editReply({ embeds: [embed], files: [file] });
    } catch (err) {
      console.error(`[MEME /${sub} ERROR]:`, err.message);
      return interaction.editReply({
        content: `Gagal memproses \`/meme ${sub}\`: ${err.message}`,
      });
    }
  },
};
