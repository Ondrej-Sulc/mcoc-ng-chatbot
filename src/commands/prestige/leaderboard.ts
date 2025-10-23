import { Player } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";

type PrestigeType = "summoner" | "champion" | "relic";

const prestigeLabels: Record<PrestigeType, string> = {
  summoner: "Summoner",
  champion: "Champion",
  relic: "Relic",
};

function buildLeaderboardContainer(
  players: Player[],
  prestigeType: PrestigeType
): any {
  const container = new ContainerBuilder();
  container.setAccentColor(0xffd700); // Gold color

  const title = `# 🏆 ${prestigeLabels[prestigeType]} Prestige Leaderboard 🏆`;

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(title));
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const prestigeField = `${prestigeType}Prestige` as const;

  const sortedPlayers = [...players]
    .filter((p) => p[prestigeField] !== null)
    .sort((a, b) => (b[prestigeField] ?? 0) - (a[prestigeField] ?? 0));

  let leaderboardString = "";
  if (sortedPlayers.length > 0) {
    sortedPlayers.forEach((p, index) => {
      const prestigeValue = p[prestigeField];
      let rank = index + 1;
      let line = `${rank}. **${p.ingameName}** - ${prestigeValue}`;

      if (rank === 1) line = `## 🥇 ${line}`;
      if (rank === 2) line = `### 🥈 ${line}`;
      if (rank === 3) line = `### 🥉 ${line}`;

      leaderboardString += line + "\n";
    });
  } else {
    leaderboardString = "No players with this prestige type found.";
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(leaderboardString)
  );

  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...Object.keys(prestigeLabels).map((key) => {
      const type = key as PrestigeType;
      return new ButtonBuilder()
        .setCustomId(`prestige:leaderboard:${type}`)
        .setLabel(prestigeLabels[type])
        .setStyle(prestigeType === type ? ButtonStyle.Secondary : ButtonStyle.Success)
        .setDisabled(prestigeType === type);
    })
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  // This is not officially documented, but we are trying it based on user feedback.
  (container.components as any[]).push(buttons);

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export async function handleLeaderboard(
  interaction: ChatInputCommandInteraction
) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const players = await prisma.player.findMany({
    where: {
      guildId,
    },
  });

  if (players.length === 0) {
    await interaction.editReply("No players found in this server.");
    return;
  }

  const leaderboardResponse = buildLeaderboardContainer(players, "summoner");
  await interaction.editReply(leaderboardResponse);
}

async function handleLeaderboardButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const guildId = interaction.guildId;
  if (!guildId) {
    // This should not happen as buttons are guild-specific
    return;
  }

  const customIdParts = interaction.customId.split(":");
  const prestigeType = customIdParts[2] as PrestigeType;

  const players = await prisma.player.findMany({
    where: {
      guildId,
    },
  });

  // No need to check for players.length === 0, as the message already exists.

  const leaderboardResponse = buildLeaderboardContainer(players, prestigeType);
  await interaction.editReply(leaderboardResponse);
}

registerButtonHandler(
  "prestige:leaderboard",
  handleLeaderboardButton
);