import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getFromCache } from '@/lib/cache';

export async function GET() {
  try {
    const nodes = await getFromCache('nodes', 3600, () => {
      return prisma.warNode.findMany({
        select: {
          id: true,
          nodeNumber: true,
          description: true,
        },
        orderBy: {
          nodeNumber: 'asc',
        },
      });
    });
    return NextResponse.json(nodes, { status: 200 });
  } catch (error) {
    console.error('Error fetching war nodes:', error);
    return NextResponse.json({ error: 'Failed to fetch war nodes' }, { status: 500 });
  }
}
