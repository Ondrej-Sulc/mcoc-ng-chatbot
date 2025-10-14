import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  AutocompleteInteraction,
  ComponentType,
  ButtonStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  AttachmentBuilder,
} from "discord.js";
import { Command, CommandResult } from "../types/command";

import sharp from "sharp";
import Tesseract from "tesseract.js";
import { PrismaClient, Player } from "@prisma/client";

const prisma = new PrismaClient();

function buildPrestigeConfirmationContainer(
  targetPlayer: Player,
  authorPlayer: Player
): ActionRowBuilder<ButtonBuilder> {
  const confirmationButtons =
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prestige:confirm:${targetPlayer.discordId}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`prestige:cancel:${targetPlayer.discordId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

  return confirmationButtons;
}

const recognizeWithTimeout = (
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

type PrestigeResult = {
  success: boolean;
  summonerPrestige?: number;
  championPrestige?: number;
  relicPrestige?: number;
  fallback?: boolean;
  error?: string;
  debugInfo?: {
    croppedImage?: Buffer;
    cropAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
    };
    fullAttempt?: {
      text?: string;
      detectedLabels?: { summoner: number; champion: number; relic: number };
      error?: string;
    };
  };
};

type OCRResult = {
  summoner: number;
  champion: number;
  relic: number;
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

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused();
  const guildId = interaction.guildId;
  if (!guildId) return;

  const players = await prisma.player.findMany({
    where: {
      guildId,
      ingameName: {
        contains: focusedValue,
        mode: "insensitive",
      },
    },
    take: 25,
  });

  await interaction.respond(
    players.map((player) => ({
      name: player.ingameName,
      value: player.discordId,
    }))
  );
}

async function handleUpdate(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const image = interaction.options.getAttachment("image") as Attachment;
  const targetUserId = interaction.options.getString("player") ?? undefined;

  if (!image || !image.url) {
    throw new Error("No image provided.");
  }

  const result = await core({
    userId: interaction.user.id,
    imageUrl: image.url,
    targetUserId,
    interaction,
  });

  if (result.isComponentsV2) {
    await interaction.editReply({
      flags: [MessageFlags.IsComponentsV2],
      components: result.components,
    });
  } else {
    await interaction.editReply({
      content: result.content,
      files: result.files,
      embeds: result.embeds,
    });
  }
}

async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const players = await prisma.player.findMany({
    where: {
      guildId,
      summonerPrestige: {
        not: null,
      },
    },
    orderBy: {
      summonerPrestige: "desc",
    },
    take: 10,
  });

  if (players.length === 0) {
    await interaction.editReply(
      "No players with prestige found in this server."
    );
    return;
  }

  let leaderboardString = "🏆 **Prestige Leaderboard** 🏆\n\n";
  players.forEach((p, index) => {
    leaderboardString += `${index + 1}. **${p.ingameName}** - ${
      p.summonerPrestige
    }\n`;
  });

  await interaction.editReply(leaderboardString);
}

export async function core(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  interaction: ChatInputCommandInteraction;
}): Promise<CommandResult> {
  const { userId, imageUrl, targetUserId, debug, interaction } = params;
  const finalUserId = targetUserId || userId;

  const authorPlayer = await prisma.player.findUnique({
    where: { discordId: userId },
  });
  if (!authorPlayer) {
    return {
      content: `You are not registered. Please register with \n/profile register\n first.`,
    };
  }

  const targetPlayer = await prisma.player.findUnique({
    where: { discordId: finalUserId },
  });

  if (!targetPlayer) {
    const content = targetUserId
      ? `Player with Discord ID ${targetUserId} is not registered. They must register with \n/profile register\n first.`
      : `You are not registered. Please register with \n/profile register\n first.`;
    return { content };
  }

  if (targetUserId && userId !== targetUserId) {
    const confirmationButtons = buildPrestigeConfirmationContainer(
      targetPlayer,
      authorPlayer
    );
    const message = await interaction.editReply({
      content: `Are you sure you want to update prestige for **${targetPlayer.ingameName}**?`,
      components: [confirmationButtons],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    return new Promise((resolve) => {
      collector.on("collect", async (i) => {
        if (i.user.id !== userId) {
          await i.reply({
            content: "You cannot respond to this confirmation.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        collector.stop();
        if (i.customId.startsWith("prestige:confirm")) {
          const result = await updatePrestige({
            ...params,
            player: targetPlayer,
          });
          resolve(result);
        } else {
          resolve({ content: "Prestige update cancelled." });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          resolve({ content: "Confirmation timed out." });
        }
      });
    });
  }

  return await updatePrestige({ ...params, player: targetPlayer });
}

async function updatePrestige(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  player: any;
}): Promise<CommandResult> {
  const { imageUrl, debug, player } = params;

  const res = await fetch(imageUrl);
  if (!res.ok) {
    return {
      content: `❌ **Error:** Failed to download image. Status: ${res.status}`,
    };
  }
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  const result = await extractPrestigeFromImage(imageBuffer, debug);

  if (debug) {
    const attachments: AttachmentBuilder[] = [];
    let debugContent = "## Prestige Debug Info\n";

    if (result.debugInfo?.croppedImage) {
      attachments.push(
        new AttachmentBuilder(result.debugInfo.croppedImage, {
          name: "cropped_debug.png",
        })
      );
    }

    debugContent += `**Success:** ${result.success}\n`;
    debugContent += `**Fallback Used:** ${result.fallback ?? false}\n`;
    if (result.error) {
      debugContent += `**Error:** ${result.error}\n`;
    }

    if (result.debugInfo?.cropAttempt) {
      debugContent += "\n### Crop Attempt\n";
      if (result.debugInfo.cropAttempt.error) {
        debugContent += `**Error:** ${result.debugInfo.cropAttempt.error}\n`;
      }
      if (result.debugInfo.cropAttempt.detectedLabels) {
        debugContent += `**Detected:** S: ${result.debugInfo.cropAttempt.detectedLabels.summoner}, C: ${result.debugInfo.cropAttempt.detectedLabels.champion}, R: ${result.debugInfo.cropAttempt.detectedLabels.relic}\n`;
      }
      if (result.debugInfo.cropAttempt.text) {
        debugContent +=
          "**OCR Text:**\n```\n" +
          result.debugInfo.cropAttempt.text.substring(0, 1000) +
          "\n```\n";
      }
    }

    if (result.debugInfo?.fullAttempt) {
      debugContent += "\n### Full Image Attempt\n";
      if (result.debugInfo.fullAttempt.error) {
        debugContent += `**Error:** ${result.debugInfo.fullAttempt.error}\n`;
      }
      if (result.debugInfo.fullAttempt.detectedLabels) {
        debugContent += `**Detected:** S: ${result.debugInfo.fullAttempt.detectedLabels.summoner}, C: ${result.debugInfo.fullAttempt.detectedLabels.champion}, R: ${result.debugInfo.fullAttempt.detectedLabels.relic}\n`;
      }
      if (result.debugInfo.fullAttempt.text) {
        debugContent +=
          "**OCR Text:**\n```\n" +
          result.debugInfo.fullAttempt.text.substring(0, 1000) +
          "\n```\n";
      }
    }

    return {
      content: debugContent,
      files: attachments,
    };
  }

  const { success, summonerPrestige, championPrestige, relicPrestige } = result;

  const isValid =
    success && summonerPrestige! === championPrestige! + relicPrestige!;

  if (isValid) {
    const oldPrestige = player.summonerPrestige;

    await prisma.player.update({
      where: { id: player.id },
      data: {
        summonerPrestige,
        championPrestige,
        relicPrestige,
      },
    });

    const prestigeChange =
      oldPrestige && oldPrestige > 0 ? summonerPrestige! - oldPrestige : 0;
    const changeString =
      prestigeChange > 0
        ? `(+${prestigeChange})`
        : prestigeChange < 0
        ? `(${prestigeChange})`
        : "";

    const prestigeInfo =
      `**Prestige Values for ${player.ingameName}**:\n` +
      `🏆 TOP 30 Prestige: **${summonerPrestige}** ${changeString}\n` +
      `⚔️ Champion Prestige: **${championPrestige}**\n` +
      `🔮 Relic Prestige: **${relicPrestige}**\n` +
      `\n*Prestige has been updated for ${player.ingameName}.*`;

    const container = new ContainerBuilder();
    container.setAccentColor(0xffd700); // Gold color for prestige
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(prestigeInfo)
    );

    return { components: [container], isComponentsV2: true };
  } else {
    return {
      content:
        "❌ **Could not validate prestige from the image.**\n\n" +
        "For best results, please try one of the following:\n" +
        "1. Use a clear, unedited screenshot from your profile.\n" +
        "2. Crop the screenshot to *only* the area with the three prestige numbers.",
    };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("prestige")
    .setDescription(
      "Extract prestige values from an MCOC screenshot or view the leaderboard."
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Extract prestige values from an MCOC screenshot.")
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription(
              "Screenshot of your MCOC profile showing prestige values."
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("player")
            .setDescription("The player to update prestige for.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Shows the server prestige leaderboard.")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "update") {
      await handleUpdate(interaction);
    } else if (subcommand === "leaderboard") {
      await handleLeaderboard(interaction);
    }
  },
  autocomplete,
};
