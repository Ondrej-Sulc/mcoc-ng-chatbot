import { ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';

export async function handleProfileRename(interaction: ChatInputCommandInteraction | ButtonInteraction | ModalSubmitInteraction, currentNameArg?: string, newNameArg?: string): Promise<string> {
  const discordId = interaction.user.id;

  // Get currentName and newName, prioritizing arguments
  const currentName = currentNameArg || (interaction as ChatInputCommandInteraction).options.getString('current_name', true);
  const newName = newNameArg || (interaction as ChatInputCommandInteraction).options.getString('new_name', true);

  if (currentName.toLowerCase() === newName.toLowerCase()) {
    return "The new name cannot be the same as the current name.";
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
    return `You don't have a profile named **${currentName}**.`;
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
    return `You already have a profile named **${newName}**.`;
  }

  await prisma.player.update({
    where: {
      id: profileToRename.id,
    },
    data: {
      ingameName: newName,
    },
  });

  return `✅ Renamed profile **${currentName}** to **${newName}**.`;
}
