import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ChannelType,
  Collection,
  ThreadChannel,
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { Command } from "../types/command";
import { config } from "../config";
import { sheetsService } from "../services/sheetsService";
import { getChampionByName } from "../services/championService";
import { getApplicationEmojiMarkupByName } from "../services/applicationEmojiService";
import { PrismaClient } from "@prisma/client";
import { prisma } from "../services/prismaService";

// --- HELPER FUNCTIONS ---

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const getEmoji = (championName: string): string => {
  if (!championName) return "";
  const champion = getChampionByName(championName);
  if (!champion || !champion.discordEmoji) return "";
  if (
    champion.discordEmoji.startsWith("<") &&
    champion.discordEmoji.endsWith(">")
  ) {
    return champion.discordEmoji;
  }
  return getApplicationEmojiMarkupByName(champion.discordEmoji) || "";
};

const formatAssignment = (assignment: MergedAssignment): string => {
  const { attackerName, defenderName, attackTactic, defenseTactic } =
    assignment;
  const attackerEmoji = getEmoji(attackerName);
  const defenderEmoji = getEmoji(defenderName);

  let assignmentString = `${attackerEmoji} **${attackerName}** vs ${defenderEmoji} **${defenderName}**`;
  if (attackTactic) assignmentString += ` | ${attackTactic}`;
  if (defenseTactic) assignmentString += ` | ${defenseTactic}`;

  return assignmentString;
};

interface MergedAssignment {
  playerName: string;
  node: string;
  attackerName: string;
  defenderName: string;
  prefightPlayer: string;
  prefightChampion: string;
  attackTactic: string;
  defenseTactic: string;
}

async function getMergedData(
  sheetTabName: string
): Promise<MergedAssignment[]> {
  const assignmentsRange = `'${sheetTabName}'!${config.allianceWar.dataRange}`;
  const tacticsAndPrefightsRange = `'${sheetTabName}'!${config.allianceWar.PreFightTacticDataRange}`;

  const [assignmentsData, tacticsAndPrefightsData] =
    await sheetsService.readSheets(config.MCOC_SHEET_ID, [
      assignmentsRange,
      tacticsAndPrefightsRange,
    ]);

  if (!assignmentsData) return [];

  const mergedData: MergedAssignment[] = [];

  for (let i = 0; i < assignmentsData.length; i++) {
    const assignmentRow = assignmentsData[i];
    if (!assignmentRow) {
      continue;
    }
    const tacticsAndPrefightsRow =
      (tacticsAndPrefightsData && tacticsAndPrefightsData[i]) || [];

    const playerName = (assignmentRow[config.allianceWar.playerCol] || "")
      .trim()
      .toLowerCase();
    const attackerName = (
      assignmentRow[config.allianceWar.attackerCol] || ""
    ).trim();
    const defenderName = (
      assignmentRow[config.allianceWar.defenderCol] || ""
    ).trim();

    if (playerName && attackerName && defenderName) {
      mergedData.push({
        playerName,
        attackerName,
        defenderName,
        node: (assignmentRow[config.allianceWar.nodeCol] || "").trim(),
        prefightPlayer: (
          tacticsAndPrefightsRow[config.allianceWar.PreFightPlayerCol] || ""
        )
          .trim()
          .toLowerCase(),
        prefightChampion: (
          tacticsAndPrefightsRow[config.allianceWar.PreFightChampionCol] || ""
        ).trim(),
        attackTactic: (
          tacticsAndPrefightsRow[config.allianceWar.TacticAttackCol] || ""
        ).trim(),
        defenseTactic: (
          tacticsAndPrefightsRow[config.allianceWar.TacticDefenseCol] || ""
        ).trim(),
      });
    }
  }
  return mergedData;
}

async function getTeamData(
  sheetTabName: string
): Promise<Map<string, string[]>> {
  const teamRange = `'${sheetTabName}'!${config.allianceWar.teamRange}`;
  const [teamData] = await sheetsService.readSheets(config.MCOC_SHEET_ID, [
    teamRange,
  ]);

  const teamMap = new Map<string, string[]>();
  if (!teamData) {
    return teamMap;
  }

  for (let i = 0; i < teamData.length; i += 4) {
    const playerName = (teamData[i]?.[0] || "").trim().toLowerCase();
    if (playerName) {
      const champions = [
        (teamData[i + 1]?.[0] || "").trim(),
        (teamData[i + 2]?.[0] || "").trim(),
        (teamData[i + 3]?.[0] || "").trim(),
      ].filter((c) => c);
      teamMap.set(playerName, champions);
    }
  }

  return teamMap;
}

// --- COMMANDS ---

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aw")
    .setDescription("Commands for Alliance War planning and details.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("plan")
        .setDescription("Sends AW plan details from sheet to player threads.")
        .addIntegerOption((option) =>
          option
            .setName("battlegroup")
            .setDescription("The battlegroup to send the plan for.")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(3)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("A specific player to send the plan to.")
            .setRequired(false)
        )
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription("An image to send along with the plan.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("details")
        .setDescription("Get detailed information about your AW assignments.")
        .addStringOption((option) =>
          option
            .setName("node")
            .setDescription("A specific node to get details for.")
            .setRequired(false)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.isChatInputCommand()) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "plan":
        await handlePlan(interaction);
        break;
      case "details":
        await handleDetails(interaction);
        break;
    }
  },
};

