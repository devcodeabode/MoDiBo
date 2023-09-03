/**
 * @author Joshua Maxwell
 * @author Brandon Ingli
 * This file will start the bot.
 */

// dependencies
import dotenv from 'dotenv';
dotenv.config({
  path: process.argv.includes("--testing") ? "../.env.testing" : "../.env",
});
import djs from 'discord.js';
const {
  Client,
  Intents,
  GatewayIntentBits,
  Partials,
  ChannelType,
  ActivityType,
} = djs;
import winston from "winston";
import winstonDiscord from "./CustomDiscordWebhookTransport.js";
import winstonRotateFile from "winston-daily-rotate-file";
import { logger, setLogger, plugins, reply } from "./utils.js";
import { loadConfig, defaultConfig, initConfig, config } from "./configManager.js";
import pluginManager from "./pluginManager.js";
const consoleLogLevel = process.env.CONSOLE_LOG_LEVEL ?? "warn";

setLogger(winston.createLogger({
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
}));

// Deal with just generating a config
if (process.argv.includes("--reset-config")) {
  logger.warn("Resetting to default configuration.");
  initConfig();
  logger.log("debug", "Configuration reset. Exiting.");
  process.exit(0);
}

// Just log the default config
if (process.argv.includes("--show-default-config")) {
  logger.warn(
    `DEFAULT CONFIG:\n${JSON.stringify(defaultConfig, null, 2)}`
  );
  logger.log("debug", "Exiting.");
  process.exit(0);
}

// config must be loaded after the logger is initialized
loadConfig();
if (
  "discordLogging" in config &&
  (config.discordLogging.active ?? true)
) {
  // Logger setup
  const webhookRegex = new RegExp(
    /^https:\/\/discord.com\/api\/webhooks\/(.+)\/(.+)$/,
    "g"
  );
  const webhookParts = webhookRegex.exec(process.env.WINSTON_DISCORD_WEBHOOK);
  if (!webhookParts) {
    logger.warn(
      "Invalid Discord Webhook provided. Not enabling Discord logging."
    );
  } else {
    logger.add(
      new winstonDiscord({
        id: webhookParts[1],
        token: webhookParts[2],
        level: config.discordLogging.level || "warn",
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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

bot.on("ready", async () => {
  // when loaded (ready event)
  let desc;
  let type;
  if ("activity" in config) {
    desc = config.activity.description || "";
    type = (config.activity.type || "Playing");
  }
  bot.user.setPresence({
    status: 'online',
    activities: ("activity" in config)
      ? [{
        name: desc,
        type: ActivityType?.[type] ?? ActivityType.Playing
      }]
      : []
  });
  pluginManager.load();
  logger.log("debug", "Starting Crons...");
  pluginManager.startCrons();
  logger.log("debug", `${bot.user.username} is ready...`);
  console.info(`${bot.user.username} is ready...`);
});

// on message recieved
bot.on("messageCreate", async (message) => {
  if (message.partial) {
    message = await message.fetch();
  }

  // Send message on to plugins
  for (const plugin of Object.values(plugins.message)) {
    await plugin.processMessage(bot, message);
  }

  if (message.channel.type === "DM" && message.author.id != bot.user.id) {
    //TODO
    reply({ content: "Hello!" }, message);
    return;
  }

  // if it is a command
  if (message.content.charAt(0) === (config.prefix || "$")) {
    // Send command on to plugins
    const command = message.content.split(/\s/)[0].toLowerCase().slice(1);
    const args = message.content
      .substring(message.content.split(/\s/)[0].length)
      .slice(1);
    for (const plugin of Object.values(plugins.command)) {
      if (plugin.COMMANDS.includes(command)) {
        await plugin.processCommand(command, args, bot, message);
        return;
      }
    }
    logger.log("debug", `No handler found for command ${command}`);
    return;
  }
});

bot.on("messageReactionAdd", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
      if (reaction.message.partial) {
        await reaction.message.fetch();
      }
    } catch (error) {
      logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  for (const plugin of Object.values(plugins.reaction)) {
    await plugin.processReaction(bot, reaction, user, true);
  }
});

bot.on("messageReactionRemove", async (reaction, user) => {
  // When a reaction is received, check if the structure is partial
  if (reaction.partial) {
    // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
    try {
      await reaction.fetch();
    } catch (error) {
      logger.error(
        `Something went wrong when fetching the message: ${error}`
      );
      // Return as `reaction.message.author` may be undefined/null
      return;
    }
  }

  for (const plugin of Object.values(plugins.reaction)) {
    await plugin.processReaction(bot, reaction, user, false);
  }
});

// brings the bot online
bot.login(process.env.DISJS_BOT_TOKEN);
