/**
 * @author Joshua Maxwell
 * @author Brandon Ingli
 * This file will start the bot.
 */

// dependencies
require("dotenv").config({
  path: process.argv.includes("--testing") ? "../.env.testing" : "../.env",
});
const {
  Client,
  Intents,
  GatewayIntentBits,
  Partials,
  ChannelType,
  ActivityType,
} = require("discord.js");
const winston = require("winston");
const winstonDiscord = require("./CustomDiscordWebhookTransport.js");
const winstonRotateFile = require("winston-daily-rotate-file");
const utils = require("./utils.js");
const configManager = require("./configManager");
const pluginManager = require("./pluginManager.js");
const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL ?? "warn";

utils.logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: consoleLogLevel,
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
      handleExceptions: true,
    }),
    new winstonRotateFile({
      filename: "../logs/combined-%DATE%.log",
      datePattern: "YYYY-MM",
      zippedArchive: false,
      maxSize: "20m",
      maxFiles: "3",
      createSymlink: true,
      symlinkName: "../logs/combined.log",
      auditFile: "../logs/combined-audit.json",
      level: "info",
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
    }),
    new winstonRotateFile({
      filename: "../logs/error-%DATE%.log",
      datePattern: "YYYY-MM",
      zippedArchive: false,
      maxSize: "20m",
      maxFiles: "3",
      createSymlink: true,
      symlinkName: "../logs/error.log",
      auditFile: "../logs/error-audit.json",
      level: "warn",
      handleExceptions: true,
      format: winston.format.combine(
        winston.format.timestamp({
          format: "YYYY-MM-DD HH:mm:ss",
        }),
        winston.format.printf(
          (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
        )
      ),
    }),
  ],
});

// Deal with just generating a config
if (process.argv.includes("--reset-config")) {
  utils.logger.warn("Resetting to default configuration.");
  configManager.initConfig();
  utils.logger.log("debug", "Configuration reset. Exiting.");
  process.exit(0);
}

// Just log the default config
if (process.argv.includes("--show-default-config")) {
  utils.logger.warn(
    `DEFAULT CONFIG:\n${JSON.stringify(configManager.defaultConfig, null, 2)}`
  );
  utils.logger.log("debug", "Exiting.");
  process.exit(0);
}

// config must be loaded after the logger is initialized
configManager.loadConfig();

if (
  "discordLogging" in configManager.config &&
  (configManager.config.discordLogging.active ?? true)
) {
  // Logger setup
  const webhookRegex = new RegExp(
    /^https:\/\/discord.com\/api\/webhooks\/(.+)\/(.+)$/,
    "g"
  );
  const webhookParts = webhookRegex.exec(process.env.WINSTON_DISCORD_WEBHOOK);
  if (!webhookParts) {
    utils.logger.warn(
      "Invalid Discord Webhook provided. Not enabling Discord logging."
    );
  } else {
    utils.logger.add(
      new winstonDiscord({
        id: webhookParts[1],
        token: webhookParts[2],
        level: configManager.config.discordLogging.level || "warn",
        format: winston.format.combine(
          winston.format.timestamp({
            format: "YYYY-MM-DD HH:mm:ss",
          }),
          winston.format.printf(
            (info) => `[${info.timestamp}] [${info.level}] ${info.message}`
          )
        ),
        handleExceptions: true,
      })
    );
  }
}

// starting the bot
const bot = new Client({
  intents: [
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.DirectMessageReactions,
  ],
  partials: [Partials.Channel],
});

bot.on("ready", async () => {
  // when loaded (ready event)
  let desc;
  let type;
  if (!("activity" in configManager.config)) {
    desc = "nil";
    type = "PLAYING";
  } else {
    desc = configManager.config.activity.description || "nil";
    type = (configManager.config.activity.type || "PLAYING").toUpperCase();
  }
  bot.user.setActivity(desc, {
    type: type,
  });
  pluginManager.load();
  utils.logger.log("debug", "Starting Crons...");
  pluginManager.startCrons();
  utils.logger.log("debug", `${bot.user.username} is ready...`);
  console.info(`${bot.user.username} is ready...`);
});

// on message recieved
bot.on("messageCreate", async (message) => {
  if (message.partial) {
    message = await message.fetch();
  }

  // Send message on to plugins
  for (plugin of Object.values(utils.plugins.message)) {
    await plugin.processMessage(bot, message);
  }

  if (message.channel.type === "DM" && message.author.id != bot.user.id) {
    //TODO
    utils.reply({ content: "Hello!" }, message);
    return;
  }

  // if it is a command
  if (message.content.charAt(0) === (configManager.config.prefix || "$")) {
    // Send command on to plugins
    const command = message.content.split(/\s/)[0].toLowerCase().slice(1);
    const args = message.content
      .substring(message.content.split(/\s/)[0].length)
      .slice(1);
    for (plugin of Object.values(utils.plugins.command)) {
      if (plugin.COMMANDS.includes(command)) {
        await plugin.processCommand(command, args, bot, message);
        return;
      }
    }
    utils.logger.log("debug", `No handler found for command ${command}`);
    return;
  }
});

bot.on("messageReactionAdd", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      utils.logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  for (plugin of Object.values(utils.plugins.reaction)) {
    await plugin.processReaction(bot, reaction, true);
  }
});

bot.on("messageReactionRemove", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      utils.logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  for (plugin of Object.values(utils.plugins.reaction)) {
    await plugin.processReaction(bot, reaction, false);
  }
});

// brings the bot online
bot.login(process.env.DISJS_BOT_TOKEN);
