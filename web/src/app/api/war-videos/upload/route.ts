import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@cerebro/core/services/prismaService';
import { youTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const { fields, tempFilePath } = await parseFormData(req);

  try {
    const { token, season, warNumber, warTier, playerId, visibility, title, description, fights: fightsJson, mode } = fields;

    if (!token) {
      return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
    }

    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { player: true },
    });

    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      if (uploadToken) {
        await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
      }
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 401 });
    }

    const { player } = uploadToken;
    const isTrusted = player.isTrustedUploader;

    if (!tempFilePath || !existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file uploaded or file not found' }, { status: 400 });
    }

    const fights = JSON.parse(fightsJson);
    const createdVideoIds: string[] = [];

    if (mode === 'single') {
      // 1. Upload video to YouTube ONCE
      const privacyStatus = 'unlisted';
      const youtubeVideoId = await youTubeService.uploadVideo(
        tempFilePath,
        title || `MCOC War Video - ${player.ingameName}`,
        description || `War video submitted by ${player.ingameName}`,
        privacyStatus
      );

      if (!youtubeVideoId) {
        return NextResponse.json({ error: 'Failed to upload video to YouTube' }, { status: 500 });
      }
      const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

      // 2. Loop through fights and create a DB record for each
      for (const fight of fights) {
        const { attackerId, defenderId, nodeId, death, prefightChampionIds } = fight;
        const videoStatus = isTrusted ? 'APPROVED' : 'PENDING';
        const newWarVideo = await prisma.warVideo.create({
          data: {
            youtubeUrl, // Use the same URL for all
            status: videoStatus,
            visibility: visibility || 'public',
            season: parseInt(season),
            warNumber: warNumber ? parseInt(warNumber) : null,
            warTier: parseInt(warTier),
            death: death,
            attacker: { connect: { id: parseInt(attackerId) } },
            defender: { connect: { id: parseInt(defenderId) } },
            node: { connect: { id: parseInt(nodeId) } },
            player: playerId ? { connect: { id: playerId } } : undefined,
            submittedBy: { connect: { id: uploadToken.playerId } },
            prefightChampions: {
              connect: prefightChampionIds.map((id: string) => ({ id: parseInt(id) })),
            },
          },
        });
        createdVideoIds.push(newWarVideo.id);
      }
    } else { // 'multiple' mode
      // The frontend sends one fight at a time, so fights array will have 1 element
      const fight = fights[0];
      const { attackerId, defenderId, nodeId, death, prefightChampionIds } = fight;

      const privacyStatus = 'unlisted';
      const youtubeVideoId = await youTubeService.uploadVideo(
        tempFilePath,
        title || `MCOC War Video - ${player.ingameName}`,
        description || `War video submitted by ${player.ingameName}`,
        privacyStatus
      );

      if (!youtubeVideoId) {
        return NextResponse.json({ error: 'Failed to upload video to YouTube' }, { status: 500 });
      }
      const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

      const videoStatus = isTrusted ? 'APPROVED' : 'PENDING';
      const newWarVideo = await prisma.warVideo.create({
        data: {
          youtubeUrl,
          status: videoStatus,
          visibility: visibility || 'public',
          season: parseInt(season),
          warNumber: warNumber ? parseInt(warNumber) : null,
          warTier: parseInt(warTier),
          death: death,
          attacker: { connect: { id: parseInt(attackerId) } },
          defender: { connect: { id: parseInt(defenderId) } },
          node: { connect: { id: parseInt(nodeId) } },
          player: playerId ? { connect: { id: playerId } } : undefined,
          submittedBy: { connect: { id: uploadToken.playerId } },
          prefightChampions: {
            connect: prefightChampionIds.map((id: string) => ({ id: parseInt(id) })),
          },
        },
      });
      createdVideoIds.push(newWarVideo.id);
    }

    // 5. Delete the temporary file
    await fs.unlink(tempFilePath);

    return NextResponse.json({ message: 'Videos uploaded successfully', videoIds: createdVideoIds }, { status: 200 });
  } catch (error: any) {
    console.error('War video upload error:', error);
    // Ensure the temporary file is deleted even if an error occurs
    if (tempFilePath && existsSync(tempFilePath)) {
      await fs.unlink(tempFilePath);
    }

    // Check for specific YouTube API quota error
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      const youtubeError = error.errors[0];
      if (youtubeError.reason === 'uploadLimitExceeded' || youtubeError.reason === 'quotaExceeded') {
        return NextResponse.json({ error: 'YouTube Upload Quota Exceeded', details: youtubeError.message }, { status: 429 }); // 429 Too Many Requests
      }
    }

    return NextResponse.json({ error: 'Failed to upload war video', details: error.message }, { status: 500 });
  }
}