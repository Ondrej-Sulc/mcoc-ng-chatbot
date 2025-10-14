import { prisma } from "./prismaService";
import { Champion, Attack, Hit, ChampionAbilityLink, Ability } from "@prisma/client";
import { normalizeChampionName } from "../utils/championHelper";

export let championsByName = new Map<string, Champion>();
export let championList: Champion[] = [];

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  championsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  championList = allChampions;
  console.log(`Loaded ${allChampions.length} champions into cache.`);
}

export function getChampionByName(name: string): Champion | undefined {
  const normalized = normalizeChampionName(name);

  return championsByName.get(normalized);
}

// Define the expected type for an Attack with its related Hits.

// This is derived from the Prisma query include statement.

export type AttackWithHits = Attack & { hits: Hit[] };

// Define the expected type for a ChampionAbilityLink with its related Ability.

// This is derived from the Prisma query include statement.

export type ChampionAbilityLinkWithAbility = ChampionAbilityLink & {
  ability: Ability;
};

export type ChampionWithAllRelations = Champion & {
  attacks: AttackWithHits[];

  abilities: ChampionAbilityLinkWithAbility[];
};

export async function getChampionData(
  championName: string
): Promise<ChampionWithAllRelations | null> {
  return prisma.champion.findFirst({
    where: { name: { equals: championName, mode: "insensitive" } },

    include: {
      attacks: { include: { hits: true } },

      abilities: { include: { ability: true } },
    },
  }) as Promise<ChampionWithAllRelations | null>;
}


