import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { randomBytes } from "crypto";

export type RepliableInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction;

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
    stack: error instanceof Error ? error.stack : undefined,
  };
  // Log with context
  console.error(`[Error:${errorId}] ${JSON.stringify(logContext)}`);
  // User message
  const userMessage =
    `❌ An error occurred${
      context.location ? ` in ${context.location}` : ""
    }. ` + `Please try again later. (Error ID: ${errorId})`;
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
    console.error(
      `[safeReply] Failed to reply to interaction (ID: ${
        interaction.id
      }, Type: ${interaction.type}): ${JSON.stringify(err)}`
    );
  }
}