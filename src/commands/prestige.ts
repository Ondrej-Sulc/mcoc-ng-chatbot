import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  MessageFlags,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";
import sharp from "sharp";
import Tesseract from "tesseract.js";

type PrestigeResult = {
  summonerPrestige: number;
  championPrestige: number;
  relicPrestige: number;
  fallback?: boolean;
};

export async function extractPrestigeFromImage(
  imageUrl: string
): Promise<PrestigeResult> {
  // Node >=18 has global fetch; otherwise install node-fetch
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const meta = await sharp(buf).metadata();
  const W = meta.width ?? 0;
  const H = meta.height ?? 0;

  // Crop a fixed percent from the left (tweak 0.28-0.40 if needed)
  const cropLeftPercent = 0.36;
  const left = Math.max(0, Math.round(W * cropLeftPercent));
  const rightPad = Math.round(W * 0.02);
  const cropWidth = Math.max(W - left - rightPad, 40);

  const normalizeDigits = (s: string) =>
    s
      .replace(/[OoQqD]/g, "0")
      .replace(/[lI\|]/g, "1")
      .replace(/[Ss]/g, "5")
      .replace(/[^\d,]/g, "");

  const parseNumbers = (text: string) =>
    (text.match(/[\d,]{2,}/g) || [])
      .map((t) => parseInt(normalizeDigits(t).replace(/,/g, ""), 10))
      .filter((n) => !Number.isNaN(n));

  // 1) Try cropped region OCR with digit whitelist (cleaner numeric result)
  try {
    const cropped = await sharp(buf)
      .extract({ left, top: 0, width: cropWidth, height: H })
      .toBuffer();

    const { data: cropData } = await Tesseract.recognize(cropped, "eng", {
      // whitelist digits and comma so OCR focuses on numbers
      // @ts-ignore: tessedit_char_whitelist is a valid Tesseract parameter but not in WorkerOptions type
      // This is a known issue with tesseract.js types.
      tessedit_char_whitelist: "0123456789,", 
      logger: () => undefined,
    });

    const numsCrop = parseNumbers(cropData?.text || "");
    if (numsCrop.length >= 3) {
      const lastThree = numsCrop.slice(-3);
      const s = lastThree[0],
        c = lastThree[1],
        r = lastThree[2];
      if (s === c + r) {
        return {
          summonerPrestige: s,
          championPrestige: c,
          relicPrestige: r,
        };
      }
      // if validation fails, fall back to full-image parsing
    }
  } catch (e) {
    // ignore crop failures and fall back to full OCR
  }

  // 2) Full-image OCR without whitelist and label-based parsing
  const { data: fullData } = await Tesseract.recognize(buf, "eng", {
    logger: () => undefined,
  });

  const rawText = fullData?.text || "";
  const lines: string[] =
    fullData?.lines?.map((l: any) => l.text).filter(Boolean) ||
    rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

  const findByLabel = (regexes: RegExp[]) => {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!regexes.some((rx) => rx.test(line))) continue;

      const nums = line.match(/[\d,]+/g);
      if (nums?.length) {
        return parseInt(
          normalizeDigits(nums[nums.length - 1]).replace(/,/g, ""),
          10
        );
      }

      const dline = fullData?.lines?.[i];
      if (dline?.words) {
        const wordNum = dline.words
          .map((w: any) => w.text)
          .reverse()
          .find((w: string) => /[\d,]+/.test(w));
        if (wordNum) {
          return parseInt(normalizeDigits(wordNum).replace(/,/g, ""), 10);
        }
      }

      for (let j = 1; j <= 2; j++) {
        const next = lines[i + j];
        if (!next) continue;
        const n = next.match(/[\d,]+/g);
        if (n?.length) {
          return parseInt(normalizeDigits(n[0]).replace(/,/g, ""), 10);
        }
      }
    }
    return null;
  };

  const summoner = findByLabel([
    /summoner'?s?\s*prestige/i,
    /summoner prestige/i,
  ]);
  const champion = findByLabel([/champion\s*prestige/i, /champion prestige/i]);
  const relic = findByLabel([/relic\s*prestige/i, /relic prestige/i]);

  if (summoner !== null && champion !== null && relic !== null) {
    return {
      summonerPrestige: summoner,
      championPrestige: champion,
      relicPrestige: relic,
      fallback: true,
    };
  }

  // Last resort: last 3 numeric tokens from full OCR
  const allNums = parseNumbers(rawText);
  if (allNums.length >= 3) {
    const lastThree = allNums.slice(-3);
    return {
      summonerPrestige: lastThree[0],
      championPrestige: lastThree[1],
      relicPrestige: lastThree[2],
      fallback: true,
    };
  }

  throw new Error("Could not detect prestige values from image.");
}

/**
 * Core logic for the /prestige command.
 */
export async function core(params: {
  userId: string;
  imageUrl: string;
}): Promise<CommandResult> {
  try {
    const { imageUrl } = params;

    const { summonerPrestige, championPrestige, relicPrestige } =
      await extractPrestigeFromImage(imageUrl);

    // Validation check
    const isValid = summonerPrestige === championPrestige + relicPrestige;

    let message = `**Prestige Values Detected:**\n`;
    message += `🏆 Summoner Prestige: ${summonerPrestige}\n`;
    message += `⚔️ Champion Prestige: ${championPrestige}\n`;
    message += `🔮 Relic Prestige: ${relicPrestige}\n`;
    message += `\nValidation: ${isValid ? "✅ Passed" : "❌ Failed"}`;

    return { content: message };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:prestige:core",
      userId: params.userId,
    });
    return { content: userMessage };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("prestige")
    .setDescription("Extract prestige values from an MCOC screenshot.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription(
          "Screenshot of your MCOC profile showing prestige values."
        )
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});
    try {
      const image = interaction.options.getAttachment("image") as Attachment;
      if (!image || !image.url) {
        throw new Error("No image provided.");
      }

      const result = await core({
        userId: interaction.user.id,
        imageUrl: image.url,
      });

      await interaction.editReply({
        content: result.content || "No content to display.",
      });
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:prestige",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};
