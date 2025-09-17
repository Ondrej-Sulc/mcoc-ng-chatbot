import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot, RosterDebugResult } from '../services/rosterService';
import * as fs from 'fs/promises';
import * as path from 'path';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1194385255814148107/1417892601897685052/Screenshot_20250917_171819_Champions.jpg?ex=68cc22e3&is=68cad163&hm=34d4a37112ada9a2a2330396e8e345ce098dcb99c0969c3635f4befbc3bcaca7&=&format=webp&width=1329&height=613';
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
    } else {
      console.log('Result:', result.message);
      const debugDir = path.join(__dirname, '..', '..', 'debug');
      await fs.mkdir(debugDir, { recursive: true });

      if (result.croppedImageBuffer) {
        const croppedPath = path.join(debugDir, 'roster_cropped.png');
        await fs.writeFile(croppedPath, result.croppedImageBuffer);
        console.log(`Saved cropped debug image to: ${croppedPath}`);
      }
      if (result.gridImageBuffer) {
        const gridPath = path.join(debugDir, 'roster_grid.png');
        await fs.writeFile(gridPath, result.gridImageBuffer);
        console.log(`Saved grid debug image to: ${gridPath}`);
      }
    }
  } catch (error) {
    console.error('An error occurred during roster processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();
