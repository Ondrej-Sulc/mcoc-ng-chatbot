import sharp from "sharp";
import { PrismaClient, Champion, Roster, Prisma } from "@prisma/client";
import { v1 } from "@google-cloud/vision";
import Fuse from "fuse.js";
// @ts-ignore
import { imageHash } from "image-hash";
import { promises as fs } from "fs";
import * as path from "path";
import { tmpdir } from "os";

import { config } from "../config";
import { sheetsService } from "./sheetsService";

import { getChampionImageUrl } from "../utils/championHelper";

const prisma = new PrismaClient();

const visionClient = new v1.ImageAnnotatorClient({
  credentials: config.GOOGLE_CREDENTIALS,
});

// --- Interfaces for data structures ---
type Vertex = { x: number; y: number };

interface OcrResult {
  text: string;
  bounds: Vertex[];
}

interface ChampionGridCell {
  bounds: Vertex[];
  championName?: string;
  champion?: ChampionData;
  powerRating?: string;
  isAwakened?: boolean;
  awakenedCheckBounds?: Vertex[];
  shortNameSolveBounds?: Vertex[];
  innerPortraitCropBounds?: Vertex[];
  bestMatchImageBuffer?: Buffer | null;
}

export interface ChampionData {
  id: number;
  name: string;
  shortName: string;
  discordEmoji: string | null;
}

export interface RosterUpdateResult {
  champions: RosterWithChampion[][];
  count: number;
}

export interface RosterDebugResult {
  message: string;
  imageBuffer?: Buffer;
  debugImageBuffer?: Buffer;
}

export type RosterWithChampion = Roster & { champion: Champion };

export async function processRosterScreenshot(
  imageUrl: string,
  stars: number,
  rank: number,
  isAscended: boolean = false,
  debugMode: boolean = false,
  playerId?: string
): Promise<RosterUpdateResult | RosterDebugResult> {
  if (debugMode)
    console.log(`[DEBUG] Starting roster processing for URL: ${imageUrl}`);

  // 1. Download image
  const imageBuffer = await downloadImage(imageUrl);
  if (debugMode)
    console.log(`[DEBUG] Image downloaded, size: ${imageBuffer.length} bytes`);

  // 2. Crop image
  // will implement later, for now just use full image, cropping will be dynamic based on if its full screenshot or just roster part

  // 3. Run OCR using Google Cloud Vision
  if (debugMode)
    console.log("[DEBUG] Sending image to Google Cloud Vision for OCR...");
  const [result] = await visionClient.textDetection(imageBuffer);
  const detections = result.textAnnotations;
  if (debugMode)
    console.log(
      `[DEBUG] OCR complete, ${detections?.length || 0} text annotations found.`
    );

  if (!detections || detections.length === 0) {
    const message = "Could not detect any text in the image.";
    if (debugMode) {
      return { message };
    }
    return { message, count: 0 };
  }

  // 4. Process OCR results
  const ocrResults = processOcrDetections(detections);
  if (debugMode) {
    console.log(`[DEBUG] Processed ${ocrResults.length} OCR results.`);
    // Log a sample of OCR results
    console.log(
      "[DEBUG] OCR results sample:",
      ocrResults.slice(0, 100).map((r) => r.text)
    );
  }

  // 5. Estimate grid and parse champions
  if (debugMode) console.log("[DEBUG] Estimating champion grid...");
  const { grid, topBoundary } = await estimateGrid(
    ocrResults,
    imageBuffer,
    debugMode
  );
  if (debugMode) {
    console.log(
      `[DEBUG] Grid estimated with ${grid.length} rows and ${
        grid[0]?.length || 0
      } columns.`
    );
    console.log(
      "[DEBUG] Parsed grid before name solving:\n" + (await gridToString(grid))
    );
  }

  // 6. Solve ambiguous short names
  if (debugMode) console.log("[DEBUG] Solving ambiguous short names...");
  const solvedGrid = await solveShortNames(grid, imageBuffer);
  if (debugMode) console.log("[DEBUG] Short names solved.");

  let debugImageBuffer: Buffer | undefined;
  if (debugMode) {
    console.log("[DEBUG] Drawing debug bounds on image...");
    debugImageBuffer = await drawDebugBoundsOnImage(
      imageBuffer,
      solvedGrid,
      topBoundary
    );
    console.log("[DEBUG] Debug bounds image created.");
  }

  if (debugMode) {
    // In debug mode, return the string representation of the list
    if (debugMode)
      console.log("[DEBUG] Debug mode enabled, skipping database save.");
    return {
      message: `--- DEBUG MODE --- \nFinal parsed roster: \n${await gridToString(
        solvedGrid
      )}`,
      imageBuffer: imageBuffer,
      debugImageBuffer: debugImageBuffer,
    };
  }

  if (!playerId) {
    throw new Error("playerId is required when not in debug mode.");
  }

  // 7. Save roster to database
  console.log(`Saving roster for player ${playerId}...`);
  const savedChampions = await saveRoster(
    solvedGrid,
    playerId,
    stars,
    rank,
    isAscended
  );
  const count = savedChampions.flat().length;
  console.log(`${count} champions saved.`);

  return {
    champions: savedChampions,
    count: count,
  };
}

