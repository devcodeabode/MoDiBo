const utils = require("./utils.js");
const fs = require("fs");

let config;

const defaultConfig = {
  prefix: "$",
  activity: { type: "playing", description: "$help" },
  color: "purple",
  plugins: {},
  discordLogging: { active: true, level: "warn" },
};

function initConfig() {
  fs.writeFileSync("../config.json", JSON.stringify(defaultConfig, null, 2));
  return defaultConfig;
}

function logDefaultConfig() {
  utils.logger.warn(
    `DEFAULT CONFIG: \n${JSON.stringify(defaultConfig, null, 2)}`
  );
}

function loadConfig() {
  try {
    module.exports.config = JSON.parse(
      fs.readFileSync("../config.json", { encoding: "utf8", flag: "r" })
    );
  } catch (error) {
    utils.logger.log(
      "warn",
      `config.json not found. Generating new configuration file...`
    );
    module.exports.config = initConfig();
  }
}

module.exports = { loadConfig, logDefaultConfig, initConfig, config };
