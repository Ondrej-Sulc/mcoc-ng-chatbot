import {
  ChampionWithAllRelations,
  ChampionAbilityLinkWithRelations,
} from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR, formatAbilities } from "./view";

export function handleAbilities(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const relevantAbilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "ABILITY"
  );

  const formattedAbilities = formatAbilities(relevantAbilities, resolveEmoji);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedAbilities)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
