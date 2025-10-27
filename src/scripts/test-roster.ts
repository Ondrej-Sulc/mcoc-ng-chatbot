import { PrismaClient } from "@prisma/client";
import { prisma } from "../services/prismaService";
import { processRosterScreenshot } from "../commands/roster/ocr/process";
import { RosterUpdateResult, RosterDebugResult } from "../commands/roster/ocr/types";
import * as fs from "fs/promises";
import * as path from "path";

// URL from the user
const imageUrl =
  "https://media.discordapp.net/attachments/1282672011654725742/1432304131229356053/image.png?ex=690090ab&is=68ff3f2b&hm=7627b9745f9ea9a55c19035d93263aac0bd2a7d2c349bc91ecedabe0bc2e59dc&=&format=webp&quality=lossless&width=2054&height=593";
const stars = 6;
const rank = 5;

// Test player data
const testPlayerData = {
  discordId: "test-discord-id",
  ingameName: "TestPlayer",
  guildId: "test-guild-id",
};

async function testRoster() {
  const debugMode = true; // Set to true to test without saving to DB
  console.log(`Starting roster processing test... (Debug mode: ${debugMode})`);
  try {
    let result: RosterUpdateResult | RosterDebugResult;
    if (debugMode) {
      result = await processRosterScreenshot(
        imageUrl,
        stars,
        rank,
        false,
        true
      );
    } else {
      // Ensure the test player exists
      const player = await prisma.player.upsert({
        where: { discordId: testPlayerData.discordId },
        update: {},
        create: testPlayerData,
      });
      console.log(
        `Test player '${player.ingameName}' ensured with ID: ${player.id}`
      );
      result = await processRosterScreenshot(
        imageUrl,
        stars,
        rank,
        false,
        false,
        player.id
      );
    }
    console.log("Processing finished.");

    if ("message" in result) {
      console.log("Result:", result.message);
    } else {
      console.log("Result:", `${result.count} champions processed.`);
      console.log(
        "Champions:",
        result.champions.flat().map((c: any) => c.champion.name)
      );
    }

    if ("debugImageBuffer" in result && result.debugImageBuffer) {
      const debugDir = path.join(__dirname, "..", "..", "temp");
      await fs.mkdir(debugDir, { recursive: true });

      if (result.imageBuffer) {
        const basePath = path.join(debugDir, "roster_base.png");
        await fs.writeFile(basePath, result.imageBuffer);
        console.log(`Saved base image to: ${basePath}`);
      }
      if (result.debugImageBuffer) {
        const debugPath = path.join(debugDir, "roster_debug.png");
        await fs.writeFile(debugPath, result.debugImageBuffer);
        console.log(`Saved debug image to: ${debugPath}`);
      }
    }
  } catch (error) {
    console.error("An error occurred during roster processing:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();
