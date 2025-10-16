import { ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";

export async function handleLeaderboard(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply("This command can only be used in a server.");
    return;
  }

  const players = await prisma.player.findMany({
    where: {
      guildId,
      summonerPrestige: {
        not: null,
      },
    },
    orderBy: {
      summonerPrestige: "desc",
    },
    take: 10,
  });

  if (players.length === 0) {
    await interaction.editReply(
      "No players with prestige found in this server."
    );
    return;
  }

  let leaderboardString = "🏆 **Prestige Leaderboard** 🏆\n\n";
  players.forEach((p, index) => {
    leaderboardString += `${index + 1}. **${p.ingameName}** - ${p.summonerPrestige}\n`;
  });

  await interaction.editReply(leaderboardString);
}
