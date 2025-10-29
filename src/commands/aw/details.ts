import {
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { config } from "../../config";
import { getMergedData, getNodesData } from "./handlers";
import { capitalize, formatAssignment, getEmoji } from "./utils";
import { prisma } from "../../services/prismaService";

export async function handleDetails(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  if (!interaction.guild) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: interaction.guild.id },
    include: { config: true },
  });

  if (!alliance?.config?.sheetId) {
    await interaction.editReply(
      "This command is not configured for this server. Please set a Google Sheet ID."
    );
    return;
  }
  const sheetId = alliance.config.sheetId;

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

  const nodeLookup = await getNodesData(sheetId, bgConfig.sheet);
  const mergedData = await getMergedData(sheetId, bgConfig.sheet);

  const assignmentPromises = mergedData.map(async (assignment) => {
    const { node, prefightPlayer, prefightChampion } = assignment;
    let formattedAssignment = await formatAssignment(assignment);

    if (
      prefightPlayer &&
      prefightChampion &&
      assignment.playerName === playerName
    ) {
      const prefightEmoji = await getEmoji(prefightChampion);
      const prefightNote = ` (Prefight: ${prefightEmoji} ${prefightChampion})`;
      formattedAssignment += prefightNote;
    }

    if (assignment.playerName === playerName) {
      return {
        node: node,
        value: formattedAssignment,
      };
    }
    return null;
  });

  const resolvedAssignments = await Promise.all(assignmentPromises);
  const playerAssignments = resolvedAssignments.filter(
    (a) => a !== null
  ) as { node: string; value: string }[];

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