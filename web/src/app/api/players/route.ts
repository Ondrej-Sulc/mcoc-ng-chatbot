import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromCache } from '@/lib/cache';

export async function GET() {
  try {
    const players = await getFromCache('players', 3600, () => {
      return prisma.player.findMany({
        select: {
          id: true,
          ingameName: true,
        },
        orderBy: {
          ingameName: 'asc',
        },
      });
    });
    return NextResponse.json(players, { status: 200 });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}
