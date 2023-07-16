const glob = require("glob");
const utils = require("./utils.js");
const configManager = require("./configManager.js");
const PLUGIN_FILES = "../plugins/*/main.js";

/**
 * Load plugin modules
 * @param {Discord.Client} bot The instantiated Discord Bot object, for use in calling module onLoad
 */
function load(bot) {
  //TODO Integrate with Config to only load enabled plugins

  utils.logger.log("debug", "Loading Plugins...");

  if (!("plugins" in configManager.config)) {
    utils.logger.warn(
      "No plugin configuration found. Not attempting to load any plugins."
    );
    return;
  }

  glob.sync(PLUGIN_FILES).forEach((file) => {
    let dash = file.split("/");
    if (dash.length !== 4) {
      return;
    }

    let dot = dash[3].split(".");
    if (dot.length !== 2) {
      return;
    }

    let module = require(file);
    let key = module.SLUG;
    let loaded = false;

    if (!(key in configManager.config.plugins)) {
      utils.logger.log(
        "debug",
        `Not loading Plugin "${module.NAME}", as it's not enabled in the config.`
      );
      return;
    }

    if (module?.processCommand) {
      utils.plugins.command[key] = module;
      loaded = true;
      utils.logger.log("debug", `Loaded "${module.NAME}" as a Command Plugin`);
    }

    if (module?.processMessage) {
      utils.plugins.message[key] = module;
      loaded = true;
      utils.logger.log("debug", `Loaded "${module.NAME}" as a Message Plugin`);
    }

    if (module?.processReaction) {
      utils.plugins.reaction[key] = module;
      loaded = true;
      utils.logger.log("debug", `Loaded "${module.NAME}" as a Reaction Plugin`);
    }

    if (module?.startCron) {
      utils.plugins.cron[key] = module;
      loaded = true;
      utils.logger.log("debug", `Loaded "${module.NAME}" as a Cron Plugin`);
    }

    if (loaded && module?.onLoad) {
      utils.logger.log("debug", `Running "${module.NAME}" onLoad function...`);
      module.onLoad(bot);
    }
  });

  utils.logger.log("debug", "All Plugins Loaded");
  for (const [pluginType, list] of Object.entries(utils.plugins)) {
    const pluginNames = Object.values(list).map((p) => `"${p.NAME}"`);
    utils.logger.log(
      "debug",
      `${pluginType} plugins: ${pluginNames.join(", ")}`
    );
  }
}

function startCrons() {
  for (const plugin in utils.plugins.cron) {
    utils.plugins.cron[plugin].startCron();
  }
}

module.exports = {
  load,
  startCrons,
};
