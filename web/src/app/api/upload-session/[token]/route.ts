import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { add } from 'date-fns';

export async function GET(
  request: NextRequest,
  context: { params: { token: string } }
) {
  const { token } = context.params;

  if (!token) {
    return NextResponse.json({ error: 'Missing session token' }, { status: 400 });
  }

  try {
    const session = await prisma.uploadSession.findUnique({
      where: { token },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found or expired' }, { status: 404 });
    }

    // Check if session has expired
    if (session.expiresAt < new Date()) {
      await prisma.uploadSession.delete({ where: { token } }); // Clean up expired session
      return NextResponse.json({ error: 'Session expired' }, { status: 404 });
    }

    // Fetch all WarFight details associated with this session
    const warFights = await prisma.warFight.findMany({
      where: {
        id: {
          in: session.fightIds,
        },
      },
      include: {
        war: true,
        player: true,
        attacker: true,
        defender: true,
        node: true,
        prefightChampions: true,
      },
    });

    // Delete the session after successful retrieval (single-use)
    await prisma.uploadSession.delete({ where: { token } });

    return NextResponse.json(warFights);
  } catch (error) {
    console.error('Error fetching upload session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
