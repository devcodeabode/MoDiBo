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
  ApplicationCommandType,
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
  
  logger.log("debug", "Bot status set to online");
  
  await pluginManager.load();
  
  try {
    logger.log("debug", "Registering slash commands...");
    await registerSlashCommands(bot);
    logger.log("debug", "Slash commands registered successfully");
  } catch (error) {
    logger.error("Failed to register slash commands:", error);
  }
  
  logger.log("debug", "Starting Crons...");
  pluginManager.startCrons();
  logger.log("debug", `${bot.user.username} is ready...`);
  console.info(`${bot.user.username} is ready...`);
});

/**
 * Register slash commands for all plugins
 * @param {Discord.Client} bot The instantiated Discord Bot object
 */
async function registerSlashCommands(bot) {
  try {
    // Get all guilds the bot is in
    const guilds = bot.guilds.cache;
    
    logger.log("debug", `Found ${guilds.size} guilds to register slash commands in`);
    
    for (const [guildId, guild] of guilds) {
      logger.log("debug", `Registering slash commands for guild: ${guild.name} (${guildId})`);
      
      // Get all slash commands from plugins
      const commands = [];
      logger.log("silly", `plugins.slashCommand exists: ${!!plugins.slashCommand}`);
      if (plugins.slashCommand) {
        logger.log("silly", `plugins.slashCommand keys: ${Object.keys(plugins.slashCommand).join(', ')}`);
        for (const plugin of Object.values(plugins.slashCommand)) {
          logger.log("silly", `Plugin ${plugin.NAME} has SLASH_COMMANDS: ${!!plugin.SLASH_COMMANDS}`);
          if (plugin.SLASH_COMMANDS) {
            logger.log("silly", `Plugin ${plugin.NAME} SLASH_COMMANDS: ${plugin.SLASH_COMMANDS.map(cmd => cmd.name).join(', ')}`);
            commands.push(...plugin.SLASH_COMMANDS);
          }
        }
      }
      
      logger.log("debug", `Total commands to register: ${commands.length}`);
      if (commands.length > 0) {
        await guild.commands.set(commands);
        logger.log("debug", `Registered ${commands.length} slash commands for guild: ${guild.name}`);
      } else {
        logger.log("debug", `No slash commands to register for guild: ${guild.name}`);
      }
    }
  } catch (error) {
    logger.error("Error registering slash commands:", error);
    throw error;
  }
}

/**
 * Unregister slash commands for all plugins
 * @param {Discord.Client} bot The instantiated Discord Bot object
 */
async function unregisterSlashCommands(bot) {
  try {
    // Get all guilds the bot is in
    const guilds = bot.guilds.cache;
    
    for (const [guildId, guild] of guilds) {
      logger.log("debug", `Unregistering slash commands from guild: ${guild.name} (${guildId})`);
      
      // Get current slash commands for this guild
      const currentCommands = await guild.commands.fetch();
      
      // Filter to only remove our plugin's commands
      const commandsToRemove = [];
      if (plugins.slashCommand) {
        for (const plugin of Object.values(plugins.slashCommand)) {
          if (plugin.SLASH_COMMANDS) {
            for (const slashCommand of plugin.SLASH_COMMANDS) {
              const existingCommand = currentCommands.find(cmd => cmd.name === slashCommand.name);
              if (existingCommand) {
                commandsToRemove.push(existingCommand.id);
              }
            }
          }
        }
      }
      
      // Remove only our plugin's commands
      if (commandsToRemove.length > 0) {
        for (const commandId of commandsToRemove) {
          try {
            await guild.commands.delete(commandId);
            logger.log("debug", `Removed slash command: ${commandId}`);
          } catch (deleteError) {
            logger.error(`Failed to remove slash command ${commandId}:`, deleteError);
          }
        }
        logger.log("debug", `Unregistered ${commandsToRemove.length} slash commands from guild: ${guild.name}`);
      } else {
        logger.log("debug", `No slash commands to remove from guild: ${guild.name}`);
      }
    }
  } catch (error) {
    logger.error("Error unregistering slash commands:", error);
    throw error;
  }
}

// Handle slash command interactions
bot.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    try {
      const commandName = interaction.commandName;
      
      // Find the plugin that handles this command
      if (plugins.slashCommand) {
        for (const plugin of Object.values(plugins.slashCommand)) {
          if (plugin.SLASH_COMMANDS) {
            // Check if any of the plugin's slash commands match the command name
            const hasCommand = plugin.SLASH_COMMANDS.some(cmd => cmd.name === commandName);
            if (hasCommand && plugin.processSlashCommand) {
              await plugin.processSlashCommand(interaction, bot);
              return;
            }
          }
        }
      }
      
      // If no plugin handles this command, reply with an error
      await interaction.reply({
        content: "This slash command is not implemented yet.",
        ephemeral: true
      });
    } catch (error) {
      logger.error("Error handling slash command interaction:", error);
      try {
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true
        });
      } catch (replyError) {
        logger.error("Error sending error reply:", replyError);
      }
    }
  } else if (interaction.isButton()) {
    try {
      // Handle button interactions from slash command plugins
      if (plugins.slashCommand) {
        for (const plugin of Object.values(plugins.slashCommand)) {
          if (plugin.handleButtonInteraction) {
            await plugin.handleButtonInteraction(interaction, bot);
            return;
          }
        }
      }
      
      // If no plugin handles this button, log it
      logger.log("debug", `Unhandled button interaction: ${interaction.customId}`);
    } catch (error) {
      logger.error("Error handling button interaction:", error);
      try {
        await interaction.reply({
          content: "There was an error while processing this button!",
          ephemeral: true
        });
      } catch (replyError) {
        logger.error("Error sending error reply:", replyError);
      }
    }
  }
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

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.log("debug", "Received SIGINT, shutting down gracefully...");
  await gracefulShutdown();
});

process.on('SIGTERM', async () => {
  logger.log("debug", "Received SIGTERM, shutting down gracefully...");
  await gracefulShutdown();
});

/**
 * Gracefully shutdown the bot and cleanup resources
 */
async function gracefulShutdown() {
  try {
    logger.log("debug", "Starting graceful shutdown...");
    
    // Set bot status to invisible/offline
    if (bot && bot.user) {
      bot.user.setPresence({
        status: 'invisible',
        activities: []
      });
      logger.log("debug", "Bot status set to invisible");
    }
    
    // Unregister slash commands globally
    try {
      logger.log("debug", "Unregistering slash commands...");
      await unregisterSlashCommands(bot);
      logger.log("debug", "Slash commands unregistered successfully");
    } catch (error) {
      logger.error("Failed to unregister slash commands:", error);
    }
    
    // Unload all plugins
    if (pluginManager.unload) {
      await pluginManager.unload(bot);
    }
    
    // Destroy the bot
    if (bot) {
      bot.destroy();
      logger.log("debug", "Bot destroyed");
    }
    
    logger.log("debug", "Graceful shutdown completed");
    process.exit(0);
  } catch (error) {
    logger.error("Error during graceful shutdown:", error);
    process.exit(1);
  }
}
