import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ChannelType, Collection, ThreadChannel } from 'discord.js';
import { Command } from '../types/command';
import { config } from '../config';
import { sheetsService } from '../services/sheetsService';
import { getChampionByName } from '../services/championService';
import { getApplicationEmojiMarkupByName } from '../services/applicationEmojiService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const awCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('aw')
    .setDescription('Commands for Alliance War planning and details.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('plan')
        .setDescription('Sends AW plan details from sheet to player threads.')
        .addIntegerOption(option =>
          option
            .setName('battlegroup')
            .setDescription('The battlegroup to send the plan for.')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
        )
        .addUserOption(option =>
          option
            .setName('player')
            .setDescription('A specific player to send the plan to.')
            .setRequired(false)
        )
        .addAttachmentOption(option =>
          option
            .setName('image')
            .setDescription('An image to send along with the plan.')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('details')
        .setDescription('Get detailed information about your AW assignments.')
        .addStringOption(option =>
          option
            .setName('node')
            .setDescription('A specific node to get details for.')
            .setRequired(false)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'plan':
        await handlePlan(interaction);
        break;
      case 'details':
        await handleDetails(interaction);
        break;
    }
  },
};

async function handlePlan(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const battlegroup = interaction.options.getInteger('battlegroup', true);
  const targetUser = interaction.options.getUser('player');
  const image = interaction.options.getAttachment('image');

  const sheetTabName = `AW BG${battlegroup}`;
  const channelId = Object.keys(config.allianceWar.battlegroupChannelMappings).find(
    key => config.allianceWar.battlegroupChannelMappings[key] === sheetTabName
  );

  if (!channelId) {
    await interaction.editReply(`Could not find a configured channel for ${sheetTabName}.`);
    return;
  }

  const channel = await interaction.client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply(`The configured channel for ${sheetTabName} is not a valid text channel.`);
    return;
  }

  try {
    const activeThreads = await channel.threads.fetch();
    const archivedThreads = await channel.threads.fetchArchived();
    const allThreads = new Collection<string, ThreadChannel>().concat(activeThreads.threads, archivedThreads.threads);
    const threadMap = new Map(allThreads.map(t => [t.name.toLowerCase(), t]));

    const assignmentsRange = `'${sheetTabName}'!${config.allianceWar.dataRange}`;
    const prefightsRange = `'${sheetTabName}'!${config.allianceWar.prefight.range}`;
    const [assignmentsData, prefightsData] = await Promise.all([
        sheetsService.readSheet(config.MCOC_SHEET_ID, assignmentsRange),
        sheetsService.readSheet(config.MCOC_SHEET_ID, prefightsRange),
    ]);

    const playerDataMap = new Map<string, { assignments: { node: string; description: string }[], prefights: string[] }>();

    if (assignmentsData) {
        for (const row of assignmentsData) {
            const playerName = (row[config.allianceWar.playerColumnIndex] || '').trim().toLowerCase();
            if (!playerName) continue;

            if (!playerDataMap.has(playerName)) {
                playerDataMap.set(playerName, { assignments: [], prefights: [] });
            }

            let description = (row[config.allianceWar.descriptionColumnIndex] || '').trim();
            if (description) {
                const attackerName = (row[config.allianceWar.attackerColumnIndex] || '').trim();
                const defenderName = (row[config.allianceWar.defenderColumnIndex] || '').trim();

                if (attackerName) {
                    const attacker = getChampionByName(attackerName);
                    if (attacker && attacker.discordEmoji) {
                        const emoji = getApplicationEmojiMarkupByName(attacker.discordEmoji);
                        if (emoji) {
                            description = description.replace(new RegExp(`\b${attackerName}\b`, 'gi'), `${emoji} ${attackerName}`);
                        }
                    }
                }
                if (defenderName) {
                    const defender = getChampionByName(defenderName);
                    if (defender && defender.discordEmoji) {
                        const emoji = getApplicationEmojiMarkupByName(defender.discordEmoji);
                        if (emoji) {
                            description = description.replace(new RegExp(`\b${defenderName}\b`, 'gi'), `${emoji} ${defenderName}`);
                        }
                    }
                }
                playerDataMap.get(playerName)!.assignments.push({
                    node: (row[config.allianceWar.nodeColumnIndex] || '').trim(),
                    description: description,
                });
            }
        }
    }

    if (prefightsData) {
        for (const row of prefightsData) {
            const playerName = (row[config.allianceWar.prefight.playerColumnIndex] || '').trim().toLowerCase();
            if (!playerName || !playerDataMap.has(playerName)) continue;

            const description = (row[config.allianceWar.prefight.descriptionColumnIndex] || '').trim();
            if (description) {
                playerDataMap.get(playerName)!.prefights.push(description);
            }
        }
    }

    const sentTo: string[] = [];
    const notFound: string[] = [];
    const noData: string[] = [];

    const sendPlan = async (playerName: string) => {
        const thread = threadMap.get(playerName);
        const data = playerDataMap.get(playerName);

        if (!data || (data.assignments.length === 0 && data.prefights.length === 0)) {
            noData.push(playerName);
            return;
        }

        if (!thread) {
            notFound.push(playerName);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`AW Plan for ${playerName}`)
            .setColor('#0099ff');
        
        if (data.assignments.length > 0) {
            embed.addFields({ name: 'Assignments', value: data.assignments.map(a => `**Node ${a.node}**: ${a.description}`).join('\n') });
        }
        if (data.prefights.length > 0) {
            embed.addFields({ name: 'Pre-Fights', value: data.prefights.map(p => `- ${p}`).join('\n') });
        }
        if (image) {
            embed.setImage(image.url);
        }

        try {
            await thread.send({ embeds: [embed] });
            sentTo.push(playerName);
        } catch (e) {
            notFound.push(`${playerName} (send error)`);
        }
    };

    if (targetUser) {
        const player = await prisma.player.findUnique({ where: { id: targetUser.id } });
        if (!player || !player.ingameName) {
            await interaction.editReply(`Player ${targetUser.username} is not registered or has no in-game name set.`);
            return;
        }
        const playerName = player.ingameName.toLowerCase();
        await sendPlan(playerName);
    } else {
        for (const playerName of playerDataMap.keys()) {
            await sendPlan(playerName);
        }
    }

    const summary = `**AW Plan for ${sheetTabName}**\n` +
        `✅ Sent to: ${sentTo.length > 0 ? sentTo.join(', ') : 'None'}\n` +
        `⚠️ No thread found for: ${notFound.length > 0 ? notFound.join(', ') : 'None'}\n` +
        `ℹ️ No data for: ${noData.length > 0 ? noData.join(', ') : 'None'}`;

    await interaction.editReply(summary);

  } catch (error) {
      console.error('Error in /aw plan:', error);
      await interaction.editReply('An error occurred while executing the AW plan command.');
  }
}

