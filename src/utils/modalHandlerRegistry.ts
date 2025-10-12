import { ModalSubmitInteraction } from "discord.js";

export type ModalHandler = (
  interaction: ModalSubmitInteraction
) => Promise<void>;

const modalHandlers = new Map<string, ModalHandler>();

export function registerModalHandler(prefix: string, handler: ModalHandler) {
  modalHandlers.set(prefix, handler);
}

export function getModalHandler(customId: string): ModalHandler | undefined {
  for (const [prefix, handler] of modalHandlers) {
    if (customId.startsWith(prefix)) return handler;
  }
  return undefined;
}
