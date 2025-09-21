import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot, RosterDebugResult } from '../services/rosterService';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1282672011654725742/1419446678838317308/Screenshot_20250922-001245.png?ex=68d1ca3c&is=68d078bc&hm=abe0a27f6dacc4d887d8052d0bc0ad13255ba688062ea8b4b46c5c790c70f678&=&format=webp&quality=lossless&width=953&height=440';
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
    let result: string | RosterDebugResult;
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

    if (typeof result === 'string') {
      console.log('Result:', result);
    }
    else {
      console.log('Result:', result.message);
      const debugDir = path.join(__dirname, '..', '..', 'debug');
      await fs.mkdir(debugDir, { recursive: true });

      if (result.imageBuffer) {
        const bassePath = path.join(debugDir, 'roster_basee.png');
        await fs.writeFile(bassePath, result.imageBuffer);
        console.log(`Saved debug image to: ${bassePath}`);
      }
      if (result.gridImageBuffer) {
        const gridPath = path.join(debugDir, 'roster_grid.png');
        await fs.writeFile(gridPath, result.gridImageBuffer);
        console.log(`Saved grid debug image to: ${gridPath}`);
      }
      if (result.ocrBoundsImageBuffer) {
        const ocrBoundsPath = path.join(debugDir, 'roster_ocr_bounds.png');
        await fs.writeFile(ocrBoundsPath, result.ocrBoundsImageBuffer);
        console.log(`Saved OCR bounds debug image to: ${ocrBoundsPath}`);
      }
      if (result.awakenedCheckImageBuffer) {
        const awakenedCheckPath = path.join(debugDir, 'roster_awakened_check.png');
        await fs.writeFile(awakenedCheckPath, result.awakenedCheckImageBuffer);
        console.log(`Saved awakened check debug image to: ${awakenedCheckPath}`);
      }
      if (result.shortNameSolveImageBuffer) {
        const shortNameSolvePath = path.join(debugDir, 'roster_short_name_solve.png');
        await fs.writeFile(shortNameSolvePath, result.shortNameSolveImageBuffer);
        console.log(`Saved short name solve debug image to: ${shortNameSolvePath}`);
      }
    }
  } catch (error) {
    console.error('An error occurred during roster processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();
