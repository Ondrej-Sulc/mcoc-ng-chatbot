import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cerebro/core/services/prismaService';
import loggerService from '@cerebro/core/services/loggerService';
import { youTubeService } from '@cerebro/core/services/youtubeService';

export async function POST(req: NextRequest) {
  // TODO: Add authentication to ensure only admins can access this endpoint
  try {
    const { videoId } = await req.json();

    if (!videoId) {
      return NextResponse.json({ error: 'Missing videoId' }, { status: 400 });
    }

    const warVideo = await prisma.warVideo.findUnique({
      where: { id: videoId },
    });

    if (!warVideo) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    // Delete from YouTube
    const youtubeId = youTubeService.getVideoId(warVideo.youtubeUrl);
    if (youtubeId) {
      await youTubeService.deleteVideo(youtubeId);
    }

    // Delete from DB
    await prisma.warVideo.delete({
      where: { id: videoId },
    });

    loggerService.info({ videoId }, 'War video rejected and deleted');
    return NextResponse.json({ message: 'Video rejected and deleted' }, { status: 200 });
  } catch (error) {
    loggerService.error({ err: error }, 'Error rejecting video');
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
