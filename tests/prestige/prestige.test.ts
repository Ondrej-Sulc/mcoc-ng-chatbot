import { describe, it, expect } from "vitest";
import fs from "fs/promises";
import path from "path";
import { extractPrestigeFromImage } from "../../src/commands/prestige";

const IMAGES_DIR = path.join(__dirname, "images");

type ExpectedPrestige = {
  summoner: number;
  champion: number;
  relic: number;
};

function parseFilename(filename: string): ExpectedPrestige {
  const parts = path.basename(filename, path.extname(filename)).split("_");
  const result: Partial<ExpectedPrestige> = {};
  for (const part of parts) {
    const [key, value] = part.split("-");
    const numValue = parseInt(value, 10);
    if (isNaN(numValue)) continue;

    if (key === "s") {
      result.summoner = numValue;
    } else if (key === "c") {
      result.champion = numValue;
    } else if (key === "r") {
      result.relic = numValue;
    }
  }
  if (
    typeof result.summoner !== "number" ||
    typeof result.champion !== "number" ||
    typeof result.relic !== "number"
  ) {
    throw new Error(
      `Filename "${filename}" does not contain valid prestige values.`
    );
  }
  return result as ExpectedPrestige;
}

describe("Prestige Command OCR Parsing", async () => {
  let imageFiles: string[];

  try {
    imageFiles = (await fs.readdir(IMAGES_DIR)).filter((file) =>
      /\.(png|jpg|jpeg)$/i.test(file)
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(
        `Test images directory not found at ${IMAGES_DIR}. Skipping prestige tests.`
      );
      imageFiles = [];
    } else {
      throw error;
    }
  }

  if (imageFiles.length === 0) {
    it.skip("No images found to test in tests/prestige/images", () => {});
    return;
  }

  it.each(imageFiles)(
    "should correctly parse prestige from %s",
    async (filename) => {
      const expected = parseFilename(filename);
      const imagePath = path.join(IMAGES_DIR, filename);
      const imageBuffer = await fs.readFile(imagePath);

      const result = await extractPrestigeFromImage(imageBuffer);

      expect(result.success).toBe(true);
      expect(result.summonerPrestige).toBe(expected.summoner);
      expect(result.championPrestige).toBe(expected.champion);
      expect(result.relicPrestige).toBe(expected.relic);
    },
    { timeout: 90000 } // 90s timeout per image
  );
});