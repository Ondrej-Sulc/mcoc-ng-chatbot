import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import loggerService from '../../../services/loggerService';

export async function handleAllianceManageAdd(interaction: ChatInputCommandInteraction) {
  const { prisma } = await import('../../../services/prismaService.js');
  const userToAdd = interaction.options.getUser('user', true);
  const ingameName = interaction.options.getString('ingame-name', true);

  if (!interaction.guildId) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const alliance = await prisma.alliance.findUnique({
      where: { guildId: interaction.guildId },
    });

    if (!alliance) {
      await interaction.editReply('This server is not registered as an alliance.');
      return;
    }

    // Upsert the player and connect them to the alliance
    const player = await prisma.player.upsert({
      where: {
        discordId_ingameName: {
          discordId: userToAdd.id,
          ingameName: ingameName,
        },
      },
      update: {
        allianceId: alliance.id,
        isActive: true,
      },
      create: {
        discordId: userToAdd.id,
        ingameName: ingameName,
        allianceId: alliance.id,
        isActive: true,
      },
    });

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Player Added')
      .setDescription(`Successfully added <@${userToAdd.id}> with in-game name **${ingameName}** to the alliance.`)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    loggerService.info({
      guildId: interaction.guildId,
      admin: interaction.user.tag,
      addedUser: userToAdd.tag,
      ingameName: ingameName,
    }, `Player ${userToAdd.tag} added to alliance`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage, guildId: interaction.guildId }, 'Error adding player to alliance');
    await interaction.editReply('An error occurred while adding the player.');
  }
}