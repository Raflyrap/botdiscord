const {
  setupFullTemplate,
  setupGetStarted,
  setupOfficial,
  setupNotify,
  setupCommunity,
  setupCinematography,
  setupEntertainment,
  setupMiniGamesTemplate,
  setupVoiceLounges,
  getOrCreateRole,
  handleGenderRoleSelection,
  handleVerificationButton,
} = require('./templateSetupHelper');

async function getStandardRoles(guild) {
  const member = await getOrCreateRole(guild, { name: 'Member', color: 0x57f287, hoist: true });
  const male = await getOrCreateRole(guild, { name: 'Laki-laki', color: 0x3498db, hoist: true });
  const female = await getOrCreateRole(guild, { name: 'Perempuan', color: 0xe91e63, hoist: true });
  const verified = await getOrCreateRole(guild, { name: 'Terverifikasi', color: 0x95a5a6, hoist: false });
  return { member, male, female, verified };
}

// Master All-in-One Setup sesuai Template Screenshot User
async function setupAll(guild) {
  return await setupFullTemplate(guild);
}

// Individual sub-setups
async function setupGetStartedCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupGetStarted(guild, roles);
}

async function setupOfficialCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupOfficial(guild, roles);
}

async function setupNotifyCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupNotify(guild, roles);
}

async function setupCommunityCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupCommunity(guild, roles);
}

async function setupCinematographyCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupCinematography(guild, roles);
}

async function setupEntertainmentCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupEntertainment(guild, roles);
}

async function setupMiniGamesCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupMiniGamesTemplate(guild, roles);
}

async function setupVoiceLoungesCategory(guild) {
  const roles = await getStandardRoles(guild);
  return await setupVoiceLounges(guild, roles);
}

// Backward compatibility alias
const setupWelcomeAndLeave = setupNotifyCategory;
const setupVerification = setupGetStartedCategory;
const setupGames = setupMiniGamesCategory;
const setupSupportTicket = setupOfficialCategory;
const setupVoiceHub = setupVoiceLoungesCategory;

module.exports = {
  setupAll,
  setupFullTemplate,
  setupGetStartedCategory,
  setupOfficialCategory,
  setupNotifyCategory,
  setupCommunityCategory,
  setupCinematographyCategory,
  setupEntertainmentCategory,
  setupMiniGamesCategory,
  setupVoiceLoungesCategory,
  setupWelcomeAndLeave,
  setupVerification,
  setupGames,
  setupSupportTicket,
  setupVoiceHub,
  handleGenderRoleSelection,
  handleVerificationButton,
};
