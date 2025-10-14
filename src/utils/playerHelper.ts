import { User, ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../services/prismaService";
import { Player } from "@prisma/client";

export async function getPlayer(
  interaction: ChatInputCommandInteraction
): Promise<Player | null> {
  const playerOption = interaction.options.getUser("player");
  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({
      content: `Player ${targetUser.username} is not registered. Please register with /profile register first.`,
    });
    return null;
  }

  return player;
}
