import sharp from "sharp";
import { promises as fs } from "fs";
import * as path from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
// @ts-ignore
import { imageHash } from "image-hash";
import { ChampionGridCell, Vertex } from "./types";
import logger from "../../../services/loggerService";

export async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image from ${url}: ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getAverageColor(
  imageBuffer: Buffer
): Promise<{ r: number; g: number; b: number }> {
  const stats = await sharp(imageBuffer).stats();
  // stats.channels is an array of { min, max, sum, squares, mean, stdev } for each channel
  return {
    r: stats.channels[0].mean,
    g: stats.channels[1].mean,
    b: stats.channels[2].mean,
  };
}

export function getColorDistance(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
}

export async function getImageHash(imageBuffer: Buffer): Promise<string> {
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  const uniqueName = `image-hash-${randomBytes(16).toString("hex")}.png`;
  const tempPath = path.join(tmpdir(), uniqueName);

  try {
    await fs.writeFile(tempPath, pngBuffer);
    return await new Promise((resolve, reject) => {
      // @ts-ignore
      imageHash(tempPath, 16, true, (error: any, data: string) => {
        if (error) {
          logger.error({ err: error }, "Failed to generate image hash from buffer");
          return reject(error);
        }
        resolve(data);
      });
    });
  } finally {
    // Clean up the temporary file
    try {
      await fs.unlink(tempPath);
    } catch (e) {
      logger.warn({ err: e, tempPath }, "Failed to clean up temp image hash file");
    }
  }
}

export function compareHashes(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

export async function drawDebugBoundsOnImage(
  imageBuffer: Buffer,
  grid: ChampionGridCell[][],
  topBoundary: number
): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width || 0;

  // Grid bounds (lime)
  for (const row of grid) {
    for (const cell of row) {
      if (!cell.bounds || cell.bounds.length < 4) continue;
      const [topLeft, , bottomRight] = cell.bounds;
      const width = Math.abs(bottomRight.x - topLeft.x);
      const height = Math.abs(bottomRight.y - topLeft.y);

      if (width > 0 && height > 0) {
        const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="4" fill="none" /></svg>`;
        overlayElements.push({
          input: Buffer.from(svgRect),
          left: Math.round(topLeft.x),
          top: Math.round(topLeft.y),
        });
      }
    }
  }

  // Awakened check bounds (blue)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.awakenedCheckBounds) {
        const [topLeft, , bottomRight] = cell.awakenedCheckBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="blue" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Short name solve bounds (orange)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.shortNameSolveBounds) {
        const [topLeft, , bottomRight] = cell.shortNameSolveBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="orange" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Top boundary line (red)
  if (topBoundary > 0 && imageWidth > 0) {
    const svgLine = `<svg width="${imageWidth}" height="${metadata.height}"><line x1="0" y1="${topBoundary}" x2="${imageWidth}" y2="${topBoundary}" stroke="red" stroke-width="3" /></svg>`;
    overlayElements.push({
      input: Buffer.from(svgLine),
      top: 0,
      left: 0,
    });
  }

  // Inner portrait crop bounds (yellow)
  for (const row of grid) {
    for (const cell of row) {
      if (cell.innerPortraitCropBounds) {
        const [topLeft, , bottomRight] = cell.innerPortraitCropBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="yellow" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  // Best match image previews
  for (const row of grid) {
    for (const cell of row) {
      if (cell.bestMatchImageBuffer) {
        const [topLeft, topRight, ,] = cell.bounds;

        const resizedThumbnail = await sharp(cell.bestMatchImageBuffer)
          .resize(50, 50)
          .toBuffer();

        overlayElements.push({
          input: resizedThumbnail,
          left: Math.round(topRight.x - 50),
          top: Math.round(topLeft.y),
        });
      }
    }
  }

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}
