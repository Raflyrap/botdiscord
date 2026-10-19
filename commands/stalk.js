const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stalk')
    .setDescription('Lihat informasi dan statistik akun profil media sosial (bebas emoji)')
    .addStringOption((opt) =>
      opt
        .setName('platform')
        .setDescription('Pilih platform media sosial')
        .setRequired(true)
        .addChoices(
          { name: 'Twitter / X', value: 'twitter' },
          { name: 'GitHub', value: 'github' },
          { name: 'Roblox', value: 'roblox' },
          { name: 'YouTube', value: 'youtube' },
          { name: 'TikTok', value: 'tiktok' },
          { name: 'Instagram', value: 'instagram' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('username')
        .setDescription('Username atau handle akun target (tanpa tanda @)')
        .setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const platform = interaction.options.getString('platform');
    const rawUsername = interaction.options.getString('username').trim();
    const username = rawUsername.replace(/^@+/, '');

    if (!username) {
      return interaction.editReply({
        content: '[ERROR] Masukkan username yang valid.',
      });
    }

    try {
      if (platform === 'twitter') {
        return await handleTwitter(interaction, username);
      } else if (platform === 'github') {
        return await handleGitHub(interaction, username);
      } else if (platform === 'roblox') {
        return await handleRoblox(interaction, username);
      } else if (platform === 'youtube') {
        return await handleYouTube(interaction, username);
      } else if (platform === 'tiktok') {
        return await handleTikTok(interaction, username);
      } else if (platform === 'instagram') {
        return await handleInstagram(interaction, username);
      }
    } catch (err) {
      console.error(`[STALK ERROR] [${platform}]`, err);
      return interaction.editReply({
        content: `[GAGAL] Terjadi kendala saat mengambil data profil ${platform.toUpperCase()}: ${err.message}`,
      });
    }
  },
};

// ================= HANDLERS ================= //

async function handleTwitter(interaction, username) {
  const url = `https://api.fxtwitter.com/${encodeURIComponent(username)}`;
  const res = await fetch(url);

  if (!res.ok) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Akun Twitter/X dengan username "${username}" tidak ditemukan atau berstatus privat.`,
    });
  }

  const data = await res.json();
  const user = data?.user;

  if (!user || !user.screen_name) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Akun Twitter/X dengan username "${username}" tidak ditemukan.`,
    });
  }

  const profileUrl = `https://x.com/${user.screen_name}`;
  const verifiedText = user.verification?.verified
    ? `Terverifikasi (${user.verification?.type || 'Centang'})`
    : 'Belum Terverifikasi';

  const embed = new EmbedBuilder()
    .setColor(0x1DA1F2)
    .setAuthor({
      name: `FlyBot  •  Profil Twitter / X`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`${user.name} (@${user.screen_name})`)
    .setURL(profileUrl)
    .setDescription(user.description || '*Tidak ada bio.*')
    .setThumbnail(user.avatar_url)
    .addFields(
      { name: 'Followers', value: (user.followers ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Following', value: (user.following ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Total Tweet/Post', value: (user.tweets ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Total Disukai', value: (user.likes ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Media Terunggah', value: (user.media_count ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Verifikasi Akun', value: verifiedText, inline: true },
      { name: 'Bergabung Sejak', value: user.joined ? user.joined.slice(0, 10) : '-', inline: true },
      { name: 'Tipe Akun', value: user.protected ? 'Privat / Terkunci' : 'Publik', inline: true },
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  if (user.banner_url) {
    embed.setImage(user.banner_url);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil Twitter / X')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleGitHub(interaction, username) {
  const url = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'FlyBot-DiscordBot' },
  });

  if (res.status === 404) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Pengguna GitHub dengan username "${username}" tidak ditemukan.`,
    });
  }

  if (!res.ok) {
    return interaction.editReply({
      content: `[ERROR] Gagal memuat data GitHub (Status: ${res.status}). Silakan coba beberapa saat lagi.`,
    });
  }

  const data = await res.json();
  const profileUrl = data.html_url;
  const createdDate = data.created_at ? data.created_at.slice(0, 10) : '-';

  const embed = new EmbedBuilder()
    .setColor(0x24292E)
    .setAuthor({
      name: `FlyBot  •  Profil GitHub`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`${data.name || data.login} (@${data.login})`)
    .setURL(profileUrl)
    .setDescription(data.bio || '*Tidak ada bio.*')
    .setThumbnail(data.avatar_url)
    .addFields(
      { name: 'Followers', value: (data.followers ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Following', value: (data.following ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Repositori Publik', value: (data.public_repos ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Gist Publik', value: (data.public_gists ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Perusahaan / Org', value: data.company || '-', inline: true },
      { name: 'Lokasi', value: data.location || '-', inline: true },
      { name: 'Dibuat Pada', value: createdDate, inline: true },
      { name: 'Tipe Akun', value: data.type || 'User', inline: true },
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleRoblox(interaction, username) {
  const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
  });

  if (!searchRes.ok) {
    return interaction.editReply({
      content: `[ERROR] Gagal mencari pengguna Roblox (Status: ${searchRes.status}).`,
    });
  }

  const searchData = await searchRes.json();
  const userBasic = searchData?.data?.[0];

  if (!userBasic) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Pengguna Roblox dengan username "${username}" tidak ditemukan.`,
    });
  }

  const userId = userBasic.id;
  const detailRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
  const details = detailRes.ok ? await detailRes.json() : {};

  const avatarRes = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );
  const avatarData = avatarRes.ok ? await avatarRes.json() : {};
  const avatarUrl = avatarData?.data?.[0]?.imageUrl || null;

  const profileUrl = `https://www.roblox.com/users/${userId}/profile`;
  const createdDate = details.created ? details.created.slice(0, 10) : '-';

  const embed = new EmbedBuilder()
    .setColor(0xE2231A)
    .setAuthor({
      name: `FlyBot  •  Profil Roblox`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`${details.displayName || userBasic.displayName} (@${details.name || userBasic.name})`)
    .setURL(profileUrl)
    .setDescription(details.description || '*Tidak ada deskripsi profil.*')
    .addFields(
      { name: 'User ID', value: `\`${userId}\``, inline: true },
      { name: 'Display Name', value: details.displayName || '-', inline: true },
      { name: 'Status Akun', value: details.isBanned ? 'Banned' : 'Aktif', inline: true },
      { name: 'Dibuat Pada', value: createdDate, inline: true },
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil Roblox')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleYouTube(interaction, username) {
  const channelUrl = `https://www.youtube.com/@${encodeURIComponent(username)}`;
  const res = await fetch(channelUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  });

  if (res.status === 404) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Channel YouTube dengan handle "@${username}" tidak ditemukan.`,
    });
  }

  const html = await res.text();
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
  const imgMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  const subsMatch = html.match(
    /"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/
  );

  const title = titleMatch?.[1] || `@${username}`;
  const desc = descMatch?.[1] || '*Tidak ada deskripsi channel.*';
  const avatar = imgMatch?.[1] || null;
  const subs = subsMatch?.[1] || 'Disembunyikan / Tidak tersedia';

  const embed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setAuthor({
      name: `FlyBot  •  Profil YouTube`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(title)
    .setURL(channelUrl)
    .setDescription(desc.length > 300 ? desc.slice(0, 297) + '...' : desc)
    .addFields(
      { name: 'Handle Channel', value: `@${username}`, inline: true },
      { name: 'Jumlah Subscriber', value: subs, inline: true },
      { name: 'Link Channel', value: `[Buka di Browser](${channelUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  if (avatar) {
    embed.setThumbnail(avatar);
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Channel YouTube')
      .setStyle(ButtonStyle.Link)
      .setURL(channelUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleTikTok(interaction, username) {
  const oembedUrl = `https://www.tiktok.com/oembed?url=https://www.tiktok.com/@${encodeURIComponent(username)}`;
  const res = await fetch(oembedUrl);

  const profileUrl = `https://www.tiktok.com/@${username}`;

  if (!res.ok) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Akun TikTok dengan username "@${username}" tidak ditemukan atau berstatus privat.`,
    });
  }

  const data = await res.json();
  const creatorName = data.author_name || username;

  const embed = new EmbedBuilder()
    .setColor(0x000000)
    .setAuthor({
      name: `FlyBot  •  Profil TikTok`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`${creatorName} (@${username})`)
    .setURL(profileUrl)
    .setDescription(
      `Akun TikTok resmi ditemukan.\n` +
      `Untuk detail video, follower realtime dan postingan lengkap, silakan akses langsung melalui tombol profil di bawah.`
    )
    .addFields(
      { name: 'Username', value: `@${username}`, inline: true },
      { name: 'Nama Kreator', value: creatorName, inline: true },
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil TikTok')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleInstagram(interaction, username) {
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(username)}/`;

  const embed = new EmbedBuilder()
    .setColor(0xC13584)
    .setAuthor({
      name: `FlyBot  •  Profil Instagram`,
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`Instagram: @${username}`)
    .setURL(profileUrl)
    .setDescription(
      `Profil Instagram untuk pengguna **@${username}**.\n` +
      `Catatan: Meta menerapkan proteksi privasi dan batas akses ketat terhadap data follower/postingan anonim. Gunakan tombol di bawah untuk membuka profil secara langsung.`
    )
    .addFields(
      { name: 'Username Target', value: `@${username}`, inline: true },
      { name: 'Platform', value: 'Instagram', inline: true },
      { name: 'Akses Cepat', value: `[Buka Halaman Profil](${profileUrl})`, inline: true }
    )
    .setFooter({ text: `Diminta oleh ${interaction.user.username}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil Instagram')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}
