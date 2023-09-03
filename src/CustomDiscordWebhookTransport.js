import DiscordWebhookTransport from "@typicalninja21/discord-winston";
import { logger } from "./utils.js";

// prettier-ignore
export default class CustomDiscordWebhookTransport extends DiscordWebhookTransport {
  log(info, callback) {
    try {
      if (info.postToDiscord == false) return callback();
      this.postToWebhook(info);
      return callback();
    } catch (e) {
      logger.error(`Error occurred trying to log to Discord: ${e.stack}`, {
        postToDiscord: false,
      });
    }
  }
};