async function saveRoster(
  grid: ChampionGridCell[][],
  playerId: string,
  stars: number,
  rank: number,
  isAscended: boolean
): Promise<RosterWithChampion[][]> {
  const savedChampions: RosterWithChampion[][] = [];
  const allChampions = await prisma.champion.findMany();
  const championMap = new Map(allChampions.map((c) => [c.name, c]));

  for (const row of grid) {
    const newRow: RosterWithChampion[] = [];
    for (const cell of row) {
      if (cell.championName) {
        const champion = championMap.get(cell.championName);
        if (champion) {
          const powerRatingInt = cell.powerRating
            ? parseInt(cell.powerRating.replace(/[,.]/g, ""), 10)
            : undefined;
          const rosterEntry = await prisma.roster.upsert({
            where: {
              playerId_championId_stars: {
                playerId,
                championId: champion.id,
                stars,
              },
            },
            update: {
              rank,
              isAwakened: cell.isAwakened || false,
              isAscended,
              powerRating: powerRatingInt,
            },
            create: {
              playerId,
              championId: champion.id,
              stars,
              rank,
              isAwakened: cell.isAwakened || false,
              isAscended,
              powerRating: powerRatingInt,
            },
            include: { champion: true },
          });
          newRow.push(rosterEntry);
        }
      }
    }
    if (newRow.length > 0) {
      savedChampions.push(newRow);
    }
  }

  // Update the sheet after the database has been updated
  await updateRosterInSheet(playerId, stars, rank, isAscended, savedChampions);

  return savedChampions;
}

async function updateRosterInSheet(
  playerId: string,
  stars: number,
  rank: number,
  isAscended: boolean,
  updatedChampions: RosterWithChampion[][]
) {
  if (stars !== 6 && stars !== 7) {
    console.log(`Skipping sheet update for ${stars}* champions.`);
    return;
  }

  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    console.error(`Player with ID ${playerId} not found.`);
    return;
  }

  const sheetName = "Roster";
  const headerRange = `${sheetName}!B2:BI2`;
  const championNamesRange = `${sheetName}!A5:A`;

  const [playerNames, championNames] = await sheetsService.readSheets(
    config.MCOC_SHEET_ID,
    [headerRange, championNamesRange]
  );

  if (!playerNames || !championNames) {
    console.error("Failed to read player or champion names from the sheet.");
    return;
  }

  const playerIndex = playerNames[0].findIndex(
    (name) => name.toLowerCase() === player.ingameName.toLowerCase()
  );

  if (playerIndex === -1) {
    console.log(`Player ${player.ingameName} not found in the sheet.`);
    return;
  }

  const columnIndex = playerIndex + (stars === 6 ? 1 : 2);
  const columnLetter = String.fromCharCode(65 + (columnIndex % 26));
  const columnPrefix =
    columnIndex >= 26
      ? String.fromCharCode(65 + Math.floor(columnIndex / 26) - 1)
      : "";
  const targetColumn = `${columnPrefix}${columnLetter}`;

  const targetRange = `${sheetName}!${targetColumn}5:${targetColumn}`;

  const existingRosterData = await sheetsService.readSheet(
    config.MCOC_SHEET_ID,
    targetRange
  );
  const newRosterData = existingRosterData ? [...existingRosterData] : [];

  const flatUpdatedChampions = updatedChampions.flat();

  for (let i = 0; i < championNames.length; i++) {
    const sheetChampionName = championNames[i][0];
    const updatedChampion = flatUpdatedChampions.find(
      (c) => c.champion.name.toLowerCase() === sheetChampionName.toLowerCase()
    );

    if (updatedChampion) {
      if (i >= newRosterData.length) {
        // Pad the array if needed
        for (let j = newRosterData.length; j <= i; j++) {
          newRosterData.push([]);
        }
      }
      let sheetRank = rank;
      if (isAscended && stars === 6) {
        sheetRank += 1;
      }
      newRosterData[i] = [
        `${sheetRank}${updatedChampion.isAwakened ? "*" : ""}`,
      ];
    }
  }

  await sheetsService.writeSheet(
    config.MCOC_SHEET_ID,
    targetRange,
    newRosterData
  );
  console.log(
    `Successfully updated ${player.ingameName}'s ${stars}* roster in the sheet.`
  );
}

async function getAverageColor(
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

function getColorDistance(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number }
): number {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
      Math.pow(color1.g - color2.g, 2) +
      Math.pow(color1.b - color2.b, 2)
  );
}

