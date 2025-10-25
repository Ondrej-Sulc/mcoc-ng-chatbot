
import { PrismaClient } from '@prisma/client';
import Fuse from 'fuse.js';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting synergy migration...');

  const allChampions = await prisma.champion.findMany();
  const fuse = new Fuse(allChampions, {
    keys: ['name', 'shortName'],
    threshold: 0.4, // Adjust this threshold as needed
  });

  const linksWithSynergy = await prisma.championAbilityLink.findMany({
    where: {
      source: {
        contains: 'Synergy',
        mode: 'insensitive',
      },
    },
  });

  console.log(`Found ${linksWithSynergy.length} ability links with synergies.`);

  for (const link of linksWithSynergy) {
    if (!link.source) continue;

    const synergyRegex = /Synergy \[(.*?)\]/i;
    const match = link.source.match(synergyRegex);

    if (match && match[1]) {
      const synergyChampionsStr = match[1];
      const championNames = synergyChampionsStr.split(/, | & /);

      const foundChampionIds = new Set<number>();

      for (const name of championNames) {
        const trimmedName = name.trim();
        if (trimmedName) {
          const result = fuse.search(trimmedName);
          if (result.length > 0) {
            const championId = result[0].item.id;
            if (!foundChampionIds.has(championId)) {
              console.log(`  - Matched "${trimmedName}" to "${result[0].item.name}"`);
              try {
                await prisma.championAbilitySynergy.create({
                  data: {
                    championAbilityLinkId: link.id,
                    championId: championId,
                  },
                });
              } catch (e: any) {
                if (e.code !== 'P2002') {
                  throw e;
                }
              }
              foundChampionIds.add(championId);
            }
          } else {
            console.log(`  - No match found for "${trimmedName}" in link ${link.id}`);
          }
        }
      }

      // Clean up the source string
      let newSource = link.source.replace(synergyRegex, '').trim();
      if (newSource.startsWith('&')) {
        newSource = newSource.substring(1).trim();
      }
      if (newSource.length === 0) {
        newSource = "Synergy";
      }

      try {
        await prisma.championAbilityLink.update({
          where: { id: link.id },
          data: { source: newSource },
        });
        console.log(`  - Updated link ${link.id} with new source: \"${newSource}\".`);
      } catch (e: any) {
        if (e.code === 'P2002') {
          console.log(`  - Deleting duplicate link ${link.id} after extracting synergy.`);
          await prisma.championAbilityLink.delete({ where: { id: link.id } });
        } else {
          throw e;
        }
      }
    }
  }

  console.log('Synergy migration finished.');
}

main()
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
