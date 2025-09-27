import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot, RosterDebugResult, RosterUpdateResult } from '../services/rosterService';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1194385255814148107/1420291270886166559/Screenshot_2025-09-24-08-07-53-974_com.kabam.marvelbattle.jpg?ex=68d82892&is=68d6d712&hm=7fd8f67a6e2c2b2ae1dec2cf0217f54a830886f5bc2ec75a9cca3d7e97d5ef80&=&format=webp&width=1408&height=634';
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
