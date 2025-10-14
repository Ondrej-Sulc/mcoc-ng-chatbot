import { SearchCoreParams, ChampionWithRelations, RosterEntryWithChampionRelations } from "../../types/search";

export type SearchCacheEntry = {
  criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">;
  pages: ChampionWithRelations[][];
};
export const searchCache = new Map<string, SearchCacheEntry>();

export type RosterSearchCacheEntry = {
  criteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">;
  pages: RosterEntryWithChampionRelations[][];
};
export const rosterSearchCache = new Map<string, RosterSearchCacheEntry>();
