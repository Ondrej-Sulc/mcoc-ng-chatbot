import sharp from 'sharp';
import { PrismaClient, Champion } from '@prisma/client';
import { v1 } from '@google-cloud/vision';
import Fuse from 'fuse.js';
// @ts-ignore
import { imageHash } from 'image-hash';
import { promises as fs } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';

import { config } from '../config';

import { getChampionImageUrl } from '../utils/championHelper';

const prisma = new PrismaClient();

if (!config.GOOGLE_CREDENTIALS_JSON) {
  throw new Error('GOOGLE_CREDENTIALS_JSON is not defined in the .env file.');
}
let credentials;
try {
  // Decode the Base64 string back to JSON string
  const decodedCredentialsString = Buffer.from(
    config.GOOGLE_CREDENTIALS_JSON,
    'base64'
  ).toString('utf8');
  // Parse the decoded JSON string
  credentials = JSON.parse(decodedCredentialsString);
} catch (error) {
  console.error(
    `Error loading/parsing Google credentials from environment variable:`,
    error
  );
  throw new Error(
    `Failed to load Google credentials. Check Base64 encoding in GitHub Secrets.`
  );
}
const visionClient = new v1.ImageAnnotatorClient({ credentials });

// --- Interfaces for data structures ---
type Vertex = { x: number; y: number };

interface OcrResult {
  text: string;
  bounds: Vertex[];
}

interface ChampionGridCell {
  bounds: Vertex[];
  championName?: string;
  powerRating?: string;
  isAwakened?: boolean;
  awakenedCheckBounds?: Vertex[];
  shortNameSolveBounds?: Vertex[];
}

export interface RosterDebugResult {
  message: string;
  imageBuffer?: Buffer;
  gridImageBuffer?: Buffer;
  ocrBoundsImageBuffer?: Buffer;
  awakenedCheckImageBuffer?: Buffer;
  shortNameSolveImageBuffer?: Buffer;
}

export async function processRosterScreenshot(
  imageUrl: string,
  stars: number,
  rank: number,
  debugMode: boolean = false,
  playerId?: string,
): Promise<string | RosterDebugResult> {
  if (debugMode) console.log(`[DEBUG] Starting roster processing for URL: ${imageUrl}`);

  // 1. Download image
  const imageBuffer = await downloadImage(imageUrl);
  if (debugMode) console.log(`[DEBUG] Image downloaded, size: ${imageBuffer.length} bytes`);

  // 2. Crop image
  // will implement later, for now just use full image, cropping will be dynamic based on if its full screenshot or just roster part

  // 3. Run OCR using Google Cloud Vision
  if (debugMode) console.log('[DEBUG] Sending image to Google Cloud Vision for OCR...');
  const [result] = await visionClient.textDetection(imageBuffer);
  const detections = result.textAnnotations;
  if (debugMode) console.log(`[DEBUG] OCR complete, ${detections?.length || 0} text annotations found.`);

  if (!detections || detections.length === 0) {
    return "Could not detect any text in the image.";
  }

  let ocrBoundsImageBuffer: Buffer | undefined;
  if (debugMode && detections) {
    console.log('[DEBUG] Drawing OCR bounds on image for debugging...');
    ocrBoundsImageBuffer = await drawOcrBoundsOnImage(imageBuffer, detections);
    console.log('[DEBUG] OCR bounds image created.');
  }

  // 4. Process OCR results
  const ocrResults = processOcrDetections(detections);
  if (debugMode) {
    console.log(`[DEBUG] Processed ${ocrResults.length} OCR results.`);
    // Log a sample of OCR results
    console.log('[DEBUG] OCR results sample:', ocrResults.slice(0, 50).map(r => r.text));
  }

  // 5. Estimate grid and parse champions
  if (debugMode) console.log('[DEBUG] Estimating champion grid...');
  let grid = await estimateGrid(ocrResults, imageBuffer, debugMode);
  if (debugMode) {
    console.log(`[DEBUG] Grid estimated with ${grid.length} rows and ${grid[0]?.length || 0} columns.`);
    console.log('[DEBUG] Parsed grid before name solving:\n' + gridToString(grid));
  }

  // Create debug image with grid
  let gridImageBuffer: Buffer | undefined;
  if (debugMode) {
    console.log('[DEBUG] Drawing grid on image for debugging...');
    gridImageBuffer = await drawGridOnImage(imageBuffer, grid);
    console.log('[DEBUG] Grid image created.');
  }

  // 6. Solve ambiguous short names
  if (debugMode) console.log('[DEBUG] Solving ambiguous short names...');
  grid = await solveShortNames(grid, imageBuffer);
  if (debugMode) console.log('[DEBUG] Short names solved.');

  let awakenedCheckImageBuffer: Buffer | undefined;
  if (debugMode) {
    console.log('[DEBUG] Drawing awakened check areas on image for debugging...');
    awakenedCheckImageBuffer = await drawAwakenedCheckOnImage(imageBuffer, grid);
    console.log('[DEBUG] Awakened check image created.');
  }

  let shortNameSolveImageBuffer: Buffer | undefined;
  if (debugMode) {
    console.log('[DEBUG] Drawing short name solve areas on image for debugging...');
    shortNameSolveImageBuffer = await drawShortNameSolveOnImage(imageBuffer, grid);
    console.log('[DEBUG] Short name solve image created.');
  }


  if (debugMode) {
    // In debug mode, return the string representation of the grid
    if (debugMode) console.log('[DEBUG] Debug mode enabled, skipping database save.');
    return {
      message: `--- DEBUG MODE --- 
Final parsed roster: 
${gridToString(grid)}`,
      imageBuffer: imageBuffer,
      gridImageBuffer: gridImageBuffer,
      ocrBoundsImageBuffer: ocrBoundsImageBuffer,
      awakenedCheckImageBuffer,
      shortNameSolveImageBuffer,
    };
  }

  if (!playerId) {
    throw new Error("playerId is required when not in debug mode.");
  }

  // 7. Save roster to database
  console.log(`Saving roster for player ${playerId}...`);
  const count = await saveRoster(grid, playerId, stars, rank);
  console.log(`${count} champions saved.`);

  return `Successfully added/updated ${count} champions to the roster.`;
}

