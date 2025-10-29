import { User, ChatInputCommandInteraction } from "discord.js";
import { prisma } from "../services/prismaService";
import { Player } from "@prisma/client";
import { safeReply } from "./errorHandler";

export async function getActivePlayer(discordId: string): Promise<Player | null> {
  const player = await prisma.player.findFirst({
    where: { 
      discordId,
      isActive: true,
    },
  });

  if (player) {
    return player;
  }

  // If no active player, return the first one found
  return prisma.player.findFirst({
    where: { discordId },
  });
}

export async function getPlayer(
  interaction: ChatInputCommandInteraction
): Promise<Player | null> {
  const playerOption = interaction.options.getUser("user");
  const targetUser = playerOption || interaction.user;

  const activePlayer = await getActivePlayer(targetUser.id);

  if (!activePlayer) {
    await safeReply(interaction, `Player ${targetUser.username} has no registered profiles. Please use /profile add first.`);
    return null;
  }
  
  return activePlayer;
}
