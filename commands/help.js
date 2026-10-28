const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ComponentType,
} = require('discord.js');
const { getOfficialWebsiteUrl, getOfficialInviteUrl } = require('../ownerHelper');

// Metadata dan pengelompokan lengkap 54 perintah FlyBot ke dalam 7 kategori
const CATEGORIES = {
  overview: {
    label: 'Ringkasan Kategori',
    name: 'Pusat Panduan & Perintah FlyBot',
    description: 'Pilih kategori di bawah untuk melihat rincian perintah yang tersedia.',
  },
  music: {
    label: 'Musik HD Lavalink',
    name: 'Musik HD Lavalink',
    description: 'Pemutaran audio berkualitas tinggi dari Spotify, YouTube, dan SoundCloud dengan latensi minimal.',
    commands: ['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'shuffle', 'repeat', 'volume'],
  },
  voice_ai: {
    label: 'Voice AI, Patroli & Room',
    name: 'Voice AI, Patroli & Room',
    description: 'Percakapan suara realtime via mikrofon, bot standby 24 jam di voice channel, dan sistem voice hub mandiri.',
    commands: ['aivoice', 'ai', 'patroli', 'voice'],
  },
  economy: {
    label: 'Leveling, Ranking & Ekonomi',
    name: 'Leveling, Ranking & Ekonomi',
    description: 'Sistem perolehan XP chat/voice, kartu profil visual canvas, papan peringkat top global, dan transfer koin.',
    commands: ['profile', 'daily', 'leaderboard', 'pay', 'setlevel', 'leveltest'],
  },
  games: {
    label: 'Mini Games Interaktif',
    name: 'Mini Games Interaktif',
    description: 'Setup arena mini games seru di server berhadiah koin & XP (Tebak Koin, Tebak Angka 1-100, dan Suit Jepang).',
    commands: ['game'],
  },
  utility: {
    label: 'Utilitas & Gambar HD',
    name: 'Utilitas & Gambar HD',
    description: 'Peningkat resolusi gambar instan (AI Upscale 2x/4x), status AFK otomatis, alarm reminder, dan informasi akun.',
    commands: ['hd', 'afk', 'remind', 'stalk', 'userinfo', 'serverinfo', 'ping', 'invite'],
  },
  admin: {
    label: 'Server Setup & Moderasi',
    name: 'Server Setup & Moderasi',
    description: 'All-in-One server setup template, verifikasi member, panel tiket bantuan, statistik channel, audit log, dan perapian channel.',
    commands: [
      'menu', 'setup', 'delete', 'sethd', 'setwelcome', 'welcometest', 'setverif',
      'verif', 'autorole', 'ticket', 'setticket', 'stats', 'log', 'antitoxic',
      'buatembed', 'embedpreset', 'buatchannel', 'buatkategori', 'editkategori',
      'editnama', 'hapuschannel', 'geserchannel', 'rapihkan', 'role',
    ],
  },
  owner: {
    label: 'Khusus Owner & Pemantauan',
    name: 'Khusus Owner Bot',
    description: 'Panel pemantauan performa internal, server list, uptime, dan statistik operasional FlyBot.',
    commands: ['owner'],
  },
  all: {
    label: 'Tampilkan Semua Perintah',
    name: 'Daftar Lengkap 54 Perintah FlyBot',
    description: 'Ringkasan seluruh slash command FlyBot yang terdaftar di server ini.',
  },
};

/**
 * Membuat Embed Ringkasan / Overview
 */
function createOverviewEmbed(guild, user, client) {
  const totalCommands = client.commands.size;

  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: 'FlyBot • Panduan Bantuan Perintah',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle('Pusat Panduan & Daftar Perintah FlyBot')
    .setDescription(
      `Selamat datang di sistem bantuan **FlyBot**! Tersedia total **${totalCommands} perintah slash** yang terbagi dalam berbagai kategori.\n\n` +
      `**Tips Praktis:**\n` +
      `• Gunakan dropdown menu di bawah untuk menelusuri perintah per kategori.\n` +
      `• Ketik **\`/help perintah:<nama>\`** untuk melihat panduan detail suatu perintah.\n` +
      `• Kamu juga dapat mengetik **\`/menu\`** untuk membuka dashboard kontrol interaktif dengan tombol 1-klik tanpa perlu mengetik manual!`
    )
    .addFields(
      {
        name: 'Musik HD Lavalink (9 Perintah)',
        value: '`/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/shuffle`, `/repeat`, `/volume`',
        inline: false,
      },
      {
        name: 'Voice AI, Patroli & Room (4 Perintah)',
        value: '`/aivoice`, `/ai`, `/patroli`, `/voice`',
        inline: false,
      },
      {
        name: 'Leveling & Ekonomi (6 Perintah)',
        value: '`/profile`, `/daily`, `/leaderboard`, `/pay`, `/setlevel`, `/leveltest`',
        inline: false,
      },
      {
        name: 'Mini Games Interaktif (1 Perintah)',
        value: '`/game` *(Tebak Koin, Tebak Angka 1-100, Suit Jepang)*',
        inline: false,
      },
      {
        name: 'Utilitas & Gambar HD (8 Perintah)',
        value: '`/hd`, `/afk`, `/remind`, `/stalk`, `/userinfo`, `/serverinfo`, `/ping`, `/invite`',
        inline: false,
      },
      {
        name: 'Server Setup & Moderasi (24 Perintah)',
        value: '`/menu`, `/setup`, `/delete`, `/sethd`, `/setwelcome`, `/setverif`, `/verif`, `/ticket`, `/stats`, `/log`, `/antitoxic`, `/role`, dll.',
        inline: false,
      },
      {
        name: 'Khusus Owner (1 Perintah)',
        value: '`/owner` *(Monitoring, Uptime & Server List)*',
        inline: false,
      }
    )
    .setFooter({
      text: `Diminta oleh ${user.tag} • Pilih menu di bawah untuk info detail`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();
}

/**
 * Membuat Embed untuk Kategori Tertentu
 */
function createCategoryEmbed(categoryKey, guild, user, client) {
  const cat = CATEGORIES[categoryKey];
  if (!cat) return createOverviewEmbed(guild, user, client);

  if (categoryKey === 'overview') {
    return createOverviewEmbed(guild, user, client);
  }

  // Tampilan semua perintah dalam ringkasan rapi
  if (categoryKey === 'all') {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setAuthor({
        name: 'FlyBot • Daftar Lengkap Perintah',
        iconURL: client.user.displayAvatarURL(),
      })
      .setTitle('Daftar Lengkap 54 Perintah FlyBot')
      .setDescription(
        'Berikut daftar lengkap seluruh perintah yang terdaftar di FlyBot. Gunakan dropdown di bawah untuk melihat rincian masing-masing kategori:'
      )
      .setFooter({
        text: `Diminta oleh ${user.tag}`,
        iconURL: user.displayAvatarURL(),
      })
      .setTimestamp();

    const order = ['music', 'voice_ai', 'economy', 'games', 'utility', 'admin', 'owner'];
    for (const key of order) {
      const c = CATEGORIES[key];
      const cmdList = c.commands.map((cmd) => `\`/${cmd}\``).join(', ');
      embed.addFields({
        name: `${c.name} (${c.commands.length})`,
        value: cmdList || 'Tidak ada',
        inline: false,
      });
    }

    return embed;
  }

  // Tampilan kategori spesifik dengan deskripsi masing-masing perintah
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: `Kategori: ${cat.name}`,
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(`${cat.name} (${cat.commands.length} Perintah)`)
    .setDescription(`${cat.description}\n\n**Daftar Perintah:**`)
    .setFooter({
      text: `Diminta oleh ${user.tag} • Ketik /help perintah:<nama> untuk panduan spesifik`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();

  // Susun baris perintah
  const commandLines = [];
  for (const cmdName of cat.commands) {
    const cmd = client.commands.get(cmdName);
    const desc = cmd?.data?.description || 'Tidak ada deskripsi.';
    commandLines.push(`• **\`/${cmdName}\`**\n  ${desc}`);
  }

  // Jika terlalu banyak untuk 1 field (misal Admin 24 perintah), bagi menjadi beberapa field
  if (commandLines.length > 8) {
    const chunkSize = 8;
    for (let i = 0; i < commandLines.length; i += chunkSize) {
      const chunk = commandLines.slice(i, i + chunkSize);
      const partNumber = Math.floor(i / chunkSize) + 1;
      const totalParts = Math.ceil(commandLines.length / chunkSize);
      embed.addFields({
        name: `Daftar Perintah (Bagian ${partNumber}/${totalParts})`,
        value: chunk.join('\n\n'),
        inline: false,
      });
    }
  } else {
    embed.addFields({
      name: 'Daftar Perintah',
      value: commandLines.join('\n\n'),
      inline: false,
    });
  }

  return embed;
}

/**
 * Membuat Embed Detail untuk Perintah Tertentu
 */
function createCommandDetailEmbed(commandName, guild, user, client) {
  const cleanName = commandName.toLowerCase().replace(/^\//, '').trim();
  const cmd = client.commands.get(cleanName);

  if (!cmd) {
    return new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Perintah Tidak Ditemukan')
      .setDescription(
        `Perintah **\`/${cleanName}\`** tidak ditemukan di sistem FlyBot.\n\n` +
        `Ketik **\`/help\`** untuk melihat daftar lengkap seluruh perintah yang tersedia.`
      )
      .setFooter({ text: `Diminta oleh ${user.tag}`, iconURL: user.displayAvatarURL() });
  }

  const data = cmd.data;
  const desc = data.description || 'Tidak ada deskripsi.';

  // Temukan kategori perintah ini
  let foundCategory = 'Lainnya';
  for (const [key, cat] of Object.entries(CATEGORIES)) {
    if (cat.commands && cat.commands.includes(cleanName)) {
      foundCategory = cat.name;
      break;
    }
  }

  // Parsing parameter / opsi
  const options = data.options || [];
  let syntax = `/${cleanName}`;
  const optionsDesc = [];

  for (const opt of options) {
    // Cek apakah subcommand
    if (opt.type === 1 || opt.toJSON?.()?.type === 1) {
      const subDesc = opt.description || 'Sub-perintah';
      optionsDesc.push(`• **Subcommand: \`${opt.name}\`** — ${subDesc}`);
    } else {
      const optJson = opt.toJSON ? opt.toJSON() : opt;
      const isReq = optJson.required;
      syntax += isReq ? ` <${optJson.name}>` : ` [${optJson.name}]`;
      const reqLabel = isReq ? '*(Wajib)*' : '*(Opsional)*';
      optionsDesc.push(`• **\`${optJson.name}\`** ${reqLabel}: ${optJson.description || 'Tidak ada keterangan'}`);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setAuthor({
      name: 'FlyBot • Detail Panduan Perintah',
      iconURL: client.user.displayAvatarURL(),
    })
    .setTitle(`Panduan Perintah: /${cleanName}`)
    .setDescription(desc)
    .addFields(
      {
        name: 'Format Penggunaan',
        value: `\`\`\`bash\n${syntax}\n\`\`\``,
        inline: false,
      },
      {
        name: 'Kategori',
        value: foundCategory,
        inline: true,
      }
    );

  if (optionsDesc.length > 0) {
    embed.addFields({
      name: 'Parameter & Opsi',
      value: optionsDesc.join('\n'),
      inline: false,
    });
  }

  embed
    .setFooter({
      text: `Diminta oleh ${user.tag} • Gunakan format di atas di chat`,
      iconURL: user.displayAvatarURL(),
    })
    .setTimestamp();

  return embed;
}

/**
 * Membuat Komponen Interaktif (Dropdown Select Menu)
 */
function createActionComponents(currentCategory = 'overview') {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_category_select')
    .setPlaceholder('Pilih kategori perintah untuk dijelajahi...')
    .addOptions(
      {
        label: CATEGORIES.overview.label,
        value: 'overview',
        description: 'Kembali ke ringkasan utama semua kategori',
        default: currentCategory === 'overview',
      },
      {
        label: CATEGORIES.music.label,
        value: 'music',
        description: 'Play, pause, skip, queue, repeat, volume, shuffle, stop',
        default: currentCategory === 'music',
      },
      {
        label: CATEGORIES.voice_ai.label,
        value: 'voice_ai',
        description: 'Ngobrol suara realtime via mic, patroli 24 jam & voice hub',
        default: currentCategory === 'voice_ai',
      },
      {
        label: CATEGORIES.economy.label,
        value: 'economy',
        description: 'Profil visual, daily reward, leaderboard XP/koin & transfer',
        default: currentCategory === 'economy',
      },
      {
        label: CATEGORIES.games.label,
        value: 'games',
        description: 'Setup arena mini games interaktif (Tebak Koin, Angka, Suit)',
        default: currentCategory === 'games',
      },
      {
        label: CATEGORIES.utility.label,
        value: 'utility',
        description: 'AI Upgrade Resolusi HD, AFK, reminder alarm, stalk & userinfo',
        default: currentCategory === 'utility',
      },
      {
        label: CATEGORIES.admin.label,
        value: 'admin',
        description: 'Setup server template, verif, tiket, log, filter toxic, role',
        default: currentCategory === 'admin',
      },
      {
        label: CATEGORIES.owner.label,
        value: 'owner',
        description: 'Panel monitoring performa internal dan statistik developer',
        default: currentCategory === 'owner',
      },
      {
        label: CATEGORIES.all.label,
        value: 'all',
        description: 'Lihat daftar nama seluruh 54 perintah sekaligus',
        default: currentCategory === 'all',
      }
    );

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);
  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Website Resmi (flyneuroai.com)')
      .setStyle(ButtonStyle.Link)
      .setURL(getOfficialWebsiteUrl()),
    new ButtonBuilder()
      .setLabel('Server Komunitas Discord')
      .setStyle(ButtonStyle.Link)
      .setURL(getOfficialInviteUrl())
  );

  return [selectRow, buttonRow];
}

module.exports = {
  // Definisi metadata Slash Command
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Menampilkan pusat panduan, rincian fitur, dan seluruh perintah FlyBot')
    .addStringOption((option) =>
      option
        .setName('perintah')
        .setDescription('Cari informasi dan sintaks detail perintah tertentu (contoh: play, setup, hd)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName('kategori')
        .setDescription('Pilih kategori perintah yang ingin langsung dibuka')
        .setRequired(false)
        .addChoices(
          { name: 'Ringkasan Kategori', value: 'overview' },
          { name: 'Musik HD Lavalink', value: 'music' },
          { name: 'Voice AI, Patroli & Room', value: 'voice_ai' },
          { name: 'Leveling, Ranking & Ekonomi', value: 'economy' },
          { name: 'Mini Games Interaktif', value: 'games' },
          { name: 'Utilitas & Gambar HD', value: 'utility' },
          { name: 'Server Setup & Moderasi', value: 'admin' },
          { name: 'Khusus Owner Bot', value: 'owner' },
          { name: 'Tampilkan Semua Perintah', value: 'all' }
        )
    ),

  // Autocomplete untuk opsi 'perintah'
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const commands = interaction.client.commands;

    const filtered = commands
      .filter((cmd) => cmd.data.name.toLowerCase().includes(focusedValue))
      .map((cmd) => {
        const desc = cmd.data.description || '';
        const shortDesc = desc.length > 50 ? desc.substring(0, 47) + '...' : desc;
        return {
          name: `/${cmd.data.name} - ${shortDesc}`,
          value: cmd.data.name,
        };
      })
      .slice(0, 25);

    await interaction.respond(filtered);
  },

  // Eksekusi utama perintah /help
  async execute(interaction) {
    const specificCmd = interaction.options.getString('perintah');
    const selectedCategory = interaction.options.getString('kategori');

    // 1. Jika user meminta detail perintah spesifik (misal: /help perintah:play)
    if (specificCmd) {
      const detailEmbed = createCommandDetailEmbed(
        specificCmd,
        interaction.guild,
        interaction.user,
        interaction.client
      );
      return interaction.reply({ embeds: [detailEmbed] });
    }

    // 2. Jika user memilih kategori langsung lewat opsi slash command
    const initialCategory = selectedCategory || 'overview';
    const embed = createCategoryEmbed(
      initialCategory,
      interaction.guild,
      interaction.user,
      interaction.client
    );
    const components = createActionComponents(initialCategory);

    const response = await interaction.reply({
      embeds: [embed],
      components: components,
      fetchReply: true,
    });

    // Buat collector interaktif untuk menangani pilihan dropdown menu
    const collector = response.createMessageComponentCollector({
      componentType: ComponentType.StringSelect,
      time: 5 * 60 * 1000, // Aktif selama 5 menit
    });

    collector.on('collect', async (i) => {
      // Pastikan hanya pemanggil command yang dapat mengubah tampilan
      if (i.user.id !== interaction.user.id) {
        return i.reply({
          content: 'Gunakan perintah `/help` secara mandiri untuk membuka menu bantuan kamu.',
          flags: MessageFlags.Ephemeral,
        });
      }

      const chosenKey = i.values[0] || 'overview';
      const updatedEmbed = createCategoryEmbed(
        chosenKey,
        interaction.guild,
        interaction.user,
        interaction.client
      );
      const updatedComponents = createActionComponents(chosenKey);

      await i.update({
        embeds: [updatedEmbed],
        components: updatedComponents,
      });
    });

    // Ketika collector berakhir (timeout 5 menit), nonaktifkan dropdown agar tidak error
    collector.on('end', async () => {
      try {
        const disabledComponents = createActionComponents(initialCategory).map((row) => {
          row.components.forEach((comp) => comp.setDisabled(true));
          return row;
        });
        await interaction.editReply({ components: disabledComponents }).catch(() => null);
      } catch {
        // Abaikan jika pesan sudah terhapus
      }
    });
  },
};
