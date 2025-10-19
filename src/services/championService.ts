import { prisma } from "./prismaService";
import {
  Champion,
  Attack,
  Hit,
  ChampionAbilityLink,
  Ability,
  Tag,
} from "@prisma/client";
import { normalizeChampionName } from "../utils/championHelper";

export let championsByName = new Map<string, Champion>();
export let championList: Champion[] = [];

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  championsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  championList = allChampions;
  console.log(`Loaded ${allChampions.length} champions into cache.`);
}

export async function getChampionByName(name: string) {
  return await prisma.champion.findUnique({ where: { name } });
}

export async function getChampionById(id: number) {
  return await prisma.champion.findUnique({ where: { id } });
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
  tags: Tag[];
};

export async function getChampionData(
  championName: string
): Promise<ChampionWithAllRelations | null> {
  return prisma.champion.findFirst({
    where: { name: { equals: championName, mode: "insensitive" } },

    include: {
      attacks: { include: { hits: true } },
      abilities: { include: { ability: true } },
      tags: true,
    },
  }) as Promise<ChampionWithAllRelations | null>;
}


