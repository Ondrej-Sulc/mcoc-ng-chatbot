import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { safeReply } from '../../utils/errorHandler';

export async function handleAllianceName(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { prisma } = await import('../../services/prismaService.js');
  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await safeReply(interaction, "You must be an administrator to use this command.");
    return;
  }

  const newName = interaction.options.getString('name', true);

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
  });

  if (!alliance) {
    await safeReply(interaction, "This alliance is not registered. An admin needs to set up the alliance first.");
    return;
  }

  await prisma.alliance.update({
    where: { id: alliance.id },
    data: { name: newName },
  });

  await safeReply(
    interaction,
    `✅ This alliance's name has been updated to **${newName}**.`
  );
}
