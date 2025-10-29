import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileList(interaction: ChatInputCommandInteraction): Promise<void> {
  const discordId = interaction.user.id;

  const profiles = await prisma.player.findMany({
    where: { discordId },
    orderBy: {
      ingameName: 'asc',
    },
  });

  if (profiles.length === 0) {
    await safeReply(interaction, "You don't have any profiles yet. Use `/profile add` to create one.");
    return;
  }

  const profileList = profiles
    .map(p => {
      const indicator = p.isActive ? ' (Active)' : '';
      return `- **${p.ingameName}**${indicator}`;
    })
    .join('\n');

  await safeReply(interaction, `Your profiles:\n${profileList}`);
}