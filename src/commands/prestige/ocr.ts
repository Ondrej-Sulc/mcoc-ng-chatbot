import sharp from 'sharp';
import { google } from '@google-cloud/vision/build/protos/protos';
import { PrestigeResult, OCRResult } from './types';
import { getGoogleVisionService } from '../../services/googleVisionService';
import logger from '../../services/loggerService';

type IEntityAnnotation = google.cloud.vision.v1.IEntityAnnotation;
type IVertex = google.cloud.vision.v1.IVertex;

interface OcrLabel {
  text: string;
  bounds: google.cloud.vision.v1.IBoundingPoly | null | undefined;
}

interface OcrNumber {
  value: number;
  bounds: google.cloud.vision.v1.IBoundingPoly | null | undefined;
}

const CROP_CONFIG = {
  sideMultiplier: 0.3,
  widthMultiplier: 0.85,
  heightMultiplier: 0.9,
};

function extractLabelsAndNumbers(detections: IEntityAnnotation[]): {
  labels: OcrLabel[];
  numbers: OcrNumber[];
} {
  const labels: OcrLabel[] = [];
  const numbers: OcrNumber[] = [];
  const keywordPatterns = [/prestige/i, /^champion$/i, /relic/i];

  if (detections.length < 2) {
    return { labels, numbers };
  }

  for (let i = 1; i < detections.length; i++) {
    const detection = detections[i];
    const text = detection.description;

    if (!text || !detection.boundingPoly) continue;

    if (keywordPatterns.some((p) => p.test(text))) {
      labels.push({ text, bounds: detection.boundingPoly });
    } else if (/^\d{3,}$/.test(text.replace(/[^0-9]/g, ''))) {
      const numericValue = parseInt(text.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(numericValue)) {
        numbers.push({ value: numericValue, bounds: detection.boundingPoly });
      }
    }
  }

  labels.sort(
    (a, b) => (a.bounds?.vertices?.[0]?.y ?? 0) - (b.bounds?.vertices?.[0]?.y ?? 0)
  );
  numbers.sort(
    (a, b) => (a.bounds?.vertices?.[0]?.y ?? 0) - (b.bounds?.vertices?.[0]?.y ?? 0)
  );

  return { labels, numbers };
}

function findBestMatch(
  label: OcrLabel,
  numbers: OcrNumber[]
): OcrNumber | null {
  let bestMatch: OcrNumber | null = null;
  let minVerticalDistance = Infinity;

  if (!label.bounds?.vertices) return null;

  const labelCenterY =
    ((label.bounds.vertices[0].y ?? 0) + (label.bounds.vertices[3].y ?? 0)) / 2;
  const labelRightX = Math.max(
    label.bounds.vertices[1]?.x ?? 0,
    label.bounds.vertices[2]?.x ?? 0
  );

  for (const number of numbers) {
    if (!number.bounds?.vertices) continue;

    const numberCenterY =
      ((number.bounds.vertices[0].y ?? 0) +
        (number.bounds.vertices[3].y ?? 0)) /
      2;
    const verticalDistance = Math.abs(labelCenterY - numberCenterY);
    const numberLeftX = Math.min(
      number.bounds.vertices[0]?.x ?? 0,
      number.bounds.vertices[3]?.x ?? 0
    );

    if (numberLeftX > labelRightX && verticalDistance < minVerticalDistance) {
      minVerticalDistance = verticalDistance;
      bestMatch = number;
    }
  }
  return bestMatch;
}

function parsePrestigesFromOcr(
  labels: OcrLabel[],
  numbers: OcrNumber[]
): OCRResult {

  if (labels.length < 3 || numbers.length < 3) {
    return { summoner: 0, champion: 0, relic: 0 };
  }

  const result: OCRResult = { summoner: 0, champion: 0, relic: 0 };
  const availableNumbers = [...numbers];

  for (const label of labels) {
    const bestMatch = findBestMatch(label, availableNumbers);

    if (bestMatch) {
      if (/prestige/i.test(label.text)) {
        result.summoner = bestMatch.value;
      } else if (/champion/i.test(label.text)) {
        result.champion = bestMatch.value;
      } else if (/relic/i.test(label.text)) {
        result.relic = bestMatch.value;
      }
      const index = availableNumbers.indexOf(bestMatch);
      if (index > -1) {
        availableNumbers.splice(index, 1);
      }
    }
  }

  return result;
}

