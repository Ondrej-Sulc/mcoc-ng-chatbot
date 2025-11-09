import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromCache } from '@/lib/cache';

export async function GET() {
  try {
    const champions = await getFromCache('championsWithImages', 3600, () => {
      return prisma.champion.findMany({
    select: {
      id: true,
      name: true,
      images: true,
      abilities: {
        select: {
          ability: {
            select: {
              name: true,
            },
          },
        },
      },
    },
        orderBy: {
          name: 'asc',
        },
      });
    });
    return NextResponse.json(champions, { status: 200 });
  } catch (error) {
    console.error('Error fetching champions:', error);
    return NextResponse.json({ error: 'Failed to fetch champions' }, { status: 500 });
  }
}