async function handlePlan(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const battlegroup = interaction.options.getInteger("battlegroup", true);
  const targetUser = interaction.options.getUser("player");
  const image = interaction.options.getAttachment("image");

  const bgSheetName = `AW BG${battlegroup}`;
  const channelId = Object.keys(
    config.allianceWar.battlegroupChannelMappings
  ).find(
    (key) =>
      config.allianceWar.battlegroupChannelMappings[key].sheet === bgSheetName
  );

  if (!channelId) {
    await interaction.editReply(
      `Could not find a configured channel for ${bgSheetName}.`
    );
    return;
  }

  const bgConfig = config.allianceWar.battlegroupChannelMappings[channelId];

  const channel = await interaction.client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply(
      `The configured channel for ${bgSheetName} is not a valid text channel.`
    );
    return;
  }

  const activeThreads = await channel.threads.fetch();
  const archivedThreads = await channel.threads.fetchArchived();
  const allThreads = new Collection<string, ThreadChannel>().concat(
    activeThreads.threads,
    archivedThreads.threads
  );
  const threadMap = new Map(allThreads.map((t) => [t.name.toLowerCase(), t]));

  const mergedData = await getMergedData(bgConfig.sheet);
  const teamData = await getTeamData(bgConfig.sheet);

  const playerDataMap = new Map<
    string,
    {
      assignments: { node: string; formatted: string }[];
      prefights: {
        champion: string;
        targetPlayer: string;
        targetNode: string;
        targetDefender: string;
      }[];
    }
  >();

  for (const assignment of mergedData) {
    const {
      playerName,
      attackerName,
      prefightPlayer,
      prefightChampion,
      node,
      defenderName,
    } = assignment;

    // Ensure player entries exist
    if (!playerDataMap.has(playerName)) {
      playerDataMap.set(playerName, { assignments: [], prefights: [] });
    }
    if (prefightPlayer && !playerDataMap.has(prefightPlayer)) {
      playerDataMap.set(prefightPlayer, { assignments: [], prefights: [] });
    }

    // Add assignment to the player
    playerDataMap.get(playerName)!.assignments.push({
      node: node,
      formatted: formatAssignment(assignment),
    });
    // Handle prefight logic
    if (prefightPlayer && prefightChampion) {
      // Add prefight task to the performer
      playerDataMap.get(prefightPlayer)!.prefights.push({
        champion: prefightChampion,
        targetPlayer: playerName,
        targetNode: node,
        targetDefender: defenderName,
      });

      // Append note to the target's assignment
      const targetAssignment = playerDataMap
        .get(playerName)!
        .assignments.find((a) => a.node === node);
      if (targetAssignment) {
        targetAssignment.formatted += ` (Prefight: ${getEmoji(
          prefightChampion
        )} ${prefightChampion})`;
      }
    }
  }

  const sentTo: string[] = [];
  const notFound: string[] = [];
  const noData: string[] = [];

  const sendPlan = async (playerName: string) => {
    const thread = threadMap.get(playerName);
    const data = playerDataMap.get(playerName);
    const team = teamData.get(playerName);

    if (
      (!data ||
        (data.assignments.length === 0 && data.prefights.length === 0)) &&
      (!team || team.length === 0)
    ) {
      noData.push(playerName);
      return;
    }

    if (!thread) {
      notFound.push(playerName);
      return;
    }

    const container = new ContainerBuilder().setAccentColor(bgConfig.color);

    if (image) {
      const gallery = new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(image.url)
      );
      container.addMediaGalleryComponents(gallery);
    }

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**AW Plan for ${capitalize(playerName)}**`
      )
    );

    if (team && team.length > 0) {
      const attackersString =
        "**Your Team:**\n" +
        team.map((name) => `${getEmoji(name)} **${name}**`).join(" ");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(attackersString)
      );
    }

    if (data && data.assignments.length > 0) {
      const assignmentsValue =
        "**Assignments**\n" +
        data.assignments
          .map((a) => `- Node ${a.node}: ${a.formatted}`)
          .join("\n");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(assignmentsValue)
      );
    }

    if (data && data.prefights.length > 0) {
      const prefightsValue =
        "**Pre-Fights**\n" +
        data.prefights
          .map(
            (p) =>
              `- ${getEmoji(p.champion)} **${p.champion}** for ${capitalize(
                p.targetPlayer
              )}'s ${getEmoji(p.targetDefender)} **${
                p.targetDefender
              }** on node ${p.targetNode}`
          )
          .join("\n");
      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(prefightsValue)
      );
    }

    try {
      await thread.send({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
      sentTo.push(playerName);
    } catch (e) {
      notFound.push(`${playerName} (send error)`);
    }
  };

  if (targetUser) {
    const player = await prisma.player.findUnique({
      where: { discordId: targetUser.id },
    });
    if (!player || !player.ingameName) {
      await interaction.editReply(
        `Player ${targetUser.username} is not registered or has no in-game name set.`
      );
      return;
    }
    const playerName = player.ingameName.toLowerCase();
    await sendPlan(playerName);
  } else {
    const planPromises = Array.from(playerDataMap.keys()).map((playerName) =>
      sendPlan(playerName)
    );
    await Promise.all(planPromises);
  }

  const summary =
    `**AW Plan for ${bgConfig.sheet}**\n` +
    `✅ Sent to: ${sentTo.map(capitalize).join(", ") || "None"}\n` +
    `⚠️ No thread found for: ${
      notFound.map(capitalize).join(", ") || "None"
    }\n` +
    `ℹ️ No data for: ${noData.map(capitalize).join(", ") || "None"}`;

  await interaction.editReply(summary);
}

async function handleDetails(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  if (!interaction.channel || !interaction.channel.isThread()) {
    await interaction.editReply(
      "This command can only be used in a player's war thread."
    );
    return;
  }

  const playerName = interaction.channel.name.toLowerCase();
  const parentChannelId = interaction.channel.parentId;

  if (!parentChannelId) {
    await interaction.editReply("This thread is not in a valid channel.");
    return;
  }

  const bgConfig =
    config.allianceWar.battlegroupChannelMappings[parentChannelId];
  if (!bgConfig) {
    await interaction.editReply(
      "This thread is not in a recognized battlegroup channel."
    );
    return;
  }

  const nodesRange = `'${bgConfig.sheet}'!${config.allianceWar.nodesRange}`;
  const [nodesData] = await sheetsService.readSheets(config.MCOC_SHEET_ID, [
    nodesRange,
  ]);
  const mergedData = await getMergedData(bgConfig.sheet);

  const playerAssignments: { node: string; value: string }[] = [];

  for (const assignment of mergedData) {
    const { node, prefightPlayer, prefightChampion } = assignment;

    let formattedAssignment = formatAssignment(assignment);

    // Append note if a prefight is for this player's assignment
    if (
      prefightPlayer &&
      prefightChampion &&
      assignment.playerName === playerName
    ) {
      const prefightNote = ` (Prefight: ${getEmoji(
        prefightChampion
      )} ${prefightChampion})`;
      formattedAssignment += prefightNote;
    }

    // Add assignment if it belongs to the player
    if (assignment.playerName === playerName) {
      playerAssignments.push({
        node: node,
        value: formattedAssignment,
      });
    }
  }

  const nodeLookup: Record<string, string> = {};
  if (nodesData) {
    for (const row of nodesData) {
      const nodeNumber = (row[0] || "").trim();
      if (!nodeNumber) continue;
      const nodeNames = (row[1] || "").split("\n");
      const nodeDescriptions = (row[2] || "").split("\n");
      let detailsContent = "\n**Node Details:**\n";
      let detailsAdded = false;
      for (let i = 0; i < nodeNames.length; i++) {
        const name = (nodeNames[i] || "").trim();
        const desc = (nodeDescriptions[i] || "").trim();
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
  const targetNodeOption = interaction.options.getString("node");
  if (targetNodeOption) {
    filteredAssignments = playerAssignments.filter(
      (a) => a.node === targetNodeOption
    );
  }

  if (filteredAssignments.length === 0) {
    await interaction.editReply(
      targetNodeOption
        ? `No assignment for node '${targetNodeOption}'.`
        : `No assignments found for you in ${bgConfig.sheet}.`
    );
    return;
  }

  const MAX_LENGTH = 3800;
  let components: TextDisplayBuilder[] = [];
  let currentLength = 0;
  let isFirstMessage = true;

  const sendContainer = async () => {
    if (components.length === 0) return;

    const container = new ContainerBuilder()
      .setAccentColor(bgConfig.color)
      .addTextDisplayComponents(...components);

    if (isFirstMessage) {
      await interaction.editReply({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
      isFirstMessage = false;
    } else {
      await interaction.followUp({
        components: [container],
        flags: [MessageFlags.IsComponentsV2],
      });
    }
  };

  const title = `**AW Details for ${capitalize(interaction.channel.name)}**`;
  components.push(new TextDisplayBuilder().setContent(title));
  currentLength += title.length;

  for (const assignment of filteredAssignments) {
    let assignmentText = `**Node ${assignment.node}**\n- ${assignment.value}\n`;
    const nodeDetails = nodeLookup[assignment.node];
    if (nodeDetails) {
      assignmentText += nodeDetails;
    }

    if (currentLength + assignmentText.length > MAX_LENGTH) {
      await sendContainer();
      components = [
        new TextDisplayBuilder().setContent(
          `**AW Details for ${capitalize(interaction.channel.name)} (cont.)**`
        ),
      ];
      currentLength = components[0].toJSON().content.length;
    }

    components.push(new TextDisplayBuilder().setContent(assignmentText));
    currentLength += assignmentText.length;
  }

  if (components.length > 0) {
    await sendContainer();
  }
}
