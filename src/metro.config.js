const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  unstable_serverRoot: __dirname,
};

// Allow requests from any host (needed for Codespaces/tunnels)
process.env.DANGEROUSLY_DISABLE_HOST_CHECK = "true";

module.exports = config;