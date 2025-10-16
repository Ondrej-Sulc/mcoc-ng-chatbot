import sharp from "sharp";
import Tesseract from "tesseract.js";
import { PrestigeResult, OCRResult } from "./types";

export const recognizeWithTimeout = (
  image: Tesseract.ImageLike,
  lang: string,
  timeoutMs = 60000
) => {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(`OCR recognition timed out after ${timeoutMs / 1000}s.`)
        ),
      timeoutMs
    )
  );
  return Promise.race([Tesseract.recognize(image, lang), timeoutPromise]);
};

function parsePrestigesFromOcr(text: string): OCRResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // More specific keyword patterns
  const patterns: Record<keyof OCRResult, RegExp> = {
    summoner: /top\s+\d{2}\s+prestige/i,
    champion: /champion/i,
    relic: /relic/i,
  };

  // Clean a matched numeric token: remove non-digits and return integer
  const normalizeNumber = (raw: string): number | null => {
    if (!raw) return null;
    // Keep only digits (remove dots, commas, spaces, currency, etc.)
    const digits = raw.replace(/[^0-9]/g, "");
    if (!digits) return null;
    // parse as integer (these are prestige totals, not floats)
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : null;
  };

  // Try to extract number from a line by looking for it AFTER the keyword
  const extractFromLine = (line: string, keyRx: RegExp): number | null => {
    const match = line.match(keyRx);
    if (!match) return null;
    const fromIndex = (match.index ?? 0) + match[0].length;
    const restOfLine = line.substring(fromIndex);

    const numMatches = restOfLine.match(/[0-9][0-9.,\s]*/g);
    if (!numMatches || numMatches.length === 0) return null;

    // Take the first valid number found after the keyword
    for (const numCandidate of numMatches) {
      const n = normalizeNumber(numCandidate);
      if (n !== null) return n;
    }
    return null;
  };

  // If no matching line, try searching nearby the keyword index in the whole text
  const extractNearKeyword = (keyRx: RegExp): number | null => {
    // first try line-based extraction
    for (const line of lines) {
      if (keyRx.test(line)) {
        const v = extractFromLine(line, keyRx);
        if (v !== null) return v;
        // sometimes number is on next line
        const nextIdx = lines.indexOf(line) + 1;
        if (nextIdx > 0 && nextIdx < lines.length) {
          // For next line, we don't need the keyword logic
          const lineMatches = lines[nextIdx].match(/[0-9][0-9.,\s]*/g);
          if (lineMatches && lineMatches.length > 0) {
            const v2 = normalizeNumber(lineMatches[0]);
            if (v2 !== null) return v2;
          }
        }
      }
    }
    // fallback: look in full text near the keyword occurrence
    const m = text.match(keyRx);
    if (!m) return null;
    const idx = (m.index ?? 0) + m[0].length;
    const window = text.slice(idx, idx + 40); // Look forward from keyword
    const numMatch = window.match(/[0-9][0-9.,\s]*/);
    return numMatch ? normalizeNumber(numMatch[0]) : null;
  };

  return {
    summoner: extractNearKeyword(patterns.summoner) || 0,
    champion: extractNearKeyword(patterns.champion) || 0,
    relic: extractNearKeyword(patterns.relic) || 0,
  };
}

async function meanLuminance(buf: Buffer): Promise<number> {
  // returns mean luminance [0..255]
  const stats = await sharp(buf).stats();
  // stats.channels is array of { mean, stdev, min, max } for R, G, B (maybe A)
  const r = stats.channels[0].mean ?? 0;
  const g = stats.channels[1].mean ?? 0;
  const b = stats.channels[2].mean ?? 0;
  // standard luminance weights
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

async function invertIfDark(buf: Buffer, threshold = 130): Promise<Buffer> {
  // If mean luminance < threshold, invert colors (useful for light-on-dark text)
  const lum = await meanLuminance(buf);
  if (lum < threshold) {
    // negate alpha? usually don't invert alpha channel
    return sharp(buf).negate({ alpha: false }).toBuffer();
  }
  return buf;
}

export async function extractPrestigeFromImage(
  imageBuffer: Buffer,
  debug = false
): Promise<PrestigeResult> {
  const meta = await sharp(imageBuffer).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;

  const maybeInverted = await invertIfDark(imageBuffer, 130);

  const processedImage = await sharp(maybeInverted)
    .rotate()
    .grayscale()
    .normalize()
    .sharpen()
    .toBuffer();

  const debugInfo: NonNullable<PrestigeResult["debugInfo"]> = {};

  try {
    const side = Math.min(W, H);
    const squareLeft = Math.round((W - side) / 2);
    const squareTop = Math.round((H - side) / 2);
    const finalLeft = squareLeft + Math.round(side * 0.3);
    const finalTop = squareTop;
    const finalWidth = Math.round(side * 0.85);
    const finalHeight = Math.round(side * 0.9);
    const scale = Math.max(1, Math.floor(1400 / Math.max(1, W)));
    const resizeOpt = scale > 1 ? { width: W * scale } : undefined;

    const cropped = await sharp(processedImage)
      .extract({
        left: finalLeft,
        top: finalTop,
        width: finalWidth,
        height: finalHeight,
      })
      .resize(resizeOpt)
      .toBuffer();
    if (debug) debugInfo.croppedImage = cropped;

    const { data: cropData } = await recognizeWithTimeout(cropped, "eng");
    if (debug) {
      debugInfo.cropAttempt = { text: cropData?.text };
    }

    const labelResultCrop = parsePrestigesFromOcr(cropData?.text || "");

    if (labelResultCrop) {
      if (debug && debugInfo.cropAttempt)
        debugInfo.cropAttempt.detectedLabels = labelResultCrop;
      const { summoner, champion, relic } = labelResultCrop;
      if (summoner > 0 && summoner === champion + relic) {
        return {
          success: true,
          summonerPrestige: summoner,
          championPrestige: champion,
          relicPrestige: relic,
          debugInfo: debug ? debugInfo : undefined,
        };
      }
    }
  } catch (e) {
    if (debug) {
      if (!debugInfo.cropAttempt) debugInfo.cropAttempt = {};
      const errorMessage = e instanceof Error ? e.message : String(e);
      debugInfo.cropAttempt.error = errorMessage;
    }
    // Ignore crop errors and proceed to full image
  }

  try {
    const { data: fullData } = await recognizeWithTimeout(
      processedImage,
      "eng"
    );
    if (debug) {
      debugInfo.fullAttempt = { text: fullData?.text };
    }

    const labelResultFull = parsePrestigesFromOcr(fullData?.text || "");

    if (labelResultFull && labelResultFull.summoner > 0) {
      if (debug && debugInfo.fullAttempt)
        debugInfo.fullAttempt.detectedLabels = labelResultFull;
      const { summoner, champion, relic } = labelResultFull;
      return {
        success: true,
        summonerPrestige: summoner,
        championPrestige: champion,
        relicPrestige: relic,
        fallback: true,
        debugInfo: debug ? debugInfo : undefined,
      };
    }
  } catch (e) {
    if (debug) {
      if (!debugInfo.fullAttempt) debugInfo.fullAttempt = {};
      const errorMessage = e instanceof Error ? e.message : String(e);
      debugInfo.fullAttempt.error = errorMessage;
    }
    return {
      success: false,
      error: "OCR failed on both cropped and full image.",
      debugInfo: debug ? debugInfo : undefined,
    };
  }

  return {
    success: false,
    error: "Could not detect prestige values from image labels.",
    debugInfo: debug ? debugInfo : undefined,
  };
}
