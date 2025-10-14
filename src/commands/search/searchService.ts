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
import { generateResponse, generateRosterResponse } from "./searchView";

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
  const { embed, row } = await generateRosterResponse(
    client,
    guild,
    champions,
    searchCriteria,
    totalChampions,
    currentPage,
    totalPages,
    searchId
  );

  return { embeds: [embed], components: row ? [row] : [] };
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
  const { embed, row } = await generateResponse(
    client,
    guild,
    champions,
    searchCriteria,
    totalChampions,
    currentPage,
    totalPages,
    searchId
  );

  return { embeds: [embed], components: row ? [row] : [] };
}

export function isRosterEntry(
  champions: ChampionWithRelations[] | RosterEntryWithChampionRelations[]
): champions is RosterEntryWithChampionRelations[] {
  return champions.length > 0 && "champion" in champions[0];
}
