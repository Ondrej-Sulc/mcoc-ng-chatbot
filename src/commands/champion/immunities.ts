import { ChampionWithAllRelations, ChampionAbilityLinkWithRelations } from "../../services/championService";
import { formatImmunities } from "./view";

export function getImmunitiesContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): string {
  const relevantAbilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "IMMUNITY"
  );

  return formatImmunities(relevantAbilities, resolveEmoji);
}
