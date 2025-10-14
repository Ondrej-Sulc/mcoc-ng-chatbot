import { PrismaClient } from "@prisma/client";
import {
  processRosterScreenshot,
  RosterDebugResult,
  RosterUpdateResult,
} from "../services/rosterService";
import * as fs from "fs/promises";
import * as path from "path";

const prisma = new PrismaClient();

// URL from the user
const imageUrl =
  "https://media.discordapp.net/attachments/1282672011654725742/1419446680524423308/Screenshot_20250922-001313.png?ex=68e0f37c&is=68dfa1fc&hm=9e93911ce5c11ceadd6e9efe9eedace93e1f663d4fe442845086ccea8571b44c&=&format=webp&quality=lossless&width=1329&height=613";
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
        result.champions.flat().map((c) => c.champion.name)
      );
    }

    if ("debugImageBuffer" in result && result.debugImageBuffer) {
      const debugDir = path.join(__dirname, "..", "..", "debug");
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