async function saveRoster(grid: ChampionGridCell[][], playerId: string, stars: number, rank: number): Promise<number> {
  let count = 0;
  const allChampions = await prisma.champion.findMany();
  const championMap = new Map(allChampions.map(c => [c.name, c]));

  for (const row of grid) {
    for (const cell of row) {
      if (cell.championName) {
        const champion = championMap.get(cell.championName);
        if (champion) {
          await prisma.roster.upsert({
            where: { playerId_championId_stars: { playerId, championId: champion.id, stars } },
            update: { rank, isAwakened: cell.isAwakened || false },
            create: { playerId, championId: champion.id, stars, rank, isAwakened: cell.isAwakened || false },
          });
          count++;
        }
      }
    }
  }
  return count;
}

async function solveShortNames(grid: ChampionGridCell[][], imageBuffer: Buffer): Promise<ChampionGridCell[][]> {
  const allChampions = await prisma.champion.findMany();
  const championsByShortName = allChampions.reduce((acc, champ) => {
    if (!acc[champ.shortName]) {
      acc[champ.shortName] = [];
    }
    acc[champ.shortName].push(champ);
    return acc;
  }, {} as Record<string, Champion[]>);

  const ambiguousShortNames = Object.keys(championsByShortName).filter(key => championsByShortName[key].length > 1);

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName && ambiguousShortNames.includes(cell.championName)) {
        const possibleChampions = championsByShortName[cell.championName];
        const [topLeft, , bottomRight] = cell.bounds;
        
        const boxWidth = bottomRight.x - topLeft.x;
        const boxHeight = bottomRight.y - topLeft.y;

        const cropTop = boxHeight * 0;
        const cropBottom = boxHeight * 0.33;
        const cropLeft = boxWidth * 0.10;
        const cropRight = boxWidth * 0.10;

        const extractOptions = {
          left: Math.round(topLeft.x + cropLeft),
          top: Math.round(topLeft.y + cropTop),
          width: Math.round(boxWidth - cropLeft - cropRight),
          height: Math.round(boxHeight - cropTop - cropBottom)
        };

        cell.shortNameSolveBounds = [
            { x: extractOptions.left, y: extractOptions.top },
            { x: extractOptions.left + extractOptions.width, y: extractOptions.top },
            { x: extractOptions.left + extractOptions.width, y: extractOptions.top + extractOptions.height },
            { x: extractOptions.left, y: extractOptions.top + extractOptions.height }
        ];

        if (extractOptions.width <= 0 || extractOptions.height <= 0) {
            console.log(`[DEBUG] Skipping invalid extract region for ${cell.championName}`, extractOptions);
            continue;
        }

        const championImageBuffer = await sharp(imageBuffer)
          .extract(extractOptions)
          .toBuffer();

        // Second crop - 15% from all sides
        const champImageMetadata = await sharp(championImageBuffer).metadata();
        const champWidth = champImageMetadata.width || 0;
        const champHeight = champImageMetadata.height || 0;
        const champCropLeft = Math.floor(champWidth * 0.15);
        const champCropTop = Math.floor(champHeight * 0.15);
        const champCropWidth = Math.floor(champWidth * 0.70);
        const champCropHeight = Math.floor(champHeight * 0.70);

        const innerChampionImageBuffer = await sharp(championImageBuffer)
          .extract({ left: champCropLeft, top: champCropTop, width: champCropWidth, height: champCropHeight })
          .toBuffer();

        const championHash = await getImageHash(innerChampionImageBuffer);

        let bestMatch: Champion | null = null;
        let bestMatchScore = Infinity;

        for (const possibleChampion of possibleChampions) {
          const imageUrl = getChampionImageUrl(possibleChampion.images, 'full', 'primary');
          if (!imageUrl) {
            console.log(`[DEBUG] Skipping champion ${possibleChampion.name} due to missing official image URL.`);
            continue;
          }
          const officialImageBuffer = await downloadImage(imageUrl);

          // Second crop for official image
          const officialImageMetadata = await sharp(officialImageBuffer).metadata();
          const officialWidth = officialImageMetadata.width || 0;
          const officialHeight = officialImageMetadata.height || 0;
          const officialCropLeft = Math.floor(officialWidth * 0.15);
          const officialCropTop = Math.floor(officialHeight * 0.15);
          const officialCropWidth = Math.floor(officialWidth * 0.70);
          const officialCropHeight = Math.floor(officialHeight * 0.70);

          const innerOfficialImageBuffer = await sharp(officialImageBuffer)
            .extract({ left: officialCropLeft, top: officialCropTop, width: officialCropWidth, height: officialCropHeight })
            .toBuffer();

          const officialImageHash = await getImageHash(innerOfficialImageBuffer);
          const score = compareHashes(championHash, officialImageHash);

          if (score < bestMatchScore) {
            bestMatchScore = score;
            bestMatch = possibleChampion;
          }
        }
        if (bestMatch) {
          grid[r][c].championName = bestMatch.name;
        }
      }
    }
  }

  return grid;
}

