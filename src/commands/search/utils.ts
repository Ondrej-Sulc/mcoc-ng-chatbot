import { ChampionWithRelations, RosterEntryWithChampionRelations } from "../../types/search";

export function isRosterEntry(
  champions: ChampionWithRelations[] | RosterEntryWithChampionRelations[]
): champions is RosterEntryWithChampionRelations[] {
  return champions.length > 0 && "champion" in champions[0];
}
