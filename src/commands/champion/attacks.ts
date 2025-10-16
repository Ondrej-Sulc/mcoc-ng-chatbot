import { ChampionWithAllRelations } from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR, formatAttacks } from "./view";

export function handleAttacks(
  champion: ChampionWithAllRelations
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const formattedAttacks = formatAttacks(champion.attacks);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedAttacks)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
