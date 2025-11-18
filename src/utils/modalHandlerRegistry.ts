import { ModalSubmitInteraction } from "discord.js";

export type ModalHandler = (
  interaction: ModalSubmitInteraction
) => Promise<void>;

const modalHandlers = new Map<string, ModalHandler>();

export function registerModalHandler(customId: string, handler: ModalHandler) {
  if (modalHandlers.has(customId)) {
    console.warn(`Overwriting modal handler for customId: ${customId}`);
  }
  modalHandlers.set(customId, handler);
}

export function getModalHandler(customId: string): ModalHandler | undefined {
  // Handle dynamic IDs (e.g., admin_attack_add_championname)
  for (const [key, handler] of modalHandlers.entries()) {
    if (customId.startsWith(key)) {
      return handler;
    }
  }
  return undefined;
}