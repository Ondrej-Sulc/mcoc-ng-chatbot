import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot, RosterDebugResult, RosterUpdateResult } from '../services/rosterService';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1184586435622346803/1423568405533032520/Screenshot_20251001_162849_Champions.webp?ex=68e0c8e4&is=68df7764&hm=b23feaa9f7dfc6bb2b0e733a7bad457d468c1832f18088ed7e31a60d0d51567f&=&format=webp&width=1433&height=662';
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
      result = await processRosterScreenshot(imageUrl, stars, rank, false, true);
    } else {
      // Ensure the test player exists
      const player = await prisma.player.upsert({
        where: { discordId: testPlayerData.discordId },
        update: {},
        create: testPlayerData,
      });
      console.log(`Test player '${player.ingameName}' ensured with ID: ${player.id}`);
      result = await processRosterScreenshot(imageUrl, stars, rank, false, false, player.id);
    }
    console.log('Processing finished.');

    if ('message' in result) {
      console.log('Result:', result.message);
    } else {
      console.log('Result:', `${result.count} champions processed.`);
      console.log('Champions:', result.champions.flat().map(c => c.champion.name));
    }

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
