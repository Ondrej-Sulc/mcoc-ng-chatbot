import { PrismaClient, Champion } from '@prisma/client';
import { normalizeChampionName } from '../utils/championHelper';

const prisma = new PrismaClient();

export let championsByName = new Map<string, Champion>();

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  championsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  console.log(`Loaded ${allChampions.length} champions into cache.`);
}

export function getChampionByName(name: string): Champion | undefined {
  const normalized = normalizeChampionName(name);
  return championsByName.get(normalized);
}