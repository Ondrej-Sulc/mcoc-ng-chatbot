import sharp from 'sharp';
import { PrismaClient, Champion } from '@prisma/client';
import { v1 } from '@google-cloud/vision';
import Fuse from 'fuse.js';
// @ts-ignore
import { imageHash } from 'image-hash';

import { config } from '../config';

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
}

export async function processRosterScreenshot(
  imageUrl: string,
  stars: number,
  rank: number,
  debugMode: boolean = false,
  playerId?: string,
): Promise<string> {
  if (debugMode) console.log(`[DEBUG] Starting roster processing for URL: ${imageUrl}`);

  // 1. Download image
  const imageBuffer = await downloadImage(imageUrl);
  if (debugMode) console.log(`[DEBUG] Image downloaded, size: ${imageBuffer.length} bytes`);

  // 2. Crop image
  const croppedImageBuffer = await cropImage(imageBuffer);
  if (debugMode) console.log(`[DEBUG] Image cropped, new size: ${croppedImageBuffer.length} bytes`);

  // 3. Run OCR using Google Cloud Vision
  if (debugMode) console.log('[DEBUG] Sending image to Google Cloud Vision for OCR...');
  const [result] = await visionClient.textDetection(croppedImageBuffer);
  const detections = result.textAnnotations;
  if (debugMode) console.log(`[DEBUG] OCR complete, ${detections?.length || 0} text annotations found.`);

  if (!detections || detections.length === 0) {
    return "Could not detect any text in the image.";
  }

  // 4. Process OCR results
  const ocrResults = processOcrDetections(detections);
  if (debugMode) {
    console.log(`[DEBUG] Processed ${ocrResults.length} OCR results.`);
    // Log a sample of OCR results
    console.log('[DEBUG] OCR results sample:', ocrResults.slice(0, 5).map(r => r.text));
  }

  // 5. Estimate grid and parse champions
  if (debugMode) console.log('[DEBUG] Estimating champion grid...');
  let grid = await estimateGrid(ocrResults, croppedImageBuffer);
  if (debugMode) {
    console.log(`[DEBUG] Grid estimated with ${grid.length} rows and ${grid[0]?.length || 0} columns.`);
    console.log('[DEBUG] Parsed grid before name solving:\n' + gridToString(grid));
  }

  // 6. Solve ambiguous short names
  if (debugMode) console.log('[DEBUG] Solving ambiguous short names...');
  grid = await solveShortNames(grid, croppedImageBuffer);
  if (debugMode) console.log('[DEBUG] Short names solved.');


  if (debugMode) {
    // In debug mode, return the string representation of the grid
    if (debugMode) console.log('[DEBUG] Debug mode enabled, skipping database save.');
    return `--- DEBUG MODE --- 
Final parsed roster: 
${gridToString(grid)}`;
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
        const championImageBuffer = await sharp(imageBuffer)
          .extract({ left: topLeft.x, top: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y })
          .toBuffer();

        const championHash = await getImageHash(championImageBuffer);

        let bestMatch: Champion | null = null;
        let bestMatchScore = Infinity;

        for (const possibleChampion of possibleChampions) {
          const officialImageBuffer = await downloadImage((possibleChampion.images as any).official);
          const officialImageHash = await getImageHash(officialImageBuffer);
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

function getImageHash(imageBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    imageHash(`data:image/png;base64,${imageBuffer.toString('base64')}`, 16, true, (error: any, data: string) => {
      if (error) reject(error);
      resolve(data);
    });
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

function gridToString(grid: ChampionGridCell[][]): string {
  let gridString = "";
  for (const row of grid) {
    for (const cell of row) {
      const awakened = cell.isAwakened ? '*' : '';
      gridString += `[${cell.championName || '-'}${awakened}] `;
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

async function estimateGrid(ocrResults: OcrResult[], imageBuffer: Buffer): Promise<ChampionGridCell[][]> {
  const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;

  const championTexts: OcrResult[] = [];
  const ratingTexts: OcrResult[] = [];

  for (const result of ocrResults) {
    if (ratingPattern.test(result.text)) {
      ratingTexts.push(result);
    } else if (result.text.length > 1) { // Filter out small noise
      championTexts.push(result);
    }
  }

  if (championTexts.length === 0) {
    return [];
  }

  const positions = championTexts.map(entry => ({ x: entry.bounds[3].x, y: entry.bounds[3].y, text: entry.text }));
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
  const numRows = rowStarts.length;

  if (numCols === 0 || numRows === 0) return [];

  const avgColDist = numCols > 1 ? (columnStarts[numCols - 1] - columnStarts[0]) / (numCols - 1) : (await sharp(imageBuffer).metadata()).width || 0 / 7;
  const avgRowDist = numRows > 1 ? (rowStarts[numRows - 1] - rowStarts[0]) / (numRows - 1) : avgColDist * 0.95;

  const grid: ChampionGridCell[][] = Array(numRows).fill(0).map(() => Array(numCols).fill(0).map(() => ({ bounds: [] })));

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const x = columnStarts[c] - avgColDist / 2;
      const y = rowStarts[r] + avgRowDist / 2;
      grid[r][c] = {
        bounds: [
          { x: x, y: y - avgRowDist },
          { x: x + avgColDist, y: y - avgRowDist },
          { x: x + avgColDist, y: y },
          { x: x, y: y },
        ]
      };
    }
  }

  for (const champText of championTexts) {
    const centerX = (champText.bounds[0].x + champText.bounds[1].x) / 2;
    const centerY = (champText.bounds[0].y + champText.bounds[2].y) / 2;

    let bestCell: { r: number, c: number } | null = null;
    let minDist = Infinity;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
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
      const cell = grid[bestCell.r][bestCell.c];
      const existingName = cell.championName || '';
      cell.championName = (existingName + ' ' + champText.text).trim();
    }
  }

  const allChampions = await prisma.champion.findMany();
  const fuse = new Fuse(allChampions, { keys: ['name', 'shortName'], includeScore: true, threshold: 0.4 });

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        const results = fuse.search(cell.championName);
        if (results.length > 0) {
          cell.championName = results[0].item.name;
          cell.isAwakened = await isChampionAwakened(imageBuffer, cell.bounds);
        }
      }
    }
  }

  return grid;
}

async function isChampionAwakened(imageBuffer: Buffer, bounds: Vertex[]): Promise<boolean> {
  const [topLeft, , bottomRight] = bounds;
  const boxWidth = bottomRight.x - topLeft.x;
  const boxHeight = bottomRight.y - topLeft.y;

  const stripWidth = Math.floor(boxWidth * 0.4);
  const stripHeight = 1;
  const stripX = Math.floor(topLeft.x + (boxWidth - stripWidth) / 2);
  const stripY = Math.floor(topLeft.y + boxHeight * 0.65);

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

  return avgBlue > 150;
}


async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image from ${url}: ${response.statusText}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function cropImage(imageBuffer: Buffer): Promise<Buffer> {
  const metadata = await sharp(imageBuffer).metadata();
  const imageWidth = metadata.width || 0;
  const imageHeight = metadata.height || 0;

  const cropTop = Math.floor(imageHeight * 0.25);
  const cropBottom = Math.floor(imageHeight * 0.90);
  const cropHeight = cropBottom - cropTop;

  return sharp(imageBuffer)
    .extract({ left: 0, top: cropTop, width: imageWidth, height: cropHeight })
    .toBuffer();
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
