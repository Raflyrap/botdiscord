const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stalk')
    .setDescription('Lihat informasi profil akun (hasil bersifat privat & hanya terlihat oleh kamu)')
    .addStringOption((opt) =>
      opt
        .setName('platform')
        .setDescription('Pilih platform yang ingin di-stalk')
        .setRequired(true)
        .addChoices(
          { name: 'Roblox (Follower, Teman, ID & Avatar)', value: 'roblox' },
          { name: 'GitHub (Follower, Repo, Bio & Org)', value: 'github' },
          { name: 'Twitter / X (Follower, Tweet, Like & Bio)', value: 'twitter' },
          { name: 'Minecraft (UUID, Skin 3D & NameMC)', value: 'minecraft' }
        )
    )
    .addStringOption((opt) =>
      opt
        .setName('username')
        .setDescription('Username atau link profil target')
        .setRequired(true)
    ),

  async execute(interaction) {
    // Cek pembatasan channel: /stalk hanya dapat digunakan di channel stalk
    if (interaction.guild) {
      const stalkChannel = interaction.guild.channels.cache.find(
        (c) => c.isTextBased() && c.name.toLowerCase().includes('stalk')
      );
      if (stalkChannel && interaction.channelId !== stalkChannel.id) {
        return interaction.reply({
          content: `⚠️ Perintah \`/stalk\` hanya dapat digunakan di channel khusus: <#${stalkChannel.id}>!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Balasan bersifat privat (ephemeral) agar hanya pengguna yang menjalankan yang bisa melihat
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const platform = interaction.options.getString('platform');
    const rawInput = interaction.options.getString('username').trim();
    const cleanUser = cleanInput(rawInput);

    if (!cleanUser) {
      return interaction.editReply({
        content: '[ERROR] Masukkan username atau link profil yang valid.',
      });
    }

    try {
      if (platform === 'roblox') {
        return await handleRoblox(interaction, rawInput, cleanUser);
      } else if (platform === 'github') {
        return await handleGitHub(interaction, cleanUser);
      } else if (platform === 'twitter') {
        return await handleTwitter(interaction, cleanUser);
      } else if (platform === 'minecraft') {
        return await handleMinecraft(interaction, cleanUser);
      }
    } catch (err) {
      console.error(`[STALK ERROR] [${platform}]`, err);
      return interaction.editReply({
        content: `[GAGAL] Terjadi kendala saat mengambil data profil ${platform.toUpperCase()}: ${err.message}`,
      });
    }
  },
};

// ================= HELPER PEMBERSIH INPUT ================= //

function cleanInput(input) {
  let str = input.trim().replace(/\/+$/, '');
  // Jika pengguna menempelkan link lengkap, ambil bagian akhir URL
  if (str.includes('/')) {
    const parts = str.split('/').filter(Boolean);
    str = parts.pop() || '';
  }
  // Hapus tanda @ di awal jika ada
  return str.replace(/^@+/, '');
}

// ================= HANDLERS ================= //

async function handleRoblox(interaction, rawInput, username) {
  let userId = null;

  // Cek apakah pengguna menempelkan link profil dengan User ID langsung (/users/12345/profile)
  const urlIdMatch = rawInput.match(/\/users\/(\d+)/);
  if (urlIdMatch) {
    userId = urlIdMatch[1];
  } else {
    // Cari user ID berdasarkan username
    const searchRes = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: false }),
    });

    if (!searchRes.ok) {
      return interaction.editReply({
        content: `[ERROR] Gagal menghubungi server Roblox (Status: ${searchRes.status}).`,
      });
    }

    const searchData = await searchRes.json();
    const userFound = searchData?.data?.[0];
    if (!userFound) {
      return interaction.editReply({
        content: `[TIDAK DITEMUKAN] Pengguna Roblox dengan username "${username}" tidak ditemukan.`,
      });
    }
    userId = userFound.id;
  }

  // Tarik detail lengkap & statistik follower/following/teman secara paralel
  const [detailRes, avatarRes, followerRes, followingRes, friendRes] = await Promise.all([
    fetch(`https://users.roblox.com/v1/users/${userId}`).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
    ).then((r) => (r.ok ? r.json() : {})).catch(() => ({})),
    fetch(`https://friends.roblox.com/v1/users/${userId}/followers/count`).then((r) => (r.ok ? r.json() : { count: 0 })).catch(() => ({ count: 0 })),
    fetch(`https://friends.roblox.com/v1/users/${userId}/followings/count`).then((r) => (r.ok ? r.json() : { count: 0 })).catch(() => ({ count: 0 })),
    fetch(`https://friends.roblox.com/v1/users/${userId}/friends/count`).then((r) => (r.ok ? r.json() : { count: 0 })).catch(() => ({ count: 0 })),
  ]);

  const profileUrl = `https://www.roblox.com/users/${userId}/profile`;
  const displayName = detailRes.displayName || username;
  const realName = detailRes.name || username;
  const avatarUrl = avatarRes?.data?.[0]?.imageUrl || null;
  const createdDate = detailRes.created ? detailRes.created.slice(0, 10) : '-';

  const embed = new EmbedBuilder()
    .setColor(0xE2231A)
    .setAuthor({
      name: 'FlyBot  •  Profil Roblox (Privat)',
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`${displayName} (@${realName})`)
    .setURL(profileUrl)
    .setDescription(detailRes.description || '*Tidak ada bio/deskripsi profil.*')
    .addFields(
      { name: 'Followers', value: (followerRes.count ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Following', value: (followingRes.count ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'Total Teman', value: (friendRes.count ?? 0).toLocaleString('id-ID'), inline: true },
      { name: 'User ID', value: `\`${userId}\``, inline: true },
      { name: 'Status Akun', value: detailRes.isBanned ? 'Banned' : 'Aktif', inline: true },
      { name: 'Bergabung Sejak', value: createdDate, inline: true },
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: false }
    )
    .setFooter({ text: 'Informasi ini hanya terlihat oleh kamu (Privat)' })
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
      name: 'FlyBot  •  Profil GitHub (Privat)',
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
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: false }
    )
    .setFooter({ text: 'Informasi ini hanya terlihat oleh kamu (Privat)' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka Profil GitHub')
      .setStyle(ButtonStyle.Link)
      .setURL(profileUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleTwitter(interaction, username) {
  const url = `https://api.fxtwitter.com/${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    },
  });

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
      name: 'FlyBot  •  Profil Twitter / X (Privat)',
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
      { name: 'Link Profil', value: `[Buka di Browser](${profileUrl})`, inline: false }
    )
    .setFooter({ text: 'Informasi ini hanya terlihat oleh kamu (Privat)' })
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

async function handleMinecraft(interaction, username) {
  const url = `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(username)}`;
  const res = await fetch(url);

  if (res.status === 404 || res.status === 204) {
    return interaction.editReply({
      content: `[TIDAK DITEMUKAN] Akun Minecraft dengan nama "${username}" tidak ditemukan.`,
    });
  }

  if (!res.ok) {
    return interaction.editReply({
      content: `[ERROR] Gagal menghubungi server Mojang (Status: ${res.status}).`,
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
      name: 'FlyBot  •  Profil Minecraft (Privat)',
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setTitle(`Minecraft: ${realName}`)
    .setURL(namemcUrl)
    .setDescription(`Detail akun Minecraft Java Edition untuk **${realName}**.`)
    .setThumbnail(avatarUrl)
    .addFields(
      { name: 'Username Resmi', value: realName, inline: true },
      { name: 'UUID Akun', value: `\`${uuid}\``, inline: true },
      { name: 'Profile NameMC', value: `[Buka di NameMC](${namemcUrl})`, inline: false }
    )
    .setFooter({ text: 'Informasi ini hanya terlihat oleh kamu (Privat)' })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel('Buka di NameMC')
      .setStyle(ButtonStyle.Link)
      .setURL(namemcUrl)
  );

  return interaction.editReply({ embeds: [embed], components: [row] });
}
