import {
  ChatInputCommandInteraction,
  ChannelType,
  Collection,
  ThreadChannel,
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { config } from "../../config";
import { prisma } from "../../services/prismaService";
import { getMergedData, getTeamData } from "./handlers";
import { capitalize, formatAssignment, getEmoji } from "./utils";

export async function handlePlan(interaction: ChatInputCommandInteraction) {
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

  const playerDataMap = new Map<string, {
      assignments: { node: string; formatted: string }[];
      prefights: {
        champion: string;
        targetPlayer: string;
        targetNode: string;
        targetDefender: string;
      }[];
    }>();

  for (const assignment of mergedData) {
    const {
      playerName,
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
    const formattedAssignment = await formatAssignment(assignment);
    playerDataMap.get(playerName)!.assignments.push({
      node: node,
      formatted: formattedAssignment,
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

      // Append note to the target\'s assignment
      const targetAssignment = playerDataMap
        .get(playerName)!
        .assignments.find((a) => a.node === node);
      if (targetAssignment) {
        const prefightEmoji = await getEmoji(prefightChampion);
        targetAssignment.formatted += ` (Prefight: ${prefightEmoji} ${prefightChampion})`;
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
      const teamEmojis = await Promise.all(team.map((name) => getEmoji(name)));
      const attackersString =
        "**Your Team:**\n" +
        team.map((name, i) => `${teamEmojis[i]} **${name}**`).join(" ");
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
      const prefightEmojis = await Promise.all(
        data.prefights.map((p) =>
          Promise.all([getEmoji(p.champion), getEmoji(p.targetDefender)])
        )
      );
      const prefightsValue =
        "**Pre-Fights**\n" +
        data.prefights
          .map(
            (p, i) =>
              `- ${prefightEmojis[i][0]} **${p.champion}** for ${capitalize(
                p.targetPlayer
              )}'s ${prefightEmojis[i][1]} **${
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
    `⚠️ No thread found for: ${notFound.map(capitalize).join(", ") || "None"}\n` +
    `ℹ️ No data for: ${noData.map(capitalize).join(", ") || "None"}`;

  await interaction.editReply(summary);
}