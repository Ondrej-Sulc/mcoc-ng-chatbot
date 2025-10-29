import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileRemove(interaction: ChatInputCommandInteraction): Promise<void> {
  const ingameName = interaction.options.getString('name', true);
  const discordId = interaction.user.id;

  const profileToRemove = await prisma.player.findUnique({
    where: {
      discordId_ingameName: {
        discordId,
        ingameName,
      },
    },
  });

  if (!profileToRemove) {
    await safeReply(interaction, `You don't have a profile named **${ingameName}**.`);
    return;
  }

  const wasActive = profileToRemove.isActive;

  await prisma.player.delete({
    where: {
      id: profileToRemove.id,
    },
  });

  let replyMessage = `✅ Successfully removed profile **${ingameName}**.`;

  if (wasActive) {
    const remainingProfiles = await prisma.player.findMany({
      where: { discordId },
    });

    if (remainingProfiles.length > 0) {
      const newActiveProfile = remainingProfiles[0];
      await prisma.player.update({
        where: {
          id: newActiveProfile.id,
        },
        data: {
          isActive: true,
        },
      });
      replyMessage += `\n**${newActiveProfile.ingameName}** has been set as your new active profile.`;
    }
  }

  await safeReply(interaction, replyMessage);
}