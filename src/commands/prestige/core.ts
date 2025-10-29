import { ChatInputCommandInteraction } from "discord.js";
import { CommandResult } from "../../types/command";
import { updatePrestige } from "./updatePrestige";
import { getActivePlayer } from "../../utils/playerHelper";

export async function core(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  interaction: ChatInputCommandInteraction;
}): Promise<CommandResult> {
  const { userId, imageUrl, targetUserId, debug, interaction } = params;
  const finalUserId = targetUserId || userId;

  const authorPlayer = await getActivePlayer(userId);
  if (!authorPlayer) {
    return {
      content: `You are not registered. Please register with /profile add first.`,
    };
  }

  const targetPlayer = await getActivePlayer(finalUserId);

  if (!targetPlayer) {
    const content = targetUserId
      ? `Player with Discord ID ${targetUserId} is not registered. They must register with /profile add first.`
      : `You are not registered. Please register with /profile add first.`;
    return { content };
  }

  return await updatePrestige({ ...params, player: targetPlayer });
}
