import { ButtonInteraction } from "discord.js";

export type ButtonHandler = (interaction: ButtonInteraction) => Promise<void>;

const buttonHandlers = new Map<string, ButtonHandler>();
/**
 * A map that stores button handlers, using a prefix as the key.
 */

export function registerButtonHandler(prefix: string, handler: ButtonHandler) {
  /**
   * Registers a button handler for a given prefix.
   * @param prefix - The prefix to register the handler for.
   * @param handler - The handler function to execute when a button with the prefix is clicked.
   */
  buttonHandlers.set(prefix, handler);
}

export function getButtonHandler(customId: string): ButtonHandler | undefined {
  /**
   * Gets the button handler for a given custom ID.
   * @param customId - The custom ID of the button.
   * @returns The handler function for the button, or undefined if no handler is found.
   */
  for (const [prefix, handler] of buttonHandlers) {
    if (customId.startsWith(prefix)) return handler;
  }
  return undefined;
}