async function solveShortNames(
  grid: ChampionGridCell[][],
  imageBuffer: Buffer
): Promise<ChampionGridCell[][]> {
  // --- Constants for tuning the image-based short name solving ---
  // The ratio of the cell height to crop from the bottom to isolate the portrait.
  const PORTRAIT_CROP_BOTTOM_RATIO = 0.33;
  // The ratio of the cell width to crop from the sides to isolate the portrait.
  const PORTRAIT_CROP_HORIZONTAL_RATIO = 0.1;
  // The ratio to crop from the sides of the extracted portrait for the inner hash.
  const INNER_PORTRAIT_CROP_RATIO = 0.15;
  // The width ratio for the inner portrait hash.
  const INNER_PORTRAIT_WIDTH_RATIO = 0.7;

  const allChampions = await prisma.champion.findMany();
  const championsByShortName = allChampions.reduce((acc, champ) => {
    if (!acc[champ.shortName]) {
      acc[champ.shortName] = [];
    }
    acc[champ.shortName].push(champ);
    return acc;
  }, {} as Record<string, Champion[]>);

  const ambiguousShortNames = Object.keys(championsByShortName).filter(
    (key) => championsByShortName[key].length > 1
  );

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        if (ambiguousShortNames.includes(cell.championName)) {
          const possibleChampions = championsByShortName[cell.championName];
          const [topLeft, , bottomRight] = cell.bounds;

          const boxWidth = bottomRight.x - topLeft.x;
          const boxHeight = bottomRight.y - topLeft.y;

          const cropTop = boxHeight * 0;
          const cropBottom = boxHeight * PORTRAIT_CROP_BOTTOM_RATIO;
          const cropLeft = boxWidth * PORTRAIT_CROP_HORIZONTAL_RATIO;
          const cropRight = boxWidth * PORTRAIT_CROP_HORIZONTAL_RATIO;

          const extractOptions = {
            left: Math.round(topLeft.x + cropLeft),
            top: Math.round(topLeft.y + cropTop),
            width: Math.round(boxWidth - cropLeft - cropRight),
            height: Math.round(boxHeight - cropTop - cropBottom),
          };

          cell.shortNameSolveBounds = [
            { x: extractOptions.left, y: extractOptions.top },
            {
              x: extractOptions.left + extractOptions.width,
              y: extractOptions.top,
            },
            {
              x: extractOptions.left + extractOptions.width,
              y: extractOptions.top + extractOptions.height,
            },
            {
              x: extractOptions.left,
              y: extractOptions.top + extractOptions.height,
            },
          ];

          if (extractOptions.width <= 0 || extractOptions.height <= 0) {
            console.log(
              `[DEBUG] Skipping invalid extract region for ${cell.championName}`,
              extractOptions
            );
            continue;
          }

          const championImageBuffer = await sharp(imageBuffer)
            .extract(extractOptions)
            .toBuffer();

          // Second crop - 15% from all sides
          const champImageMetadata = await sharp(
            championImageBuffer
          ).metadata();
          const champWidth = champImageMetadata.width || 0;
          const champHeight = champImageMetadata.height || 0;
          const champCropLeft = Math.floor(
            champWidth * INNER_PORTRAIT_CROP_RATIO
          );
          const champCropTop = Math.floor(
            champHeight * INNER_PORTRAIT_CROP_RATIO
          );
          const champCropWidth = Math.floor(
            champWidth * INNER_PORTRAIT_WIDTH_RATIO
          );
          const champCropHeight = Math.floor(
            champHeight * INNER_PORTRAIT_WIDTH_RATIO
          );

          const abs_left = extractOptions.left + champCropLeft;
          const abs_top = extractOptions.top + champCropTop;
          const abs_right = abs_left + champCropWidth;
          const abs_bottom = abs_top + champCropHeight;

          cell.innerPortraitCropBounds = [
            { x: abs_left, y: abs_top },
            { x: abs_right, y: abs_top },
            { x: abs_right, y: abs_bottom },
            { x: abs_left, y: abs_bottom },
          ];

          const innerChampionImageBuffer = await sharp(championImageBuffer)
            .extract({
              left: champCropLeft,
              top: champCropTop,
              width: champCropWidth,
              height: champCropHeight,
            })
            .toBuffer();

          const championHash = await getImageHash(innerChampionImageBuffer);
          const championAvgColor = await getAverageColor(
            innerChampionImageBuffer
          );

          let bestMatch: Champion | null = null;
          let bestMatchScore = Infinity;
          let bestMatchOfficialImageBuffer: Buffer | null = null;

          for (const possibleChampion of possibleChampions) {
            const imageUrl = getChampionImageUrl(
              possibleChampion.images,
              "full",
              "primary"
            );
            if (!imageUrl) {
              console.log(
                `[DEBUG] Skipping champion ${possibleChampion.name} due to missing official image URL.`
              );
              continue;
            }
            const officialImageBuffer = await downloadImage(imageUrl);

            // Second crop for official image
            const officialImageMetadata = await sharp(
              officialImageBuffer
            ).metadata();
            const officialWidth = officialImageMetadata.width || 0;
            const officialHeight = officialImageMetadata.height || 0;
            const officialCropLeft = Math.floor(
              officialWidth * INNER_PORTRAIT_CROP_RATIO
            );
            const officialCropTop = Math.floor(
              officialHeight * INNER_PORTRAIT_CROP_RATIO
            );
            const officialCropWidth = Math.floor(
              officialWidth * INNER_PORTRAIT_WIDTH_RATIO
            );
            const officialCropHeight = Math.floor(
              officialHeight * INNER_PORTRAIT_WIDTH_RATIO
            );

            const innerOfficialImageBuffer = await sharp(officialImageBuffer)
              .extract({
                left: officialCropLeft,
                top: officialCropTop,
                width: officialCropWidth,
                height: officialCropHeight,
              })
              .toBuffer();

            const officialImageHash = await getImageHash(
              innerOfficialImageBuffer
            );
            const officialImageAvgColor = await getAverageColor(
              innerOfficialImageBuffer
            );

            const hashDistance = compareHashes(championHash, officialImageHash);
            const colorDistance = getColorDistance(
              championAvgColor,
              officialImageAvgColor
            );

            // Normalize scores (0-1 range)
            const normalizedHashScore = hashDistance / 256; // Max hash distance is 256 for 16x16
            const normalizedColorScore = colorDistance / 441.67; // Max color distance is sqrt(3 * 255^2)

            // Combine scores (lower is better). Give more weight to hash score.
            const combinedScore =
              0.8 * normalizedHashScore + 0.2 * normalizedColorScore;

            if (combinedScore < bestMatchScore) {
              bestMatchScore = combinedScore;
              bestMatch = possibleChampion;
              bestMatchOfficialImageBuffer = officialImageBuffer;
            }
          }
          if (bestMatch) {
            grid[r][c].championName = bestMatch.name;
            grid[r][c].champion = bestMatch;
            grid[r][c].bestMatchImageBuffer = bestMatchOfficialImageBuffer;
          }
        } else {
          const champions = championsByShortName[cell.championName];
          if (champions && champions.length === 1) {
            const champion = champions[0];
            cell.championName = champion.name;
            cell.champion = champion;
          }
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
        fs.unlink(tempPath).catch((err) =>
          console.error(`Failed to delete temp file: ${tempPath}`, err)
        );
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

async function drawDebugBoundsOnImage(
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

async function gridToString(grid: ChampionGridCell[][]): Promise<string> {
  let listString = "";
  const championNames = grid
    .flat()
    .map((cell) => cell.championName)
    .filter((name) => !!name) as string[];

  const champions = await prisma.champion.findMany({
    where: {
      name: { in: championNames },
    },
    select: { name: true, discordEmoji: true },
  });
  const emojiMap = new Map(champions.map((c) => [c.name, c.discordEmoji]));

  for (const row of grid) {
    for (const cell of row) {
      if (cell.championName) {
        const awakened = cell.isAwakened ? "★" : "☆";
        const rating = cell.powerRating ? ` (${cell.powerRating})` : "";
        const emoji = emojiMap.get(cell.championName) || "";
        listString += `- ${awakened} ${emoji} ${cell.championName}${rating}\n`;
      }
    }
  }
  return listString;
}

function processOcrDetections(detections: any[]): OcrResult[] {
  const individualDetections = detections.slice(1);
  return individualDetections.map((detection) => ({
    text: ocrCorrection(detection.description || ""),
    bounds:
      detection.boundingPoly?.vertices?.map((v: any) => ({
        x: v.x || 0,
        y: v.y || 0,
      })) || [],
  }));
}

function ocrCorrection(text: string): string {
  const corrections: { [key: string]: string } = {
    Ο: "O",
    Κ: "K",
    Υ: "Y",
    Ε: "E",
    Α: "A",
    Τ: "T",
    Ι: "I",
    Ν: "N",
    Μ: "M",
    Η: "H",
    Ρ: "P",
    Χ: "X",
    Β: "B",
    Ζ: "Z",
  };
  const wordCorrections: { [key: string]: string } = {
    AGON: "AEGON",
  };

  const upperText = text.toUpperCase();
  if (wordCorrections[upperText]) {
    return wordCorrections[upperText];
  }

  return text
    .split("")
    .map((char) => corrections[char] || char)
    .join("");
}

function mergeOcrResults(
  ocrResults: OcrResult[],
  horizontalThreshold = 40
): OcrResult[] {
  // --- Constants for tuning the merge logic ---
  // The maximum vertical distance between two text boxes to be considered on the same line.
  const VERTICAL_ALIGNMENT_TOLERANCE = 10; // in pixels
  // The minimum vertical overlap required for two text boxes to be merged, as a ratio of the height of the next box.
  const VERTICAL_OVERLAP_THRESHOLD_RATIO = 0.7;
  // The maximum horizontal distance allowed for a merge. Allows for a small overlap.
  const HORIZONTAL_OVERLAP_TOLERANCE = -10; // in pixels

  if (ocrResults.length === 0) {
    return [];
  }

  // Sort by vertical position, then horizontal to ensure correct reading order
  ocrResults.sort((a, b) => {
    const aY = a.bounds[0].y;
    const bY = b.bounds[0].y;
    const aX = a.bounds[0].x;
    const bX = b.bounds[0].x;

    if (Math.abs(aY - bY) > VERTICAL_ALIGNMENT_TOLERANCE) {
      return aY - bY;
    }
    return aX - bX;
  });

  const merged: OcrResult[] = [];
  if (ocrResults.length === 0) return [];
  let current = ocrResults[0];

  for (let i = 1; i < ocrResults.length; i++) {
    const next = ocrResults[i];
    const currentBox = current.bounds;
    const nextBox = next.bounds;

    // Check for horizontal proximity and vertical overlap
    const horizontalDistance = nextBox[0].x - currentBox[1].x;
    const verticalOverlap = Math.max(
      0,
      Math.min(currentBox[3].y, nextBox[3].y) -
        Math.max(currentBox[0].y, nextBox[0].y)
    );
    const isHorizontallyClose =
      horizontalDistance >= HORIZONTAL_OVERLAP_TOLERANCE &&
      horizontalDistance < horizontalThreshold;
    const hasEnoughVerticalOverlap =
      verticalOverlap >
      (nextBox[3].y - nextBox[0].y) * VERTICAL_OVERLAP_THRESHOLD_RATIO;

    const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;
    const yearPattern = /^\d{4}$/;

    const isNextTextRatingLike =
      ratingPattern.test(next.text) && !yearPattern.test(next.text);

    if (
      isHorizontallyClose &&
      hasEnoughVerticalOverlap &&
      !ratingPattern.test(current.text) &&
      !isNextTextRatingLike
    ) {
      // Merge text and bounds
      let separator = " ";
      if (next.text === "-" || current.text.endsWith("-")) {
        separator = "";
      }
      current.text += separator + next.text;
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

async function estimateGrid(
  ocrResults: OcrResult[],
  imageBuffer: Buffer,
  debugMode: boolean
): Promise<{ grid: ChampionGridCell[][]; topBoundary: number }> {
  // --- Constants for tuning the grid estimation logic ---
  // The ratio of the average column distance used to determine the cell width.
  const COL_WIDTH_RATIO = 0.83;
  // The ratio of the average row distance used to determine the cell height.
  const ROW_HEIGHT_RATIO = 0.98;
  // The horizontal tolerance in pixels for pairing a champion name with a rating.
  const HORIZONTAL_PAIRING_TOLERANCE = 75;
  // The vertical tolerance in pixels for pairing a champion name with a rating.
  const VERTICAL_PAIRING_TOLERANCE = 150;
  // The pixel tolerance for clustering X and Y coordinates to determine grid columns and rows.
  const GRID_PIXEL_TOLERANCE = 40;
  // The ratio to adjust the calculated x-center of a cell.
  const X_CENTER_ADJUSTMENT_RATIO = 0.18;
  // The ratio to adjust the calculated y-center of a cell.
  const Y_CENTER_ADJUSTMENT_RATIO = 0.08;

  // --- Constants for the single champion case ---
  // The multiplier for the average character width of the rating to estimate the cell width.
  const SINGLE_CHAMP_CELL_WIDTH_MULTIPLIER = 11;
  // The ratio of the cell width to its height.
  const SINGLE_CHAMP_CELL_ASPECT_RATIO = 1.2;
  // The padding below the rating to determine the cell bottom.
  const SINGLE_CHAMP_CELL_BOTTOM_PADDING = 10;

  const mergedOcrResultsForBoundary = mergeOcrResults(ocrResults);
  const infoText = mergedOcrResultsForBoundary.find((r) =>
    r.text.includes("INFORMATION")
  );
  let topBoundary = 0;
  if (infoText) {
    topBoundary = infoText.bounds[3].y;
    if (debugMode)
      console.log(`[DEBUG] Found top boundary at y=${topBoundary}`);
  }

  const ocrResultsBelowBoundary = ocrResults.filter(
    (r) => r.bounds[0].y > topBoundary
  );
  const mergedOcrResults = mergeOcrResults(ocrResultsBelowBoundary);

  const ratingPattern = /^(\d{1,2}[.,]\d{3}|\d{3}).*$/;
  const starPattern = /^[\*X]+$/;
  const championNamePattern = /^[A-Z0-9- '.()]+$/;

  const ratingTexts: OcrResult[] = [];
  const potentialNameParts: OcrResult[] = [];

  for (const result of mergedOcrResults) {
    if (ratingPattern.test(result.text)) {
      ratingTexts.push(result);
    } else if (
      result.text.length > 0 &&
      result.text.toUpperCase() === result.text &&
      !starPattern.test(result.text) &&
      !/^[0-9]+$/.test(result.text) &&
      championNamePattern.test(result.text)
    ) {
      potentialNameParts.push(result);
    }
  }

  if (ratingTexts.length === 0) {
    console.log("[DEBUG] No ratings found, cannot estimate grid.");
    return { grid: [], topBoundary: 0 };
  }

  const championData: {
    name: string;
    rating: string;
    nameBounds: Vertex[];
    ratingBounds: Vertex[];
  }[] = [];

  const primaryParts = [...potentialNameParts];

  for (const primaryPart of primaryParts) {
    let closestRating: OcrResult | null = null;
    let minRatingDistance = Infinity;

    const primaryPartCenterX =
      (primaryPart.bounds[0].x + primaryPart.bounds[1].x) / 2;
    const primaryPartBottomY = primaryPart.bounds[3].y;

    for (const ratingText of ratingTexts) {
      const ratingCenterX =
        (ratingText.bounds[0].x + ratingText.bounds[1].x) / 2;
      const ratingTopY = ratingText.bounds[0].y;

      const horizontalDist = Math.abs(primaryPartCenterX - ratingCenterX);
      const verticalDist = ratingTopY - primaryPartBottomY;

      if (
        verticalDist > 0 &&
        verticalDist < VERTICAL_PAIRING_TOLERANCE &&
        horizontalDist < HORIZONTAL_PAIRING_TOLERANCE
      ) {
        const distance = Math.sqrt(
          horizontalDist * horizontalDist + verticalDist * verticalDist
        );
        if (distance < minRatingDistance) {
          minRatingDistance = distance;
          closestRating = ratingText;
        }
      }
    }

    if (closestRating) {
      let secondaryPart: OcrResult | null = null;
      let minSecondaryDist = Infinity;

      for (const possibleSecondary of potentialNameParts) {
        if (possibleSecondary === primaryPart) continue;

        const isBelowPrimary =
          possibleSecondary.bounds[0].y > primaryPart.bounds[3].y;
        const isAboveRating =
          possibleSecondary.bounds[3].y < closestRating.bounds[0].y;
        const isAligned =
          Math.abs(possibleSecondary.bounds[0].x - primaryPart.bounds[0].x) <
          HORIZONTAL_PAIRING_TOLERANCE;

        if (isBelowPrimary && isAboveRating && isAligned) {
          const dist = possibleSecondary.bounds[0].y - primaryPart.bounds[3].y;
          if (dist < minSecondaryDist) {
            minSecondaryDist = dist;
            secondaryPart = possibleSecondary;
          }
        }
      }

      let finalName = primaryPart.text;
      let finalBounds = primaryPart.bounds;
      if (secondaryPart) {
        finalName += ` ${secondaryPart.text}`;
        finalBounds[2] = secondaryPart.bounds[2];
        finalBounds[3] = secondaryPart.bounds[3];
        potentialNameParts.splice(potentialNameParts.indexOf(secondaryPart), 1);
      }

      championData.push({
        name: finalName,
        rating: closestRating.text,
        nameBounds: finalBounds,
        ratingBounds: closestRating.bounds,
      });

      ratingTexts.splice(ratingTexts.indexOf(closestRating), 1);
      potentialNameParts.splice(potentialNameParts.indexOf(primaryPart), 1);
    }
  }

  if (championData.length === 1) {
    const champ = championData[0];
    const nameBounds = champ.nameBounds;
    const ratingBounds = champ.ratingBounds;
    const ratingText = champ.rating;

    const ratingWidth = ratingBounds[1].x - ratingBounds[0].x;
    const numCharsInRating = ratingText.length;
    const avgCharWidth = ratingWidth / numCharsInRating;
    const cellWidth = avgCharWidth * SINGLE_CHAMP_CELL_WIDTH_MULTIPLIER;

    const cellHeight = cellWidth * SINGLE_CHAMP_CELL_ASPECT_RATIO;

    const nameCenter_x = (nameBounds[0].x + nameBounds[1].x) / 2;

    const cellBottom = ratingBounds[2].y + SINGLE_CHAMP_CELL_BOTTOM_PADDING;
    const cellTop = cellBottom - cellHeight;

    const cellLeft = nameCenter_x - cellWidth / 2;
    const cellRight = nameCenter_x + cellWidth / 2;

    const singleCell: ChampionGridCell = {
      bounds: [
        { x: cellLeft, y: cellTop },
        { x: cellRight, y: cellTop },
        { x: cellRight, y: cellBottom },
        { x: cellLeft, y: cellBottom },
      ],
      championName: champ.name,
      powerRating: champ.rating,
    };

    const grid: ChampionGridCell[][] = [[singleCell]];
    grid[0][0] = singleCell;

    return { grid, topBoundary };
  }

  if (championData.length === 0) {
    console.log("[DEBUG] Could not pair any champions with ratings.");
    return { grid: [], topBoundary: 0 };
  }

  // Grid estimation based on rating positions
  const positions = championData.map((entry) => ({
    x: entry.ratingBounds[3].x,
    y: entry.ratingBounds[3].y,
  }));
  const sortedX = [...new Set(positions.map((p) => p.x))].sort((a, b) => a - b);
  const sortedY = [...new Set(positions.map((p) => p.y))].sort((a, b) => a - b);

  const columnStarts: number[] = [];
  if (sortedX.length > 0) {
    columnStarts.push(sortedX[0]);
    for (let i = 1; i < sortedX.length; i++) {
      if (
        sortedX[i] >
        columnStarts[columnStarts.length - 1] + GRID_PIXEL_TOLERANCE
      ) {
        columnStarts.push(sortedX[i]);
      }
    }
  }

  const rowStarts: number[] = [];
  if (sortedY.length > 0) {
    rowStarts.push(sortedY[0]);
    for (let i = 1; i < sortedY.length; i++) {
      if (sortedY[i] > rowStarts[rowStarts.length - 1] + GRID_PIXEL_TOLERANCE) {
        rowStarts.push(sortedY[i]);
      }
    }
  }

  const numCols = columnStarts.length;
  let numRows = rowStarts.length;

  if (numCols === 0 || numRows === 0) return { grid: [], topBoundary: 0 };

  const avgColDist =
    numCols > 1
      ? (columnStarts[numCols - 1] - columnStarts[0]) / (numCols - 1)
      : ((await sharp(imageBuffer).metadata()).width || 0) / 7;
  const avgRowDist =
    numRows > 1
      ? (rowStarts[numRows - 1] - rowStarts[0]) / (numRows - 1)
      : avgColDist * 0.95;

  const cellWidth = avgColDist * COL_WIDTH_RATIO;
  const cellHeight = avgRowDist * ROW_HEIGHT_RATIO;

  let grid: ChampionGridCell[][] = Array(numRows)
    .fill(0)
    .map(() =>
      Array(numCols)
        .fill(0)
        .map(() => ({ bounds: [] }))
    );

  // Create grid cells with bounds
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const x_center =
        columnStarts[c] +
        avgColDist / 2 -
        cellWidth * X_CENTER_ADJUSTMENT_RATIO;
      const y_center =
        rowStarts[r] - avgRowDist / 2 + cellHeight * Y_CENTER_ADJUSTMENT_RATIO;

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
        ],
      };
    }
  }

  if (topBoundary > 0) {
    grid = grid.filter((row) => {
      const firstCell = row[0];
      if (!firstCell) return false;
      const rowTop = firstCell.bounds[0].y;
      return rowTop > topBoundary;
    });
  }

  if (debugMode)
    console.log(
      `[DEBUG] Placing ${championData.length} identified champions into the grid...`
    );
  for (const champ of championData) {
    const centerX = (champ.nameBounds[0].x + champ.nameBounds[1].x) / 2;
    const centerY = (champ.nameBounds[0].y + champ.nameBounds[2].y) / 2;

    let bestCell: { r: number; c: number } | null = null;
    let minDist = Infinity;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const cell = grid[r][c];
        const [topLeft, , bottomRight] = cell.bounds;
        if (
          centerX >= topLeft.x &&
          centerX <= bottomRight.x &&
          centerY >= topLeft.y &&
          centerY <= bottomRight.y
        ) {
          const cellCenterX = (topLeft.x + bottomRight.x) / 2;
          const cellCenterY = (topLeft.y + bottomRight.y) / 2;
          const dist = Math.sqrt(
            Math.pow(centerX - cellCenterX, 2) +
              Math.pow(centerY - cellCenterY, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            bestCell = { r, c };
          }
        }
      }
    }

    if (bestCell) {
      if (debugMode)
        console.log(
          `[DEBUG] Placing '${champ.name}' (${champ.rating}) into grid cell [${bestCell.r}, ${bestCell.c}].`
        );
      grid[bestCell.r][bestCell.c].championName = champ.name;
      grid[bestCell.r][bestCell.c].powerRating = champ.rating;
    } else {
      if (debugMode)
        console.warn(
          `[DEBUG] Could not find a grid cell for champion '${champ.name}'.`
        );
    }
  }

  const allChampions = await prisma.champion.findMany();
  const fuse = new Fuse(allChampions, {
    keys: ["name", "shortName"],
    includeScore: true,
    threshold: 0.4,
  });

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell.championName) {
        const results = fuse.search(cell.championName);
        if (results.length > 0) {
          cell.championName = results[0].item.shortName;
          const { isAwakened, awakenedCheckBounds } = await isChampionAwakened(
            imageBuffer,
            cell.bounds,
            debugMode
          );
          cell.isAwakened = isAwakened;
          cell.awakenedCheckBounds = awakenedCheckBounds;
        }
      }
    }
  }

  if (grid.length > 0) {
    const lastRow = grid[grid.length - 1];
    let lastChampionIndex = -1;
    for (let c = lastRow.length - 1; c >= 0; c--) {
      if (lastRow[c].championName) {
        lastChampionIndex = c;
        break;
      }
    }
    grid[grid.length - 1] = lastRow.slice(0, lastChampionIndex + 1);
  }

  return { grid, topBoundary };
}

