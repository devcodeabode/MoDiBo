/**
 * Common Utilities
 */

const {
  Client,
  GuildChannel,
  User,
  Message,
  EmbedBuilder,
  ActionRowBuilder,
} = require("discord.js");
const configManager = require("./configManager");
let logger;

const COLORS = {
  PURPLE: 0x510c76,
  RED: 0xfc0004,
  GREEN: 0x00fc00,
  BLUE: 0x000088
};

// Time Constants for convenience
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

// Loaded Plugin storage
let plugins = {
  command: {},
  message: {},
  cron: {},
};

const DEFAULT_MESSAGE = {
  content: "",
  embeds: [],
  components: [],
};

/**
 * Builds a message to use in a slash command reply.
 * @param {Object} content The content to include in the message.
 * @param {string} content.content The string content of the message.
 * @param {EmbedBuilder[]} content.embeds Embeds for the message.
 * @param {ActionRowBuilder[]} content.components Components to attach to the message.
 * @param {boolean} [content.ephemeral=false] For slash commands, only the sender sees this message.
 * @param {User[]} [mention=null] An array of users to mention. Will add to the beginning of the content (even for embeds)
 * @returns {Object} Message Payload
 */
function buildMessage(content, mention = null) {
  let messageData = { ...DEFAULT_MESSAGE, ephemeral: false, ...content };

  if (mention && mention.length > 0) {
    mentionFiltered = mention.filter((i) => !!i);
    if (mentionFiltered.length > 0) {
      let mentionString = "";
      for (const user of mentionFiltered) {
        mentionString += `${user} `;
      }
      messageData.content = `${mentionString}${messageData.content ?? ""}`;
    }
  }

  return messageData;
}

/**
 * Send a message to a channel of your choice.
 * @param {Object} content The content to include in the message.
 * @param {string} content.content The string content of the message.
 * @param {EmbedBuilder[]} content.embeds Embeds for the message.
 * @param {ActionRowBuilder[]} content.components Components to attach to the message.
 * @param {boolean} [content.ephemeral=false] For slash commands, only the sender sees this message.
 * @param {int | GuildChannel | User} channel The channel ID to send this message to.
 * @param {Client} bot Instantiated Discord Client.
 * @param {User[]} [mention=null] An array of users to mention. Will add to the beginning of the content (even for embeds)
 * @throws "Invalid bot" if the bot is not properly provided.
 * @throws "Not a Channel ID" if a passed channel is not a GuildChannel, User, nor numeric string.
 */
async function send(content, channel, bot, mention = null) {
  if (!(bot instanceof Client)) {
    throw "Invalid bot";
  }
  let channelObj;
  if (channel instanceof GuildChannel) {
    channelObj = channel;
  } else if (channel instanceof User) {
    channelObj = channel;
  } else if (!/\d+/.test(channel)) {
    throw "Not a Channel ID";
  } else {
    channelObj = await bot.channels.fetch(channel);
  }

  messageData = this.buildMessage(content, mention);

  // prettier-ignore
  this.logger.log(
    "debug",
    `Sending message to channel #${channelObj.name} : ${JSON.stringify(messageData)}`
  );
  await channelObj.send(messageData);
}

/**
 * Reply to an inbound message.
 * @param {Object} content The content to include in the message.
 * @param {string} content.content The string content of the message.
 * @param {EmbedBuilder[]} content.embeds Embeds for the message.
 * @param {ActionRowBuilder[]} content.components Components to attach to the message.
 * @param {boolean} [content.ephemeral=false] Only the sender sees this message.
 * @param {Message} message The message object to reply to.
 * @param {boolean} [mention=false] Mention the user you're replying to.
 * @throws "Invalid message" if the message object is not properly provided.
 */
async function reply(content, message, mention = false) {
  if (!(message instanceof Message)) {
    throw "Invalid message";
  }

  let messageData = { ...DEFAULT_MESSAGE, ...content };

  messageData.allowedMentions = {};
  messageData.allowedMentions.repliedUser = mention;
  messageData.failIfNotExists = false;

  // prettier-ignore
  this.logger.log(
    "debug",
    `Replying to ${message.url} : ${JSON.stringify(messageData)}`
  );
  await message.reply(messageData);
}

const DEFAULT_EMBED = {
  title: null,
  content: null,
  image: null,
  monotype: false,
  footer: null,
  footerImageURL: null,
  color: null,
  additionalFields: [],
};

/**
 *
 * @param {Object} options Options to build the embed
 * @param {string} options.title Title of the embed
 * @param {string} options.content Content for the embed
 * @param {string} options.image} URL for Image to display on the embed
 * @param {string} options.thumbnail} URL for Thumbnail Image to display on the embed
 * @param {string} options.monotype Wrap content in a yaml codeblock to display in monotype
 * @param {string} options.footer Footer text
 * @param {string} options.footerImageURL URL to an image to display in the footer next to the text
 * @param {COLORS} [options.color] Color for the embed. If not defined in enum, embed will the color set in the config, or Green if that doesn't exist.
 * @param {APIEmbedField[]} options.additionalFields Additional fields to display on the embed, up to 25
 * @param {string} options.additionalFields[].name Heading for the field
 * @param {string} options.additionalFields[].value Content for the field
 * @param {boolean} [options.additionalFields[].inline=false] Show inline with other fields. When false, forces field to be on own line.
 * @returns {EmbedBuilder} Embed to send on via another function.
 */
function createEmbed(options = DEFAULT_EMBED) {
  options = { ...DEFAULT_EMBED, ...options };

  if (!Object.values(COLORS).includes(options.color)) {
    options.color = COLORS[(configManager.config.color ?? "GREEN").toUpperCase()]
  }
  return new EmbedBuilder()
    .setColor(options.color)
    .setTitle(options?.title ? `${options.title}` : null)
    .setImage(options.image)
    .setThumbnail(options.thumbnail)
    .setDescription(
      options?.content
        ? options?.monotype
          ? `\`\`\`yaml\n${options.content}\n\`\`\``
          : `${options.content}`
        : null
    )
    .setFooter({ text: options?.footer ? `${options.footer}` : null, iconURL: options.footerImageURL })
    .addFields(...options["additionalFields"]);
}

module.exports = {
  SECOND,
  MINUTE,
  HOUR,
  COLORS,
  buildMessage,
  send,
  reply,
  createEmbed,
  logger,
  plugins,
};
