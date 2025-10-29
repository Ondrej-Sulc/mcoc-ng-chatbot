import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleProfileRename(interaction: ChatInputCommandInteraction): Promise<void> {
  const currentName = interaction.options.getString('current_name', true);
  const newName = interaction.options.getString('new_name', true);
  const discordId = interaction.user.id;

  if (currentName.toLowerCase() === newName.toLowerCase()) {
    await safeReply(interaction, "The new name cannot be the same as the current name.");
    return;
  }

  // Check if the target profile exists
  const profileToRename = await prisma.player.findUnique({
    where: {
      discordId_ingameName: {
        discordId,
        ingameName: currentName,
      },
    },
  });

  if (!profileToRename) {
    await safeReply(interaction, `You don't have a profile named **${currentName}**.`);
    return;
  }

  // Check if a profile with the new name already exists
  const existingProfile = await prisma.player.findUnique({
    where: {
      discordId_ingameName: {
        discordId,
        ingameName: newName,
      },
    },
  });

  if (existingProfile) {
    await safeReply(interaction, `You already have a profile named **${newName}**.`);
    return;
  }

  await prisma.player.update({
    where: {
      id: profileToRename.id,
    },
    data: {
      ingameName: newName,
    },
  });

  await safeReply(interaction, `✅ Renamed profile **${currentName}** to **${newName}**.`);
}
