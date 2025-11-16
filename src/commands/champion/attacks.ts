import { ChampionWithAllRelations } from "../../services/championService";
import { formatAttacks } from "./view";

export function getAttacksContent(
  champion: ChampionWithAllRelations
): string {
  return formatAttacks(champion.attacks, 'detailed');
}
