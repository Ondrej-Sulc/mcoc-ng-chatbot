import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { youTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const { fields, tempFilePath } = await parseFormData(req);

  try {
    const { token, season, warNumber, warTier, playerId, visibility, title, description, fights: fightsJson, mode } = fields;

    // --- 1. Authentication & Authorization ---
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

    // --- 2. File Validation ---
    if (!tempFilePath || !existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file uploaded or file not found' }, { status: 400 });
    }

    // --- 3. Input Validation & Sanitization ---
    let fights;
    try {
      fights = JSON.parse(fightsJson);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid fights data format.' }, { status: 400 });
    }

    if (!Array.isArray(fights) || fights.length === 0) {
      return NextResponse.json({ error: 'Fights data must be a non-empty array.' }, { status: 400 });
    }

    const numSeason = parseInt(season, 10);
    const numWarTier = parseInt(warTier, 10);
    const numWarNumber = warNumber ? parseInt(warNumber, 10) : null;

    if (isNaN(numSeason) || isNaN(numWarTier)) {
      return NextResponse.json({ error: 'Season and War Tier must be valid numbers.' }, { status: 400 });
    }
    if (warNumber && numWarNumber === null) { // Check for NaN on optional warNumber
        return NextResponse.json({ error: 'War Number must be a valid number.' }, { status: 400 });
    }

    // --- 4. Upload & DB Creation Logic ---
    const createdVideoIds: string[] = [];

    if (mode === 'single') {
      const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');
      if (!youtubeVideoId) throw new Error('YouTube upload failed to return an ID.');
      const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

      const createOperations = fights.map(fight => {
        const numAttackerId = parseInt(fight.attackerId, 10);
        const numDefenderId = parseInt(fight.defenderId, 10);
        const numNodeId = parseInt(fight.nodeId, 10);
        if (isNaN(numAttackerId) || isNaN(numDefenderId) || isNaN(numNodeId)) {
          throw new Error(`Invalid ID for fight ${fight.id}.`);
        }
        const prefightIds = (fight.prefightChampionIds || []).map((id: string) => ({ id: parseInt(id, 10) })).filter((item: { id: number }) => !isNaN(item.id));

        return prisma.warVideo.create({
          data: {
            youtubeUrl,
            status: isTrusted ? 'APPROVED' : 'PENDING',
            visibility: visibility || 'public',
            season: numSeason,
            warNumber: numWarNumber,
            warTier: numWarTier,
            death: !!fight.death,
            attacker: { connect: { id: numAttackerId } },
            defender: { connect: { id: numDefenderId } },
            node: { connect: { id: numNodeId } },
            player: playerId ? { connect: { id: playerId } } : undefined,
            submittedBy: { connect: { id: uploadToken.playerId } },
            prefightChampions: { connect: prefightIds },
          },
        });
      });

      const createdVideos = await prisma.$transaction(createOperations);
      createdVideoIds.push(...createdVideos.map((video) => video.id));
    } else { // 'multiple' mode
      const fight = fights[0];
      const numAttackerId = parseInt(fight.attackerId, 10);
      const numDefenderId = parseInt(fight.defenderId, 10);
      const numNodeId = parseInt(fight.nodeId, 10);
      if (isNaN(numAttackerId) || isNaN(numDefenderId) || isNaN(numNodeId)) {
        return NextResponse.json({ error: `Invalid ID for fight ${fight.id}.` }, { status: 400 });
      }
      const prefightIds = (fight.prefightChampionIds || []).map((id: string) => parseInt(id, 10)).filter((id: number) => !isNaN(id));

      const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');
      if (!youtubeVideoId) throw new Error('YouTube upload failed to return an ID.');
      const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

      const newWarVideo = await prisma.warVideo.create({
        data: {
          youtubeUrl,
          status: isTrusted ? 'APPROVED' : 'PENDING',
          visibility: visibility || 'public',
          season: numSeason,
          warNumber: numWarNumber,
          warTier: numWarTier,
          death: !!fight.death,
          attacker: { connect: { id: numAttackerId } },
          defender: { connect: { id: numDefenderId } },
          node: { connect: { id: numNodeId } },
          player: playerId ? { connect: { id: playerId } } : undefined,
          submittedBy: { connect: { id: uploadToken.playerId } },
          prefightChampions: { connect: prefightIds.map((id: number) => ({ id })) },
        },
      });
      createdVideoIds.push(newWarVideo.id);
    }

    // --- 5. Cleanup ---
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