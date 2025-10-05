import { PrismaClient, Champion, Tag, Ability } from '@prisma/client';
import { normalizeChampionName } from '../utils/championHelper';

const prisma = new PrismaClient();

let championsByName = new Map<string, Champion>();

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  championsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  console.log(`Loaded ${allChampions.length} champions into cache.`);
}

export function getChampionByName(name: string): Champion | undefined {
  const normalized = normalizeChampionName(name);
  return championsByName.get(normalized);
}

export function getChampionNames(): string[] {
  return Array.from(championsByName.keys());
}

export async function getAllTags(): Promise<Tag[]> {
  return await prisma.tag.findMany();
}

export async function getAllAbilities(): Promise<Ability[]> {
  return await prisma.ability.findMany();
}