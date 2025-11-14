import { ChatInputCommandInteraction } from 'discord.js';
import { prisma } from '../../services/prismaService';
import loggerService from '../../services/loggerService';

export async function handleAllianceSyncRoles(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) {
    await interaction.editReply('This command can only be used in a server.');
    return;
  }

  try {
    const alliance = await prisma.alliance.findUnique({
      where: { guildId: interaction.guild.id },
    });

    if (!alliance || (!alliance.officerRole && !alliance.battlegroup1Role && !alliance.battlegroup2Role && !alliance.battlegroup3Role)) {
      await interaction.editReply('Alliance roles are not configured. Please use `/alliance config-roles` first.');
      return;
    }

    await interaction.editReply('Starting role synchronization... This may take a moment.');

    const members = await interaction.guild.members.fetch();
    let updatedPlayers = 0;

    for (const member of members.values()) {
      const player = await prisma.player.findFirst({
        where: { discordId: member.id, allianceId: alliance.id },
      });

      if (player) {
        let battlegroup: number | null = null;
        if (alliance.battlegroup1Role && member.roles.cache.has(alliance.battlegroup1Role)) {
          battlegroup = 1;
        } else if (alliance.battlegroup2Role && member.roles.cache.has(alliance.battlegroup2Role)) {
          battlegroup = 2;
        } else if (alliance.battlegroup3Role && member.roles.cache.has(alliance.battlegroup3Role)) {
          battlegroup = 3;
        }

        const isOfficer = !!(alliance.officerRole && member.roles.cache.has(alliance.officerRole));

        if (player.battlegroup !== battlegroup || player.isOfficer !== isOfficer) {
          await prisma.player.update({
            where: { id: player.id },
            data: { battlegroup, isOfficer },
          });
          updatedPlayers++;
        }
      }
    }

    await interaction.followUp(`Role synchronization complete. ${updatedPlayers} player(s) updated.`);
    loggerService.info(`Alliance roles synced for guild ${interaction.guild.id} by ${interaction.user.tag}. ${updatedPlayers} players updated.`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    loggerService.error({ error: errorMessage }, 'Error syncing alliance roles');
    await interaction.editReply('An error occurred while syncing alliance roles.');
  }
}
