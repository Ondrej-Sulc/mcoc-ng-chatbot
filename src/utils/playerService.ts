import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getPlayerThread(playerId: string): Promise<string | null> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });
  return player?.threadId || null;
}

export async function getAllPlayerThreads(): Promise<{ [key: string]: string }> {
  const players = await prisma.player.findMany();
  const threads: { [key: string]: string } = {};
  for (const player of players) {
    if (player.threadId) {
      threads[player.id] = player.threadId;
    }
  }
  return threads;
}