async function isChampionAwakened(
  imageBuffer: Buffer,
  bounds: Vertex[],
  debugMode: boolean
): Promise<{ isAwakened: boolean; awakenedCheckBounds: Vertex[] }> {
  // --- Constants for tuning the awakened gem detection ---
  // The width of the color strip to check, as a ratio of the cell width.
  const STRIP_WIDTH_RATIO = 0.4;
  // The height of the color strip to check, as a ratio of the cell height.
  const STRIP_HEIGHT_RATIO = 0.1;
  // The vertical offset of the color strip from the top of the cell, as a ratio of the cell height.
  const STRIP_Y_OFFSET_RATIO = 0.6;
  // The average blue value a pixel must have to be considered part of an awakened gem.
  const AWAKENED_BLUE_THRESHOLD = 90;

  const [topLeft, , bottomRight] = bounds;
  const boxWidth = bottomRight.x - topLeft.x;
  const boxHeight = bottomRight.y - topLeft.y;

  const stripWidth = Math.floor(boxWidth * STRIP_WIDTH_RATIO);
  const stripHeight = Math.floor(boxHeight * STRIP_HEIGHT_RATIO);
  const stripX = Math.floor(topLeft.x + (boxWidth - stripWidth) / 2);
  const stripY = Math.floor(topLeft.y + boxHeight * STRIP_Y_OFFSET_RATIO);

  const awakenedCheckBounds: Vertex[] = [
    { x: stripX, y: stripY },
    { x: stripX + stripWidth, y: stripY },
    { x: stripX + stripWidth, y: stripY + stripHeight },
    { x: stripX, y: stripY + stripHeight },
  ];

  const strip = await sharp(imageBuffer)
    .extract({
      left: stripX,
      top: stripY,
      width: stripWidth,
      height: stripHeight,
    })
    .raw()
    .toBuffer();

  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < strip.length; i += 3) {
    r += strip[i];
    g += strip[i + 1];
    b += strip[i + 2];
  }

  const numPixels = strip.length / 3;
  const avgBlue = b / numPixels;

  if (debugMode) {
    console.log(
      `[DEBUG] Awakened check for champion at [${bounds[0].x.toFixed(
        0
      )}, ${bounds[0].y.toFixed(0)}]: avgBlue = ${avgBlue.toFixed(2)}`
    );
  }

  return { isAwakened: avgBlue > AWAKENED_BLUE_THRESHOLD, awakenedCheckBounds };
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download image from ${url}: ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getRoster(
  playerId: string,
  stars: number | null,
  rank: number | null,
  isAscended: boolean | null
): Promise<RosterWithChampion[] | string> {
  const where: any = { playerId };
  if (stars) {
    where.stars = stars;
  }
  if (rank) {
    where.rank = rank;
  }
  if (isAscended !== null) {
    where.isAscended = isAscended;
  }

  const rosterEntries = await prisma.roster.findMany({
    where,
    include: { champion: true },
    orderBy: [{ stars: "desc" }, { rank: "desc" }],
  });

  if (rosterEntries.length === 0) {
    return "No champions found in the roster that match the criteria.";
  }

  return rosterEntries;
}

