const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');
const { stalkMlbb, stalkRoblox } = require('../stalkHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stalk')
    .setDescription('Stalk profil dan status akun game atau media sosial (MLBB, Roblox, dll)')
    .addSubcommand((sub) =>
      sub
        .setName('mlbb')
        .setDescription('Stalk informasi akun, region server, dan event top-up Mobile Legends')
        .addStringOption((opt) =>
          opt
            .setName('user_id')
            .setDescription('User ID akun Mobile Legends (contoh: 1710074029)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('server_id')
            .setDescription('Server / Zone ID akun Mobile Legends (contoh: 1712)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('roblox')
        .setDescription('Stalk profil pemain, avatar 3D, status online, dan info akun Roblox')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Username akun Roblox pemain (contoh: Builderman atau Roblox)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('github')
        .setDescription('Stalk profil pengembang, repositori publik, dan statistik akun GitHub')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Username akun GitHub (contoh: torvalds)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('twitter')
        .setDescription('Stalk profil, followers, dan bio akun Twitter / X')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Username akun Twitter / X (tanpa tanda @)')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('minecraft')
        .setDescription('Stalk UUID, skin, dan riwayat akun Minecraft Java Edition')
        .addStringOption((opt) =>
          opt
            .setName('username')
            .setDescription('Username resmi akun Minecraft')
            .setRequired(true)
        )
    ),

  async execute(interaction) {
    // 1. Pengecekan Channel Khusus Stalk (#stalk atau #stalk-game)
    let stalkChannel = interaction.guild?.channels.cache.find(
      (c) =>
        c.isTextBased() &&
        (c.name.toLowerCase() === 'stalk' ||
          c.name.toLowerCase() === 'stalk-game' ||
          c.name.toLowerCase() === 'game-stalk')
    );

    // Coba buat channel stalk otomatis jika belum ada di server
    if (!stalkChannel && interaction.guild) {
      try {
        const botMember =
          interaction.guild.members.me ||
          (await interaction.guild.members.fetchMe().catch(() => null));
        if (botMember?.permissions.has(PermissionFlagsBits.ManageChannels)) {
          const parentCat = interaction.guild.channels.cache.find(
            (c) =>
              c.type === ChannelType.GuildCategory &&
              (c.name.toLowerCase().includes('game') ||
                c.name.toLowerCase().includes('entertainment') ||
                c.name.toLowerCase().includes('komunitas'))
          );

          stalkChannel = await interaction.guild.channels.create({
            name: 'stalk',
            type: ChannelType.GuildText,
            parent: parentCat ? parentCat.id : undefined,
            topic: 'Channel khusus stalk akun game dan media sosial (Mobile Legends, Roblox, GitHub, dll). Gunakan /stalk di sini.',
            reason: 'Auto-create channel stalk FlyBot',
          });
        }
      } catch (e) {}
    }

    // Jika channel stalk tersedia dan perintah dijalankan di channel lain, arahkan user ke channel stalk
    if (stalkChannel && interaction.channelId !== stalkChannel.id) {
      return interaction.reply({
        content: `Perintah stalk hanya dapat dijalankan di channel <#${stalkChannel.id}>. Silakan beralih ke channel tersebut agar percakapan tetap teratur.`,
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply();

    // 2. Subcommand: Mobile Legends (MLBB)
    if (subcommand === 'mlbb') {
      const userId = interaction.options.getString('user_id');
      const serverId = interaction.options.getString('server_id');

      const result = await stalkMlbb(userId, serverId);

      if (!result.success) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Gagal Melakukan Stalk Akun Mobile Legends')
          .setDescription(result.error || 'Terjadi kesalahan saat memeriksa akun Mobile Legends.')
          .addFields(
            { name: 'User ID', value: `\`${userId}\``, inline: true },
            { name: 'Server / Zone ID', value: `\`${serverId}\``, inline: true }
          )
          .setFooter({ text: 'FlyBot Game Stalker • Mobile Legends' })
          .setTimestamp();

        return interaction.editReply({ embeds: [errEmbed] });
      }

      const d = result.data;
      const mlbbEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setAuthor({
          name: 'FlyBot Game Stalker • Mobile Legends: Bang Bang',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Informasi Akun: ${d.nickname}`)
        .setDescription(
          `Hasil pencarian data akun Mobile Legends untuk ID **${d.userId}** (Server **${d.serverId}**)`
        )
        .addFields(
          { name: 'Nickname Akun', value: `**${d.nickname}**`, inline: true },
          { name: 'Region / Negara', value: `**${d.regionName} (${d.regionCode})**`, inline: true },
          { name: 'User ID & Server', value: `\`${d.userId}\` (${d.serverId})`, inline: true },
          {
            name: 'Status Ketersediaan Bundle',
            value:
              `> • Weekly Elite Bundle: **${d.weeklyElite}**\n` +
              `> • Monthly Epic Bundle: **${d.monthlyEpic}**`,
            inline: false,
          },
          {
            name: 'Status Bonus Diamond & Promo Top-Up',
            value: d.eventList.length > 0 ? d.eventList.join('\n') : '• Tidak ada informasi promo aktif',
            inline: false,
          }
        )
        .setFooter({ text: `FlyBot Game Stalker • Waktu Respon API: ${d.timeTaken}` })
        .setTimestamp();

      return interaction.editReply({ embeds: [mlbbEmbed] });
    }

    // 3. Subcommand: Roblox
    if (subcommand === 'roblox') {
      const username = interaction.options.getString('username');
      const result = await stalkRoblox(username);

      if (!result.success) {
        const errEmbed = new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('Gagal Melakukan Stalk Akun Roblox')
          .setDescription(result.error || 'Terjadi kesalahan saat memeriksa akun Roblox.')
          .addFields({ name: 'Username Dicari', value: `\`${username}\``, inline: true })
          .setFooter({ text: 'FlyBot Game Stalker • Roblox' })
          .setTimestamp();

        return interaction.editReply({ embeds: [errEmbed] });
      }

      const d = result.data;
      const robloxEmbed = new EmbedBuilder()
        .setColor(0x00A2FF)
        .setAuthor({
          name: 'FlyBot Game Stalker • Roblox Player Profile',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Profil Roblox: ${d.displayName} (@${d.username})`)
        .setDescription(`>>> ${d.description}`)
        .addFields(
          { name: 'Display Name', value: `**${d.displayName}**`, inline: true },
          { name: 'Username Akun', value: `\`@${d.username}\``, inline: true },
          { name: 'User ID Roblox', value: `\`${d.userId}\``, inline: true },
          { name: 'Status Akun', value: `**${d.isBanned}**`, inline: true },
          { name: 'Lencana Verifikasi', value: `**${d.hasVerifiedBadge}**`, inline: true },
          { name: 'Status Aktivitas', value: `**${d.statusText}**`, inline: true },
          {
            name: 'Tanggal Akun Dibuat',
            value: d.createdAt ? `<t:${d.createdAt}:F> (<t:${d.createdAt}:R>)` : 'Tidak diketahui',
            inline: false,
          }
        )
        .setFooter({ text: 'FlyBot Game Stalker • Database Resmi Roblox' })
        .setTimestamp();

      if (d.avatarUrl) {
        robloxEmbed.setThumbnail(d.avatarUrl);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setLabel('Buka Profil di Roblox')
          .setStyle(ButtonStyle.Link)
          .setURL(d.profileUrl)
      );

      return interaction.editReply({ embeds: [robloxEmbed], components: [row] });
    }

    // 4. Subcommand: GitHub
    if (subcommand === 'github') {
      const username = interaction.options.getString('username');
      const url = `https://api.github.com/users/${encodeURIComponent(username)}`;
      const res = await fetch(url, { headers: { 'User-Agent': 'FlyBot-DiscordBot' } }).catch(() => null);

      if (!res || res.status === 404) {
        return interaction.editReply({
          content: `Pengguna GitHub dengan username "${username}" tidak ditemukan.`,
        });
      }
      if (!res.ok) {
        return interaction.editReply({
          content: `Gagal memuat data GitHub (Status: ${res.status}). Silakan coba beberapa saat lagi.`,
        });
      }

      const data = await res.json();
      const profileUrl = data.html_url;
      const createdDate = data.created_at ? data.created_at.slice(0, 10) : '-';

      const embed = new EmbedBuilder()
        .setColor(0x24292E)
        .setAuthor({
          name: 'FlyBot Game Stalker • Profil GitHub',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`${data.name || data.login} (@${data.login})`)
        .setURL(profileUrl)
        .setDescription(data.bio || '*Tidak ada bio profil.*')
        .setThumbnail(data.avatar_url)
        .addFields(
          { name: 'Followers', value: (data.followers ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Following', value: (data.following ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Repositori Publik', value: (data.public_repos ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Perusahaan / Org', value: data.company || '-', inline: true },
          { name: 'Lokasi', value: data.location || '-', inline: true },
          { name: 'Dibuat Pada', value: createdDate, inline: true }
        )
        .setFooter({ text: 'FlyBot Game Stalker • GitHub' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Buka Profil GitHub').setStyle(ButtonStyle.Link).setURL(profileUrl)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    // 5. Subcommand: Twitter / X
    if (subcommand === 'twitter') {
      const username = interaction.options.getString('username');
      const url = `https://api.fxtwitter.com/${encodeURIComponent(username)}`;
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        },
      }).catch(() => null);

      if (!res || !res.ok) {
        return interaction.editReply({
          content: `Akun Twitter/X dengan username "${username}" tidak ditemukan atau berstatus privat.`,
        });
      }

      const data = await res.json();
      const user = data?.user;

      if (!user || !user.screen_name) {
        return interaction.editReply({
          content: `Akun Twitter/X dengan username "${username}" tidak ditemukan.`,
        });
      }

      const profileUrl = `https://x.com/${user.screen_name}`;
      const verifiedText = user.verification?.verified
        ? `Terverifikasi (${user.verification?.type || 'Centang'})`
        : 'Belum Terverifikasi';

      const embed = new EmbedBuilder()
        .setColor(0x1DA1F2)
        .setAuthor({
          name: 'FlyBot Game Stalker • Profil Twitter / X',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`${user.name} (@${user.screen_name})`)
        .setURL(profileUrl)
        .setDescription(user.description || '*Tidak ada bio.*')
        .setThumbnail(user.avatar_url)
        .addFields(
          { name: 'Followers', value: (user.followers ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Following', value: (user.following ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Total Tweet', value: (user.tweets ?? 0).toLocaleString('id-ID'), inline: true },
          { name: 'Verifikasi Akun', value: verifiedText, inline: true },
          { name: 'Bergabung Sejak', value: user.joined ? user.joined.slice(0, 10) : '-', inline: true }
        )
        .setFooter({ text: 'FlyBot Game Stalker • Twitter / X' })
        .setTimestamp();

      if (user.banner_url) {
        embed.setImage(user.banner_url);
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Buka Profil Twitter / X').setStyle(ButtonStyle.Link).setURL(profileUrl)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }

    // 6. Subcommand: Minecraft
    if (subcommand === 'minecraft') {
      const username = interaction.options.getString('username');
      const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`;
      const res = await fetch(url).catch(() => null);

      if (!res || res.status === 404 || res.status === 204) {
        return interaction.editReply({
          content: `Akun Minecraft dengan nama "${username}" tidak ditemukan.`,
        });
      }

      if (!res.ok) {
        return interaction.editReply({
          content: `Gagal menghubungi server Mojang (Status: ${res.status}).`,
        });
      }

      const data = await res.json();
      const uuid = data.id;
      const realName = data.name;
      const avatarUrl = `https://mc-heads.net/avatar/${uuid}/150`;
      const namemcUrl = `https://namemc.com/profile/${uuid}`;

      const embed = new EmbedBuilder()
        .setColor(0x55FF55)
        .setAuthor({
          name: 'FlyBot Game Stalker • Profil Minecraft',
          iconURL: interaction.client.user.displayAvatarURL(),
        })
        .setTitle(`Minecraft: ${realName}`)
        .setURL(namemcUrl)
        .setDescription(`Detail akun Minecraft Java Edition untuk **${realName}**.`)
        .setThumbnail(avatarUrl)
        .addFields(
          { name: 'Username Resmi', value: realName, inline: true },
          { name: 'UUID Akun', value: `\`${uuid}\``, inline: true }
        )
        .setFooter({ text: 'FlyBot Game Stalker • Minecraft' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Buka di NameMC').setStyle(ButtonStyle.Link).setURL(namemcUrl)
      );

      return interaction.editReply({ embeds: [embed], components: [row] });
    }
  },
};
