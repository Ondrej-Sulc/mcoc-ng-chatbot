import { OcrResult } from "./types";

export function processOcrDetections(detections: any[]): OcrResult[] {
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

export function ocrCorrection(text: string): string {
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

export function mergeOcrResults(
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
