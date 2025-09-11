import { PrismaClient } from '@prisma/client';
import { processRosterScreenshot } from '../services/rosterService';

const prisma = new PrismaClient();

// URL from the user
const imageUrl = 'https://media.discordapp.net/attachments/1282672011654725742/1415661876280426546/Screenshot_20250903-202922.png?ex=68c4055d&is=68c2b3dd&hm=39a8b318ce6cbc16bb0991113f54d810e16d753c53b88f0b19746c9f317ef333&=&format=webp&quality=lossless&width=1646&height=738';
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
    let result: string;
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
    console.log('Result:', result);
  } catch (error) {
    console.error('An error occurred during roster processing:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();