const DiscordWebhookTransport = require("@typicalninja21/discord-winston");
const utils = require("./utils.js");

// prettier-ignore
module.exports = class CustomDiscordWebhookTransport extends DiscordWebhookTransport {
  log(info, callback) {
    try {
      if (info.postToDiscord == false) return callback();
      this.postToWebhook(info);
      return callback();
    } catch (e) {
      utils.logger.error(`Error occurred trying to log to Discord: ${e.stack}`, {
        postToDiscord: false,
      });
    }
  }
};
