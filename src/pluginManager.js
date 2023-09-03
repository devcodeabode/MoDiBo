import glob from 'glob';
import { logger, plugins } from './utils.js';
import { config } from './configManager.js'
const PLUGIN_FILES = "../plugins/*/main.js";

/**
 * Load plugin modules
 * @param {Discord.Client} bot The instantiated Discord Bot object, for use in calling module onLoad
 */
function load(bot) {
  //TODO Integrate with Config to only load enabled plugins

  logger.log("debug", "Loading Plugins...");

  if (!("plugins" in config)) {
    logger.warn(
      "No plugin configuration found. Not attempting to load any plugins."
    );
    return;
  }

  glob.sync(PLUGIN_FILES).forEach(async (file) => {
    let dash = file.split("/");
    if (dash.length !== 4) {
      return;
    }

    let dot = dash[3].split(".");
    if (dot.length !== 2) {
      return;
    }

    let fullModule = await import(file);
    let module = fullModule?.default;
    let key = module.SLUG;
    let loaded = false;

    if (!(key in config.plugins)) {
      logger.log(
        "debug",
        `Not loading Plugin "${module.NAME}", as it's not enabled in the config.`
      );
      return;
    }

    if (module?.processCommand) {
      plugins.command[key] = module;
      loaded = true;
      logger.log("debug", `Loaded "${module.NAME}" as a Command Plugin`);
    }

    if (module?.processMessage) {
      plugins.message[key] = module;
      loaded = true;
      logger.log("debug", `Loaded "${module.NAME}" as a Message Plugin`);
    }

    if (module?.processReaction) {
      plugins.reaction[key] = module;
      loaded = true;
      logger.log("debug", `Loaded "${module.NAME}" as a Reaction Plugin`);
    }

    if (module?.startCron) {
      plugins.cron[key] = module;
      loaded = true;
      logger.log("debug", `Loaded "${module.NAME}" as a Cron Plugin`);
    }

    if (loaded && module?.onLoad) {
      logger.log("debug", `Running "${module.NAME}" onLoad function...`);
      module.onLoad(bot);
    }
  });

  logger.log("debug", "All Plugins Loaded");
  for (const [pluginType, list] of Object.entries(plugins)) {
    const pluginNames = Object.values(list).map((p) => `"${p.NAME}"`);
    logger.log(
      "debug",
      `${pluginType} plugins: ${pluginNames.join(", ")}`
    );
  }
}

function startCrons() {
  for (const plugin in plugins.cron) {
    plugins.cron[plugin].startCron();
  }
}

export default {
  load,
  startCrons,
};
