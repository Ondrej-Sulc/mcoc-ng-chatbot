import { StringSelectMenuInteraction } from "discord.js";
import { handleDuelReportSelect } from "../commands/champion/duelHandlers";

export type SelectMenuHandler = (
  interaction: StringSelectMenuInteraction
) => Promise<void>;

const selectMenuHandlers = new Map<string, SelectMenuHandler>();

registerSelectMenuHandler("champion-duel-report-select_", handleDuelReportSelect);

export function registerSelectMenuHandler(
  prefix: string,
  handler: SelectMenuHandler
) {
  selectMenuHandlers.set(prefix, handler);
}

export function getSelectMenuHandler(
  customId: string
): SelectMenuHandler | undefined {
  for (const [prefix, handler] of selectMenuHandlers) {
    if (customId.startsWith(prefix)) return handler;
  }
  return undefined;
}
