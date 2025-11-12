import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { youTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
  const { fields, tempFilePath } = await parseFormData(req);

  try {
    const { token, playerId, visibility, title, description, fightIds: fightIdsJson, mode } = fields;

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

    // --- 3. Input Validation ---
    let fightIds: string[];
    try {
      fightIds = JSON.parse(fightIdsJson);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid fightIds data format.' }, { status: 400 });
    }

    if (!Array.isArray(fightIds) || fightIds.length === 0) {
      return NextResponse.json({ error: 'fightIds must be a non-empty array.' }, { status: 400 });
    }

    // --- 4. Upload & DB Creation Logic ---
    const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');
    if (!youtubeVideoId) throw new Error('YouTube upload failed to return an ID.');
    const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

    const createdVideoIds: string[] = [];

    if (mode === 'single') {
      // Create one video and link all fights to it
      const newWarVideo = await prisma.warVideo.create({
        data: {
          youtubeUrl,
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
          videoId: newWarVideo.id,
        },
      });
      createdVideoIds.push(newWarVideo.id);

    } else { // 'multiple' mode, though logic is similar for a single fight
      // Create one video and link the one fight to it
      const newWarVideo = await prisma.warVideo.create({
        data: {
          youtubeUrl,
          description,
          status: isTrusted ? 'PUBLISHED' : 'UPLOADED',
          visibility: visibility || 'public',
          submittedBy: { connect: { id: uploadToken.playerId } },
        },
      });

      await prisma.warFight.update({
        where: {
          id: fightIds[0], // In multiple mode, we process one fight at a time
        },
        data: {
          videoId: newWarVideo.id,
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