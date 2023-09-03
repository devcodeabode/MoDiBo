import { logger } from './utils.js'
import fs from 'fs';

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

function loadConfig() {
  try {
    config = JSON.parse(
      fs.readFileSync("../config.json", { encoding: "utf8", flag: "r" })
    );
  } catch (error) {
    logger.log(
      "warn",
      `config.json not found. Generating new configuration file...`
    );
    config = initConfig();
  }
}

export { loadConfig, defaultConfig, initConfig, config };