export async function importRosterFromSheet(playerId: string) {
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    console.error(`Player with ID ${playerId} not found.`);
    return;
  }

  const sheetName = "Roster";
  const headerRange = `${sheetName}!B2:BI2`;
  const championNamesRange = `${sheetName}!A5:A`;

  const [playerNames, championNames] = await sheetsService.readSheets(
    config.MCOC_SHEET_ID,
    [headerRange, championNamesRange]
  );

  if (!playerNames || !championNames) {
    console.error("Failed to read player or champion names from the sheet.");
    return;
  }

  const playerIndex = playerNames[0].findIndex(
    (name) => name.toLowerCase() === player.ingameName.toLowerCase()
  );

  if (playerIndex === -1) {
    console.log(
      `Player ${player.ingameName} not found in the sheet, skipping roster import.`
    );
    return;
  }

  const rosterDataToCreate: Prisma.RosterCreateManyInput[] = [];
  const allChampions = await prisma.champion.findMany();
  const championMap = new Map(
    allChampions.map((c) => [c.name.toLowerCase(), c])
  );

  for (const stars of [6, 7]) {
    const columnIndex = playerIndex + (stars === 6 ? 1 : 2);
    const columnLetter = String.fromCharCode(65 + (columnIndex % 26));
    const columnPrefix =
      columnIndex >= 26
        ? String.fromCharCode(65 + Math.floor(columnIndex / 26) - 1)
        : "";
    const targetColumn = `${columnPrefix}${columnLetter}`;
    const targetRange = `${sheetName}!${targetColumn}5:${targetColumn}`;

    const rosterColumn = await sheetsService.readSheet(
      config.MCOC_SHEET_ID,
      targetRange
    );

    if (rosterColumn) {
      for (let i = 0; i < rosterColumn.length; i++) {
        const sheetValue = rosterColumn[i][0];
        if (sheetValue && championNames[i] && championNames[i][0]) {
          const champion = championMap.get(championNames[i][0].toLowerCase());
          if (champion) {
            const sheetRank = parseInt(sheetValue.replace("*", ""));
            const isAwakened = sheetValue.includes("*");
            let dbRank = sheetRank;
            let isAscended = false;

            if (stars === 6 && sheetRank === 6) {
              dbRank = 5;
              isAscended = true;
            }

            rosterDataToCreate.push({
              playerId,
              championId: champion.id,
              stars,
              rank: dbRank,
              isAwakened,
              isAscended,
            });
          }
        }
      }
    }
  }

  if (rosterDataToCreate.length > 0) {
    await prisma.roster.createMany({
      data: rosterDataToCreate,
      skipDuplicates: true,
    });
    console.log(
      `Successfully imported ${rosterDataToCreate.length} champions for ${player.ingameName}.`
    );
  }
}

export async function deleteRoster(
  where: Prisma.RosterWhereInput
): Promise<string> {
  const { count } = await prisma.roster.deleteMany({
    where,
  });
  return `Successfully deleted ${count} champions from the roster`;
}