async function processOcrAttempt(
  imageBuffer: Buffer,
  debug: boolean,
  debugInfo: NonNullable<PrestigeResult['debugInfo']>,
  isCropped: boolean
): Promise<PrestigeResult> {
  const googleVisionService = await getGoogleVisionService();
  const attemptKey = isCropped ? 'cropAttempt' : 'fullAttempt';
  try {
    const detections = await googleVisionService.detectText(imageBuffer);
    logger.info(
      `Found ${detections.length} text detections in ${
        isCropped ? 'cropped' : 'full'
      } image.`
    );
    if (debug) {
      debugInfo[attemptKey] = { text: detections[0]?.description };
      logger.debug(
        { detections },
        `OCR detections from ${isCropped ? 'cropped' : 'full'} image:`
      );
    }

    const { labels, numbers } = extractLabelsAndNumbers(detections);
    const labelResult = parsePrestigesFromOcr(labels, numbers);

    logger.info(
      { result: labelResult },
      `Parsed prestige values from ${isCropped ? 'cropped' : 'full'} image.`
    );

    if (debug && debugInfo[attemptKey]) {
      (debugInfo[attemptKey] as any).detectedLabels = labelResult;
      (debugInfo[attemptKey] as any).extracted = { labels, numbers };
    }

    const { summoner, champion, relic } = labelResult;
    const success = summoner > 0 && summoner === champion + relic;

    return {
      success: success,
      summonerPrestige: summoner,
      championPrestige: champion,
      relicPrestige: relic,
      fallback: !isCropped,
      debugInfo: debug ? debugInfo : undefined,
    };
  } catch (e) {
    logger.error(
      e,
      `Error during prestige extraction from ${
        isCropped ? 'cropped' : 'full'
      } image.`
    );
    if (debug) {
      if (!debugInfo[attemptKey]) (debugInfo as any)[attemptKey] = {};
      const errorMessage = e instanceof Error ? e.message : String(e);
      (debugInfo[attemptKey] as any).error = errorMessage;
    }
    return {
      success: false,
      summonerPrestige: 0,
      championPrestige: 0,
      relicPrestige: 0,
      error: e instanceof Error ? e.message : String(e),
      debugInfo: debug ? debugInfo : undefined,
    };
  }
}

export async function extractPrestigeFromImage(
  imageBuffer: Buffer,
  debug = false
): Promise<PrestigeResult> {
  logger.info('Starting prestige extraction from image.');
  if (debug) {
    logger.debug('Debug mode enabled for prestige extraction.');
  }

  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;
  logger.info(`Image dimensions: ${W}x${H}`);

  const debugInfo: NonNullable<PrestigeResult['debugInfo']> = {};

  // --- Cropped Image Attempt ---
  const side = Math.min(W, H);
  const squareLeft = Math.round((W - side) / 2);
  const squareTop = Math.round((H - side) / 2);
  let finalLeft = squareLeft + Math.round(side * CROP_CONFIG.sideMultiplier);
  let finalTop = squareTop;
  let finalWidth = Math.round(side * CROP_CONFIG.widthMultiplier);
  let finalHeight = Math.round(side * CROP_CONFIG.heightMultiplier);

  // Ensure crop area is within image bounds
  finalLeft = Math.max(0, finalLeft);
  finalTop = Math.max(0, finalTop);
  finalWidth = Math.min(finalWidth, W - finalLeft);
  finalHeight = Math.min(finalHeight, H - finalTop);

  // Ensure crop dimensions are at least 1x1
  if (finalWidth <= 0 || finalHeight <= 0) {
    logger.error(
      `Calculated crop area is too small or invalid after adjustments: left=${finalLeft}, top=${finalTop}, width=${finalWidth}, height=${finalHeight}, imageW=${W}, imageH=${H}`
    );
    return {
      success: false,
      summonerPrestige: 0,
      championPrestige: 0,
      relicPrestige: 0,
      error: "Calculated crop area is too small or invalid.",
      debugInfo: debug ? debugInfo : undefined,
    };
  }

  const croppedImageBuffer = await sharp(imageBuffer)
    .extract({
      left: finalLeft,
      top: finalTop,
      width: finalWidth,
      height: finalHeight,
    })
    .toBuffer();
  logger.info('Image cropped for initial OCR attempt.');
  if (debug) {
    debugInfo.croppedImage = croppedImageBuffer;
  }

  const croppedResult = await processOcrAttempt(
    croppedImageBuffer,
    debug,
    debugInfo,
    true
  );
  if (croppedResult.success) {
    return croppedResult;
  }

  // --- Fallback to Full Image ---
  logger.info('Falling back to full image for prestige extraction.');
  const fullResult = await processOcrAttempt(
    imageBuffer,
    debug,
    debugInfo,
    false
  );
  if (fullResult.success) {
    return fullResult;
  }

  logger.warn('Could not detect prestige values from image labels.');
  return {
    success: false,
    error: 'Could not detect prestige values from image labels.',
    summonerPrestige: 0,
    championPrestige: 0,
    relicPrestige: 0,
    debugInfo: debug ? debugInfo : undefined,
  };
}
