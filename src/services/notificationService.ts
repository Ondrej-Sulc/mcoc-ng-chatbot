import {
  ButtonInteraction,
  EmbedBuilder,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  TextChannel,
} from "discord.js";
import logger from "./loggerService";

export async function sendDuelNotification(
  interaction:
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
  embed: EmbedBuilder
) {
  const channelId = process.env.ADMIN_LOG_CHANNEL_ID;
  if (!channelId) {
    logger.warn(
      "ADMIN_LOG_CHANNEL_ID is not set. Cannot send duel notification."
    );
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(error, "Failed to send duel notification");
  }
}
