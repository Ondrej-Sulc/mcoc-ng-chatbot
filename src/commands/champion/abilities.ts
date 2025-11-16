import {
  ChampionWithAllRelations,
  ChampionAbilityLinkWithRelations,
} from "../../services/championService";
import { formatAbilities } from "./view";

export function getAbilitiesContent(
  champion: ChampionWithAllRelations,
  resolveEmoji: (text: string) => string
): string {
  const relevantAbilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithRelations) => a.type === "ABILITY"
  );

  return formatAbilities(relevantAbilities, resolveEmoji);
}
