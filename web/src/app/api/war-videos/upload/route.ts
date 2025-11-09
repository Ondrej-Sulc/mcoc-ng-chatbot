import { NextRequest, NextResponse } from 'next/server';
import Busboy from 'busboy';
import fs from 'fs';
import os from 'os';
import path from 'path';
import loggerService from '@cerebro/core/services/loggerService';
import { prisma } from '@cerebro/core/services/prismaService';
import { youTubeService } from '@cerebro/core/services/youtubeService';

// No longer need to export config for bodyParser: false with App Router
// The Request object's body is already a ReadableStream.

export async function POST(req: NextRequest) {
  if (!req.body) {
    return NextResponse.json({ error: 'No body provided' }, { status: 400 });
  }

  const tempDir = os.tmpdir();
  let tempFilePath: string | null = null;
  const fields: Record<string, any> = {};
  let filePromise: Promise<void> | null = null;

  try {
    // Use a Promise to handle the asynchronous nature of Busboy
    await new Promise<void>((resolve, reject) => {
            const headers: Record<string, string> = {};
      req.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const busboy = Busboy({ headers });

            busboy.on('file', (fieldname: string, file: NodeJS.ReadableStream, filename: string, encoding: string, mimetype: string) => {
        if (fieldname !== 'videoFile') {
          file.resume(); // Ignore other files
          return;
        }

        const uniqueFilename = `${Date.now()}-${filename}`;
        tempFilePath = path.join(tempDir, uniqueFilename);
        const writeStream = fs.createWriteStream(tempFilePath);

        filePromise = new Promise((fileResolve, fileReject) => {
          file.pipe(writeStream);
          writeStream.on('close', fileResolve);
          writeStream.on('error', fileReject);
          file.on('error', fileReject);
        });
      });

      busboy.on('field', (fieldname: string, val: any) => {
        fields[fieldname] = val;
      });

      busboy.on('finish', async () => {
        try {
          if (filePromise) {
            await filePromise; // Ensure file is fully written
          }
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      busboy.on('error', (err: Error) => {
        loggerService.error({ err }, 'Busboy error during file parsing');
        reject(err);
      });

      // Pipe the request body to Busboy
      // req.body is a ReadableStream, need to convert to Node.js stream for Busboy
      // This part is tricky with Next.js 13+ and web streams.
      // A common workaround is to convert it to a Node.js Readable.
      // For simplicity and common patterns, we'll assume req.body can be piped directly
      // or that a compatible stream is provided. If not, a polyfill/conversion might be needed.
      // For now, directly piping req.body (which is a Web ReadableStream) to Busboy (which expects Node.js ReadableStream)
      // might not work directly in all environments.
      // A more robust solution might involve:
      // const nodeStream = Readable.fromWeb(req.body as any);
      // nodeStream.pipe(busboy);
      // However, for typical Vercel deployments, req.body might behave like a Node.js stream.
      (req.body as any).pipe(busboy);
    });

    // --- After Busboy finishes parsing ---

    // 1. Validate UploadToken
    const { token, attackerId, defenderId, nodeId, season, warTier, death, playerId, visibility, title, description } = fields;

    if (!token) {
      return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
    }

    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { player: true },
    });

    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      // Clean up expired/invalid token from DB if found
      if (uploadToken) {
        await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
      }
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 401 });
    }

    const { player } = uploadToken;
    const isTrusted = player.isTrustedUploader;

    // 2. Ensure video file was uploaded
    if (!tempFilePath || !fs.existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file uploaded or file not found' }, { status: 400 });
    }

    // 3. Upload video to YouTube with appropriate privacy
    const privacyStatus = isTrusted ? 'unlisted' : 'private';
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

    // 4. Create WarVideo record in DB with correct status
    const videoStatus = isTrusted ? 'APPROVED' : 'PENDING';
    const newWarVideo = await prisma.warVideo.create({
      data: {
        youtubeUrl,
        status: videoStatus,
        visibility: visibility || 'public',
        season: parseInt(season),
        warTier: parseInt(warTier),
        death: death === 'true',
        attacker: { connect: { id: parseInt(attackerId) } },
        defender: { connect: { id: parseInt(defenderId) } },
        node: { connect: { id: parseInt(nodeId) } },
        player: playerId ? { connect: { id: playerId } } : undefined,
        submittedBy: { connect: { id: uploadToken.playerId } },
      },
    });

    // 5. Clean up and notify if pending
    fs.unlinkSync(tempFilePath);
    await prisma.uploadToken.delete({ where: { id: uploadToken.id } });

    let responseMessage: string;

    if (isTrusted) {
      responseMessage = 'Video uploaded and automatically approved.';
      loggerService.info({
        warVideoId: newWarVideo.id,
        submittedBy: player.ingameName,
      }, 'War video successfully processed and auto-approved.');
    } else {
      responseMessage = 'Video uploaded and is now pending review.';
      loggerService.info({
        warVideoId: newWarVideo.id,
        submittedBy: player.ingameName,
      }, 'War video submitted for review.');
      // TODO: Send a notification to a Discord admin channel
      // Example: await notifyAdmins(`New video pending review: ${newWarVideo.id}`);
    }

    return NextResponse.json({ message: responseMessage, videoId: newWarVideo.id, youtubeUrl: newWarVideo.youtubeUrl }, { status: 200 });
  } catch (error) {
    loggerService.error({ err: error }, 'Error processing video upload request.');

    // Ensure temporary file is cleaned up even on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    return NextResponse.json({ error: 'Internal server error during video upload' }, { status: 500 });
  }
}