import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileSwitch(interaction: ChatInputCommandInteraction): Promise<void> {
  const ingameName = interaction.options.getString('name', true);
  const discordId = interaction.user.id;

  const profiles = await prisma.player.findMany({
    where: { discordId },
  });

  if (profiles.length <= 1) {
    await safeReply(interaction, "You only have one profile, so there's nothing to switch.");
    return;
  }

  const targetProfile = profiles.find(p => p.ingameName === ingameName);

  if (!targetProfile) {
    await safeReply(interaction, `You don't have a profile named **${ingameName}**.`);
    return;
  }

  if (targetProfile.isActive) {
    await safeReply(interaction, `**${ingameName}** is already your active profile.`);
    return;
  }

  // Using a transaction to ensure atomicity
  await prisma.$transaction([
    // Set all profiles to inactive
    prisma.player.updateMany({
      where: {
        discordId,
      },
      data: {
        isActive: false,
      },
    }),
    // Set the target profile to active
    prisma.player.update({
      where: {
        id: targetProfile.id,
      },
      data: {
        isActive: true,
      },
    }),
  ]);

  await safeReply(interaction, `✅ Switched active profile to **${ingameName}**.`);
}
