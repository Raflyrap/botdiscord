const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'autoRoleConfig.json');

function loadConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      fs.writeFileSync(configPath, JSON.stringify({}, null, 2));
      return {};
    }
    const data = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (error) {
    console.error('Error membaca autoRoleConfig.json:', error);
    return {};
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error('Error menyimpan autoRoleConfig.json:', error);
  }
}

function getAutoRole(guildId) {
  const config = loadConfig();
  return config[guildId] || null;
}

function setAutoRole(guildId, roleId) {
  const config = loadConfig();
  config[guildId] = roleId;
  saveConfig(config);
  return roleId;
}

function removeAutoRole(guildId) {
  const config = loadConfig();
  delete config[guildId];
  saveConfig(config);
  return true;
}

module.exports = {
  getAutoRole,
  setAutoRole,
  removeAutoRole,
};
