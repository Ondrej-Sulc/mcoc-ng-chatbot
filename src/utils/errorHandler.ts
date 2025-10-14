import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
  ModalSubmitInteraction,
} from "discord.js";
import { randomBytes } from "crypto";
import logger from "../services/loggerService";

export type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | ModalSubmitInteraction;

export interface ErrorContext {
  location?: string; // e.g., command name, service name
  userId?: string;
  extra?: Record<string, any>;
}

export function generateErrorId() {
  /**
   * Generates a random error ID.
   * @returns A random error ID string.
   */
  return randomBytes(4).toString("hex");
}

/**
 * Extracts all properties from an Error object for better logging.
 * @param error - The error to process.
 * @returns A plain object with all of the error's properties.
 */
function getErrorProperties(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }
  const plainObject: Record<string, any> = {};
  Object.getOwnPropertyNames(error).forEach((key) => {
    plainObject[key] = (error as any)[key];
  });
  return plainObject;
}

export function handleError(error: unknown, context: ErrorContext = {}) {
  /**
   * Handles an error by logging it and generating a user-friendly error message.
   * @param error - The error to handle.
   * @param context - The context in which the error occurred.
   * @returns An object containing the user-friendly error message and the error ID.
   */
  const errorId = generateErrorId();
  const errorMsg = error instanceof Error ? error.message : String(error);

  const logContext = {
    errorId,
    ...context,
    error: errorMsg,
    rawError: getErrorProperties(error), // Log the full error object for more details
  };

  logger.error(logContext, `[Error:${errorId}]`);

  // More professional user-facing message
  const userMessage =
    `❌ An unexpected error occurred. Our team has been notified. ` +
    `Please try again later. (Error ID: ${errorId})`;

  return { userMessage, errorId };
}

export async function safeReply(
  /**
   * Safely replies to an interaction, handling deferred and replied states.
   * @param interaction - The interaction to reply to.
   * @param userMessage - The message to send to the user.
   * @param errorId - The ID of the error, if any.
   */
  interaction: RepliableInteraction,
  userMessage: string,
  errorId?: string
) {
  const content = userMessage;
  try {
    if (interaction.isRepliable()) {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
      } else {
        await interaction.reply({ content, flags: [MessageFlags.Ephemeral] });
      }
    }
  } catch (err) {
    logger.error(
      { err, interactionId: interaction.id, interactionType: interaction.type },
      `[safeReply] Failed to reply to interaction`
    );
  }
}
