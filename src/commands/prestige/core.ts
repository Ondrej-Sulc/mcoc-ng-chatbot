import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { buildPrestigeConfirmationContainer } from "./ui";
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

  if (targetUserId && userId !== targetUserId) {
    const confirmationButtons = buildPrestigeConfirmationContainer(
      targetPlayer
    );
    const message = await interaction.editReply({
      content: `Are you sure you want to update prestige for **${targetPlayer.ingameName}**?`,
      components: [confirmationButtons],
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    return new Promise((resolve) => {
      collector.on("collect", async (i) => {
        if (i.user.id !== userId) {
          await i.reply({
            content: "You cannot respond to this confirmation.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }

        collector.stop();
        if (i.customId.startsWith("prestige:confirm")) {
          const result = await updatePrestige({
            userId: params.userId,
            imageUrl: params.imageUrl,
            targetUserId: params.targetUserId,
            player: targetPlayer,
            debug: params.debug,
          });
          resolve(result);
        } else {
          resolve({ content: "Prestige update cancelled." });
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          resolve({ content: "Confirmation timed out." });
        }
      });
    });
  }

  return await updatePrestige({ ...params, player: targetPlayer });
}