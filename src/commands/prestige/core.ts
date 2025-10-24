import { ChatInputCommandInteraction } from "discord.js";
import { CommandResult } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { updatePrestige } from "./updatePrestige";

export async function core(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  interaction: ChatInputCommandInteraction;
}): Promise<CommandResult> {
  const { userId, imageUrl, targetUserId, debug, interaction } = params;
  const finalUserId = targetUserId || userId;

  const authorPlayer = await prisma.player.findUnique({
    where: { discordId: userId },
  });
  if (!authorPlayer) {
    return {
      content: `You are not registered. Please register with 
/profile register
 first.`,
    };
  }

  const targetPlayer = await prisma.player.findUnique({
    where: { discordId: finalUserId },
  });

  if (!targetPlayer) {
    const content = targetUserId
      ? `Player with Discord ID ${targetUserId} is not registered. They must register with 
/profile register
 first.`
      : `You are not registered. Please register with 
/profile register
 first.`;
    return { content };
  }

  return await updatePrestige({ ...params, player: targetPlayer });
}