async function getImageHash(imageBuffer: Buffer): Promise<string> {
  const pngBuffer = await sharp(imageBuffer).png().toBuffer();
  const tempPath = path.join(tmpdir(), `image-hash-${Date.now()}.png`); // Use .png extension
  return new Promise(async (resolve, reject) => {
    try {
      await fs.writeFile(tempPath, pngBuffer);
      imageHash(tempPath, 16, true, (error: any, data: string) => {
        fs.unlink(tempPath).catch(err => console.error(`Failed to delete temp file: ${tempPath}`, err));
        if (error) return reject(error);
        resolve(data);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function compareHashes(hash1: string, hash2: string): number {
  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    if (hash1[i] !== hash2[i]) {
      distance++;
    }
  }
  return distance;
}

async function drawGridOnImage(imageBuffer: Buffer, grid: ChampionGridCell[][]): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];

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

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}

async function drawOcrBoundsOnImage(imageBuffer: Buffer, detections: any[]): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];

  // Start from the second element, as the first is the entire detected text block
  for (const detection of detections.slice(1)) {
    const vertices = detection.boundingPoly?.vertices;
    if (!vertices || vertices.length < 4) continue;

    const [topLeft, topRight, , bottomLeft] = vertices.map((v: any) => ({ x: v.x || 0, y: v.y || 0 }));

    const width = Math.abs(topRight.x - topLeft.x);
    const height = Math.abs(bottomLeft.y - topLeft.y);

    if (width > 0 && height > 0) {
      const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="2" fill="none" /></svg>`;
      overlayElements.push({
        input: Buffer.from(svgRect),
        left: Math.round(topLeft.x),
        top: Math.round(topLeft.y),
      });
    }
  }

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}

async function drawAwakenedCheckOnImage(imageBuffer: Buffer, grid: ChampionGridCell[][]): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];

  for (const row of grid) {
    for (const cell of row) {
      if (cell.awakenedCheckBounds) {
        const [topLeft, , bottomRight] = cell.awakenedCheckBounds;
        const width = Math.abs(bottomRight.x - topLeft.x);
        const height = Math.abs(bottomRight.y - topLeft.y);

        if (width > 0 && height > 0) {
          const svgRect = `<svg width="${width}" height="${height}"><rect x="0" y="0" width="${width}" height="${height}" stroke="lime" stroke-width="2" fill="none" /></svg>`;
          overlayElements.push({
            input: Buffer.from(svgRect),
            left: Math.round(topLeft.x),
            top: Math.round(topLeft.y),
          });
        }
      }
    }
  }

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}

async function drawShortNameSolveOnImage(imageBuffer: Buffer, grid: ChampionGridCell[][]): Promise<Buffer> {
  const overlayElements: sharp.OverlayOptions[] = [];

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

  if (overlayElements.length === 0) {
    return imageBuffer;
  }

  return sharp(imageBuffer).composite(overlayElements).toBuffer();
}

function gridToString(grid: ChampionGridCell[][]): string {
  let gridString = "";
  for (const row of grid) {
    for (const cell of row) {
      const awakened = cell.isAwakened ? '*' : '';
      const rating = cell.powerRating ? ` (${cell.powerRating})` : '';
      gridString += `[${cell.championName || '-'}${rating}${awakened}] `;
    }
    gridString += '\n';
  }
  return gridString;
}

function processOcrDetections(detections: any[]): OcrResult[] {
  const individualDetections = detections.slice(1);
  return individualDetections.map(detection => ({
    text: ocrCorrection(detection.description || ''),
    bounds: detection.boundingPoly?.vertices?.map((v: any) => ({ x: v.x || 0, y: v.y || 0 })) || [],
  }));
}

function ocrCorrection(text: string): string {
  const corrections: { [key: string]: string } = {
    'Ο': 'O', 'Κ': 'K', 'Υ': 'Y', 'Ε': 'E', 'Α': 'A', 'Τ': 'T', 'Ι': 'I',
    'Ν': 'N', 'Μ': 'M', 'Η': 'H', 'Ρ': 'P', 'Χ': 'X', 'Β': 'B', 'Ζ': 'Z',
  };
  return text.split('').map(char => corrections[char] || char).join('');
}

function mergeOcrResults(ocrResults: OcrResult[], horizontalThreshold = 20): OcrResult[] {
  if (ocrResults.length === 0) {
    return [];
  }

  const merged: OcrResult[] = [];
  let current = ocrResults[0];

  for (let i = 1; i < ocrResults.length; i++) {
    const next = ocrResults[i];
    const currentBox = current.bounds;
    const nextBox = next.bounds;

    // Check for horizontal proximity and vertical overlap
    const horizontalDistance = nextBox[0].x - currentBox[1].x;
    const verticalOverlap = Math.max(0, Math.min(currentBox[3].y, nextBox[3].y) - Math.max(currentBox[0].y, nextBox[0].y));
    const isHorizontallyClose = horizontalDistance >= 0 && horizontalDistance < horizontalThreshold;
    const hasEnoughVerticalOverlap = verticalOverlap > (nextBox[3].y - nextBox[0].y) * 0.7;

    const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;
    if (isHorizontallyClose && hasEnoughVerticalOverlap && !ratingPattern.test(current.text) && !ratingPattern.test(next.text)) {
      // Merge text and bounds
      current.text += ' ' + next.text;
      current.bounds[1] = next.bounds[1]; // top-right
      current.bounds[2] = next.bounds[2]; // bottom-right
    } else {
      merged.push(current);
      current = next;
    }
  }
  merged.push(current);

  return merged;
}

async function estimateGrid(ocrResults: OcrResult[], imageBuffer: Buffer, debugMode: boolean): Promise<ChampionGridCell[][]> {
  // --- Constants for easy tuning ---
  const COL_WIDTH_RATIO = 0.83;
  const ROW_HEIGHT_RATIO = 0.98;
  const HORIZONTAL_PAIRING_TOLERANCE = 75;
  const VERTICAL_PAIRING_TOLERANCE = 150;

  const mergedOcrResults = mergeOcrResults(ocrResults);

  // Find the top boundary based on the "INFORMATION" text
  const infoText = mergedOcrResults.find(r => r.text.includes('INFORMATION'));
  let topBoundary = 0;
  if (infoText) {
    topBoundary = infoText.bounds[3].y; // Use the bottom y-coordinate
    if (debugMode) console.log(`[DEBUG] Found top boundary at y=${topBoundary}`);
  }

  const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;
  const starPattern = /^\*+$/; // Matches one or more asterisks
  const championTexts: OcrResult[] = [];
  const ratingTexts: OcrResult[] = [];

  for (const result of mergedOcrResults) {
    if (ratingPattern.test(result.text)) {
      ratingTexts.push(result);
    } else if (
      result.text.length > 1 &&
      result.text.toUpperCase() === result.text &&
      !starPattern.test(result.text) // Exclude strings of only asterisks
    ) {
      championTexts.push(result);
    }
  }

  if (ratingTexts.length === 0) {
    console.log('[DEBUG] No ratings found, cannot estimate grid.');
    return [];
  }

  // Pair champions with ratings
  const championData: { name: string; rating: string; nameBounds: Vertex[]; ratingBounds: Vertex[] }[] = [];
  for (const champText of championTexts) {
    let closestRating: OcrResult | null = null;
    let minDistance = Infinity;

    const champLeftX = champText.bounds[0].x;
    const champBottomY = champText.bounds[3].y;

    for (const ratingText of ratingTexts) {
      const ratingLeftX = ratingText.bounds[0].x;
      const ratingTopY = ratingText.bounds[0].y;

      const horizontalDist = Math.abs(champLeftX - ratingLeftX);
      const verticalDist = ratingTopY - champBottomY;

      // Rating should be below the champion and horizontally aligned to the left
      if (verticalDist > 0 && verticalDist < VERTICAL_PAIRING_TOLERANCE && horizontalDist < HORIZONTAL_PAIRING_TOLERANCE) {
        const distance = Math.sqrt(horizontalDist * horizontalDist + verticalDist * verticalDist);
        if (distance < minDistance) {
          minDistance = distance;
          closestRating = ratingText;
        }
      }
    }

    if (closestRating) {
      championData.push({
        name: champText.text,
        rating: closestRating.text,
        nameBounds: champText.bounds,
        ratingBounds: closestRating.bounds,
      });
      // Remove the used rating to avoid pairing it with another champion
      ratingTexts.splice(ratingTexts.indexOf(closestRating), 1);
    }
  }

  if (championData.length === 0) {
    console.log('[DEBUG] Could not pair any champions with ratings.');
    return [];
  }

  // Grid estimation based on rating positions
  const positions = championData.map(entry => ({ x: entry.ratingBounds[3].x, y: entry.ratingBounds[3].y }));
  const sortedX = [...new Set(positions.map(p => p.x))].sort((a, b) => a - b);
  const sortedY = [...new Set(positions.map(p => p.y))].sort((a, b) => a - b);

  const pixelTolerance = 40;
  const columnStarts: number[] = [];
  if (sortedX.length > 0) {
    columnStarts.push(sortedX[0]);
    for (let i = 1; i < sortedX.length; i++) {
      if (sortedX[i] > columnStarts[columnStarts.length - 1] + pixelTolerance) {
        columnStarts.push(sortedX[i]);
      }
    }
  }

  const rowStarts: number[] = [];
  if (sortedY.length > 0) {
    rowStarts.push(sortedY[0]);
    for (let i = 1; i < sortedY.length; i++) {
      if (sortedY[i] > rowStarts[rowStarts.length - 1] + pixelTolerance) {
        rowStarts.push(sortedY[i]);
      }
    }
  }

  const numCols = columnStarts.length;
  let numRows = rowStarts.length;

  if (numCols === 0 || numRows === 0) return [];

  const avgColDist = numCols > 1 ? (columnStarts[numCols - 1] - columnStarts[0]) / (numCols - 1) : ((await sharp(imageBuffer).metadata()).width || 0) / 7;
  const avgRowDist = numRows > 1 ? (rowStarts[numRows - 1] - rowStarts[0]) / (numRows - 1) : avgColDist * 0.95;

  const cellWidth = avgColDist * COL_WIDTH_RATIO;
  const cellHeight = avgRowDist * ROW_HEIGHT_RATIO;

  let grid: ChampionGridCell[][] = Array(numRows).fill(0).map(() => Array(numCols).fill(0).map(() => ({ bounds: [] })));

  // Create grid cells with bounds
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const x_center = columnStarts[c] + avgColDist / 2 - cellWidth * 0.18;
      const y_center = rowStarts[r] - avgRowDist / 2 + cellHeight * 0.08;

      const left = x_center - cellWidth / 2;
      const top = y_center - cellHeight / 2;
      const right = x_center + cellWidth / 2;
      const bottom = y_center + cellHeight / 2;

      grid[r][c] = {
        bounds: [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ]
      };
    }
  }

  // Filter out rows that are above the top boundary
  if (topBoundary > 0) {
    grid = grid.filter(row => {
      const firstCell = row[0];
      if (!firstCell) return false;
      const rowTop = firstCell.bounds[0].y;
      return rowTop > topBoundary;
    });
  }

  // Place champions in grid
  for (const champ of championData) {
    const centerX = (champ.nameBounds[0].x + champ.nameBounds[1].x) / 2;
    const centerY = (champ.nameBounds[0].y + champ.nameBounds[2].y) / 2;

    let bestCell: { r: number, c: number } | null = null;
    let minDist = Infinity;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        const [topLeft, , bottomRight] = cell.bounds;
        if (centerX >= topLeft.x && centerX <= bottomRight.x && centerY >= topLeft.y && centerY <= bottomRight.y) {
          const cellCenterX = (topLeft.x + bottomRight.x) / 2;
          const cellCenterY = (topLeft.y + bottomRight.y) / 2;
          const dist = Math.sqrt(Math.pow(centerX - cellCenterX, 2) + Math.pow(centerY - cellCenterY, 2));
          if (dist < minDist) {
            minDist = dist;
            bestCell = { r, c };
          }
        }
      }
    }

    if (bestCell) {
      grid[bestCell.r][bestCell.c].championName = champ.name;
      grid[bestCell.r][bestCell.c].powerRating = champ.rating;
    }
  }

  const allChampions = await prisma.champion.findMany();
  const fuse = new Fuse(allChampions, { keys: ['name', 'shortName'], includeScore: true, threshold: 0.4 });

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        const results = fuse.search(cell.championName);
        if (results.length > 0) {
          cell.championName = results[0].item.name;
          const { isAwakened, awakenedCheckBounds } = await isChampionAwakened(imageBuffer, cell.bounds, debugMode);
          cell.isAwakened = isAwakened;
          cell.awakenedCheckBounds = awakenedCheckBounds;
        }
      }
    }
  }

  return grid;
}

async function isChampionAwakened(imageBuffer: Buffer, bounds: Vertex[], debugMode: boolean): Promise<{ isAwakened: boolean; awakenedCheckBounds: Vertex[] }> {
  const [topLeft, , bottomRight] = bounds;
  const boxWidth = bottomRight.x - topLeft.x;
  const boxHeight = bottomRight.y - topLeft.y;

  const stripWidth = Math.floor(boxWidth * 0.4);
  const stripHeight = Math.floor(boxHeight * 0.1);
  const stripX = Math.floor(topLeft.x + (boxWidth - stripWidth) / 2);
  const stripY = Math.floor(topLeft.y + boxHeight * 0.6);

  const awakenedCheckBounds: Vertex[] = [
    { x: stripX, y: stripY },
    { x: stripX + stripWidth, y: stripY },
    { x: stripX + stripWidth, y: stripY + stripHeight },
    { x: stripX, y: stripY + stripHeight },
  ];

  const strip = await sharp(imageBuffer)
    .extract({ left: stripX, top: stripY, width: stripWidth, height: stripHeight })
    .raw()
    .toBuffer();

  let r = 0, g = 0, b = 0;
  for (let i = 0; i < strip.length; i += 3) {
    r += strip[i];
    g += strip[i + 1];
    b += strip[i + 2];
  }

  const numPixels = strip.length / 3;
  const avgBlue = b / numPixels;

  if (debugMode) {
    console.log(`[DEBUG] Awakened check for champion at [${bounds[0].x.toFixed(0)}, ${bounds[0].y.toFixed(0)}]: avgBlue = ${avgBlue.toFixed(2)}`);
  }

  return { isAwakened: avgBlue > 90, awakenedCheckBounds };
}


async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getRoster(playerId: string, stars: number | null, rank: number | null): Promise<string> {
    const where: any = { playerId };
    if (stars) {
        where.stars = stars;
    }
    if (rank) {
        where.rank = rank;
    }

    const rosterEntries = await prisma.roster.findMany({
        where,
        include: { champion: true },
        orderBy: [{ stars: 'desc' }, { rank: 'desc' }],
    });

    if (rosterEntries.length === 0) {
        return "No champions found in the roster that match the criteria.";
    }

    let response = "";
    for (const entry of rosterEntries) {
        const awakened = entry.isAwakened ? '*' : '';
        response += `${entry.champion.name} ${entry.stars}* R${entry.rank}${awakened}\n`;
    }

    return response;
}

export async function deleteRoster(playerId: string): Promise<string> {
    const { count } = await prisma.roster.deleteMany({
        where: { playerId },
    });
    return `Successfully deleted ${count} champions from the roster.`;
}