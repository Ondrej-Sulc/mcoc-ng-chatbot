import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot, RosterDebugResult, RosterUpdateResult } from '../services/rosterService';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1194385255814148107/1420290906342293504/Screenshot_2025-09-24-08-07-10-549_com.kabam.marvelbattle.jpg?ex=68d4dc7b&is=68d38afb&hm=fafe4f218d882be2af2f019df09f085f34950c0968a55d126df80a10b4916eb8&=&format=webp&width=1408&height=634';
const stars = 6;
const rank = 5;

// Test player data
const testPlayerData = {
  discordId: 'test-discord-id',
  ingameName: 'TestPlayer',
  guildId: 'test-guild-id',
};

async function testRoster() {
  const debugMode = true; // Set to true to test without saving to DB
  console.log(`Starting roster processing test... (Debug mode: ${debugMode})`);
  try {
    let result: RosterUpdateResult | RosterDebugResult;
    if (debugMode) {
      result = await processRosterScreenshot(imageUrl, stars, rank, true);
    } else {
      // Ensure the test player exists
      const player = await prisma.player.upsert({
        where: { discordId: testPlayerData.discordId },
        update: {},
        create: testPlayerData,
      });
      console.log(`Test player '${player.ingameName}' ensured with ID: ${player.id}`);
      result = await processRosterScreenshot(imageUrl, stars, rank, false, player.id);
    }
    console.log('Processing finished.');

    console.log('Result:', result.message);

    if ('debugImageBuffer' in result && result.debugImageBuffer) {
      const debugDir = path.join(__dirname, '..', '..', 'debug');
      await fs.mkdir(debugDir, { recursive: true });

      if (result.imageBuffer) {
        const basePath = path.join(debugDir, 'roster_base.png');
        await fs.writeFile(basePath, result.imageBuffer);
        console.log(`Saved base image to: ${basePath}`);
      }
      if (result.debugImageBuffer) {
        const debugPath = path.join(debugDir, 'roster_debug.png');
        await fs.writeFile(debugPath, result.debugImageBuffer);
        console.log(`Saved debug image to: ${debugPath}`);
      }
    }

  } catch (error) {
    console.error('An error occurred during roster processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();
