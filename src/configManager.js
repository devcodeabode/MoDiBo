const utils = require * "./utils.js";
const fs = require("fs");

let config;

const defaultConfig = {
  prefix: "$",
  activity: { type: "playing", description: "$help" },
  color: "purple",
  plugins: {},
  discordLogging: { active: "true", level: "warn" },
};

function initConfig() {
  fs.writeFile("../config.json", JSON.stringify(defaultConfig), function (err) {
    if (err) throw "Error auto-generating configuration file.";
    utils.logger.log(
      "warn",
      `config.json not found. Generating new configuration file...`
    );
  });

  return defaultConfig;
}

function loadConfig() {
  try {
    return JSON.parse(
      fs.readFileSync("../config.json", { encoding: "utf8", flag: "r" })
    );
  } catch (error) {
    return initConfig();
  }
}

module.exports = { loadConfig, config };
