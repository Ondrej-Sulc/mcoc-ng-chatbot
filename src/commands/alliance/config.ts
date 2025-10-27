
import { ChatInputCommandInteraction, PermissionsBitField } from 'discord.js';
import { prisma } from '../../services/prismaService';
import { safeReply } from '../../utils/errorHandler';

export async function handleAllianceConfig(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (!interaction.guild) {
    await safeReply(interaction, "This command can only be used in a server.");
    return;
  }

  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await safeReply(interaction, "You must be an administrator to use this command.");
    return;
  }

  const commandName = interaction.options.getString('command', true);
  const enabled = interaction.options.getBoolean('enabled', true);

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
  });

  if (!alliance) {
    await safeReply(interaction, "This alliance is not registered. Please register your profile first.");
    return;
  }

  const currentlyDisabled = alliance.disabledCommands;
  let updatedDisabled: string[];

  if (enabled) {
    // Remove the command from the disabled list
    updatedDisabled = currentlyDisabled.filter((cmd) => cmd !== commandName);
  } else {
    // Add the command to the disabled list if it's not already there
    if (!currentlyDisabled.includes(commandName)) {
      updatedDisabled = [...currentlyDisabled, commandName];
    } else {
      updatedDisabled = currentlyDisabled;
    }
  }

  await prisma.alliance.update({
    where: { id: alliance.id },
    data: { disabledCommands: updatedDisabled },
  });

  await safeReply(
    interaction,
    `✅ Command **${commandName}** has been **${enabled ? 'enabled' : 'disabled'}** for this alliance.`
  );
}