async function handleDetails(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.channel || !interaction.channel.isThread()) {
    await interaction.editReply('This command can only be used in a player\'s war thread.');
    return;
  }

  const playerName = interaction.channel.name.toLowerCase();
  const parentChannelId = interaction.channel.parentId;

  if (!parentChannelId) {
    await interaction.editReply('This thread is not in a valid channel.');
    return;
  }

  const sheetTabName = config.allianceWar.battlegroupChannelMappings[parentChannelId];
  if (!sheetTabName) {
    await interaction.editReply('This thread is not in a recognized battlegroup channel.');
    return;
  }

  try {
    const assignmentsRange = `'${sheetTabName}'!${config.allianceWar.dataRange}`;
    const prefightsRange = `'${sheetTabName}'!${config.allianceWar.prefight.range}`;
    const nodesRange = `'${sheetTabName}'!${config.allianceWar.nodesRange}`;

    const [assignmentsData, prefightsData, nodesData] = await Promise.all([
      sheetsService.readSheet(config.MCOC_SHEET_ID, assignmentsRange),
      sheetsService.readSheet(config.MCOC_SHEET_ID, prefightsRange),
      sheetsService.readSheet(config.MCOC_SHEET_ID, nodesRange),
    ]);

    const playerAssignments: { node: string; description: string }[] = [];
    if (assignmentsData) {
      for (const row of assignmentsData) {
        const sheetPlayerName = (row[config.allianceWar.playerColumnIndex] || '').trim().toLowerCase();
        if (sheetPlayerName === playerName) {
          let description = (row[config.allianceWar.descriptionColumnIndex] || '').trim();
          if (description) {
            const attackerName = (row[config.allianceWar.attackerColumnIndex] || '').trim();
            const defenderName = (row[config.allianceWar.defenderColumnIndex] || '').trim();

            if (attackerName) {
                const attacker = getChampionByName(attackerName);
                if (attacker && attacker.discordEmoji) {
                    const emoji = getApplicationEmojiMarkupByName(attacker.discordEmoji);
                    if (emoji) {
                        description = description.replace(new RegExp(`\b${attackerName}\b`, 'gi'), `${emoji} ${attackerName}`);
                    }
                }
            }
            if (defenderName) {
                const defender = getChampionByName(defenderName);
                if (defender && defender.discordEmoji) {
                    const emoji = getApplicationEmojiMarkupByName(defender.discordEmoji);
                    if (emoji) {
                        description = description.replace(new RegExp(`\b${defenderName}\b`, 'gi'), `${emoji} ${defenderName}`);
                    }
                }
            }

            playerAssignments.push({
              node: (row[config.allianceWar.nodeColumnIndex] || '').trim(),
              description: description,
            });
          }
        }
      }
    }

    const playerPrefights: string[] = [];
    if (prefightsData) {
      for (const row of prefightsData) {
        const sheetPlayerName = (row[config.allianceWar.prefight.playerColumnIndex] || '').trim().toLowerCase();
        if (sheetPlayerName === playerName) {
          const description = (row[config.allianceWar.prefight.descriptionColumnIndex] || '').trim();
          if (description) {
            playerPrefights.push(description);
          }
        }
      }
    }

    const nodeLookup: Record<string, string> = {};
    if (nodesData) {
        for (const row of nodesData) {
            const nodeNumber = (row[0] || '').trim();
            if (!nodeNumber) continue;
            const nodeNames = (row[1] || '').split('\n');
            const nodeDescriptions = (row[2] || '').split('\n');
            let detailsContent = '\n**Node Details:**\n';
            let detailsAdded = false;
            for (let i = 0; i < nodeNames.length; i++) {
                const name = (nodeNames[i] || '').trim();
                const desc = (nodeDescriptions[i] || '').trim();
                if (name && desc) {
                    detailsContent += `- **${name}**: ${desc}\n`;
                    detailsAdded = true;
                }
            }
            if (detailsAdded) {
                nodeLookup[nodeNumber] = detailsContent;
            }
        }
    }

    let filteredAssignments = playerAssignments;
    const targetNode = interaction.options.getString('node');
    if (targetNode) {
        const assignedNodes = new Set(playerAssignments.map(a => a.node));
        if (!assignedNodes.has(targetNode)) {
            await interaction.editReply(`Node '${targetNode}' is not assigned to you.`);
            return;
        }
        filteredAssignments = playerAssignments.filter(a => a.node === targetNode);
    }

    if (filteredAssignments.length === 0 && playerPrefights.length === 0) {
        await interaction.editReply(targetNode ? `No assignment for node '${targetNode}'.` : `No assignments or pre-fights found for you in ${sheetTabName}.`);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`AW Details for ${interaction.channel.name}`)
        .setColor('#0099ff');

    if (filteredAssignments.length > 0) {
        let assignmentText = '';
        for (const assignment of filteredAssignments) {
            assignmentText += `\n**Node ${assignment.node}**\n- ${assignment.description}\n`;
            const nodeDetails = nodeLookup[assignment.node];
            if (nodeDetails) {
                assignmentText += nodeDetails;
            }
        }
        embed.addFields({ name: 'Main Assignments', value: assignmentText });
    }

    if (playerPrefights.length > 0) {
        embed.addFields({ name: 'Pre-Fights', value: playerPrefights.map(p => `- ${p}`).join('\n') });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (error) {
    console.error('Error in /aw details:', error);
    await interaction.editReply('An error occurred while fetching your AW details.');
  }
}

export default awCommand;