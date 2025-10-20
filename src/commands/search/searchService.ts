import {
  Client,
  Guild,
} from "discord.js";
import { CommandResult } from "../../types/command";
import {
  ChampionWithRelations,
  RosterEntryWithChampionRelations,
  SearchCoreParams,
} from "../../types/search";
import { generateChampionResponse } from "./views/championView";
import { generateRosterResponse } from "./views/rosterView";

export async function rosterCore(
  client: Client,
  guild: Guild | null,
  champions: RosterEntryWithChampionRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string,
  userId: string
): Promise<CommandResult> {
  return await generateRosterResponse(
    client,
    guild,
    champions,
    searchCriteria,
    totalChampions,
    currentPage,
    totalPages,
    searchId
  );
}

export async function core(
  client: Client,
  guild: Guild | null,
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string,
  userId: string
): Promise<CommandResult> {
  return await generateChampionResponse(
    client,
    guild,
    champions,
    searchCriteria,
    totalChampions,
    currentPage,
    totalPages,
    searchId
  );
}

export function isRosterEntry(
  champions: ChampionWithRelations[] | RosterEntryWithChampionRelations[]
): champions is RosterEntryWithChampionRelations[] {
  return champions.length > 0 && "champion" in champions[0];
}