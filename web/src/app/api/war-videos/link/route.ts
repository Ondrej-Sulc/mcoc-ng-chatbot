import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, videoUrl, fightIds, description, visibility } = body;

    // 1. Authentication & Authorization
    if (!token) {
      return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
    }
    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { player: true },
    });
    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      if (uploadToken) await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 401 });
    }
    const { player } = uploadToken;
    const isTrusted = player.isTrustedUploader;

    // 2. Input Validation
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid videoUrl' }, { status: 400 });
    }
    if (!Array.isArray(fightIds) || fightIds.length === 0) {
      return NextResponse.json({ error: 'fightIds must be a non-empty array.' }, { status: 400 });
    }

    // 3. Upsert WarVideo and link to WarFights
    const warVideo = await prisma.warVideo.upsert({
      where: { url: videoUrl },
      update: {}, // If it exists, we don't need to update anything
      create: {
        url: videoUrl,
        description,
        status: isTrusted ? 'PUBLISHED' : 'UPLOADED',
        visibility: visibility || 'public',
        submittedBy: { connect: { id: uploadToken.playerId } },
      },
    });

    await prisma.warFight.updateMany({
      where: {
        id: { in: fightIds },
      },
      data: {
        videoId: warVideo.id,
      },
    });

    return NextResponse.json({ message: 'Video linked successfully', videoIds: [warVideo.id] }, { status: 200 });

  } catch (error: any) {
    console.error('War video link error:', error);
    return NextResponse.json({ error: 'Failed to link war video', details: error.message }, { status: 500 });
  }
}
