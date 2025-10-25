import { ChampionWithAllRelations, ChampionAbilityLinkWithRelations } from "../../services/championService";
import { ContainerBuilder, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../../types/command";
import { CLASS_COLOR, formatImmunities } from "./view";

export function handleImmunities(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const relevantAbilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "IMMUNITY"
  );

  const formattedImmunities = formatImmunities(relevantAbilities, resolveEmoji);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedImmunities)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}
