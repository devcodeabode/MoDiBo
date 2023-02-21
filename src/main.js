/**
 * @author Joshua Maxwell
 * @author Brandon Ingli
 * This file will start the bot.
 */

// dependencies
require("dotenv").config({
  path: process.argv.includes("--testing") ? "../.env.testing" : "../.env",
});
const { Client, Intents } = require("discord.js");
const winston = require("winston");
const winstonDiscord = require("./CustomDiscordWebhookTransport.js");
const winstonRotateFile = require("winston-daily-rotate-file");
const utils = require("./utils.js");
const configManager = require("./configManager");

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
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
  ],
  partials: ["CHANNEL"],
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
  utils.logger.log("debug", `${bot.user.username} is ready...`);
  console.info(`${bot.user.username} is ready...`);
});

// on message recieved
bot.on("messageCreate", async (message) => {
  if (message.partial) {
    message = await message.fetch();
  }

  if (message.channel.type === "DM" && message.author.id != bot.user.id) {
    //TODO
    utils.reply("Hello!", message);
    return;
  }

  // if it is a command
  if (message.content.charAt(0) === (configManager.config.prefix || "$")) {
    //TODO
    message.content.slice(1) === "err"
      ? utils.logger.error("This is an error!")
      : message.content.slice(1) === "info"
      ? utils.logger.log("info", "This is an info!")
      : utils.reply(
          utils.createEmbed(
            "Hello!",
            "This is a test message.",
            false,
            message.author.username,
            message.author.avatarURL()
          ),
          message
        );
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

  //TODO
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

  //TODO
});

// brings the bot online
bot.login(process.env.DISJS_BOT_TOKEN);
