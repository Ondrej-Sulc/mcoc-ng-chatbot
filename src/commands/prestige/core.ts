import {
  ChatInputCommandInteraction,
  ComponentType,
  MessageFlags,
  AttachmentBuilder,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder
} from "discord.js";
import { CommandResult } from "../../types/command";
import { prisma } from "../../services/prismaService";
import { Player } from "@prisma/client";
import { buildPrestigeConfirmationContainer } from "./ui";
import { extractPrestigeFromImage } from "./ocr";

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
            ...params,
            player: targetPlayer,
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

async function updatePrestige(params: {
  userId: string;
  imageUrl: string;
  targetUserId?: string;
  debug?: boolean;
  player: Player;
}): Promise<CommandResult> {
  const { imageUrl, debug, player } = params;

  const res = await fetch(imageUrl);
  if (!res.ok) {
    return {
      content: `❌ **Error:** Failed to download image. Status: ${res.status}`,
    };
  }
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  const result = await extractPrestigeFromImage(imageBuffer, debug);

  if (debug) {
    const attachments: AttachmentBuilder[] = [];
    let debugContent = "## Prestige Debug Info\n";

    if (result.debugInfo?.croppedImage) {
      attachments.push(
        new AttachmentBuilder(result.debugInfo.croppedImage, {
          name: "cropped_debug.png",
        })
      );
    }

    debugContent += `**Success:** ${result.success}\n`;
    debugContent += `**Fallback Used:** ${result.fallback ?? false}\n`;
    if (result.error) {
      debugContent += `**Error:** ${result.error}\n`;
    }

    if (result.debugInfo?.cropAttempt) {
      debugContent += "\n### Crop Attempt\n";
      if (result.debugInfo.cropAttempt.error) {
        debugContent += `**Error:** ${result.debugInfo.cropAttempt.error}\n`;
      }
      if (result.debugInfo.cropAttempt.detectedLabels) {
        debugContent += `**Detected:** S: ${result.debugInfo.cropAttempt.detectedLabels.summoner}, C: ${result.debugInfo.cropAttempt.detectedLabels.champion}, R: ${result.debugInfo.cropAttempt.detectedLabels.relic}\n`;
      }
      if (result.debugInfo.cropAttempt.text) {
        debugContent +=
          "**OCR Text:**\n```\n" +
          result.debugInfo.cropAttempt.text.substring(0, 1000) +
          "\n```\n";
      }
    }

    if (result.debugInfo?.fullAttempt) {
      debugContent += "\n### Full Image Attempt\n";
      if (result.debugInfo.fullAttempt.error) {
        debugContent += `**Error:** ${result.debugInfo.fullAttempt.error}\n`;
      }
      if (result.debugInfo.fullAttempt.detectedLabels) {
        debugContent += `**Detected:** S: ${result.debugInfo.fullAttempt.detectedLabels.summoner}, C: ${result.debugInfo.fullAttempt.detectedLabels.champion}, R: ${result.debugInfo.fullAttempt.detectedLabels.relic}\n`;
      }
      if (result.debugInfo.fullAttempt.text) {
        debugContent +=
          "**OCR Text:**\n```\n" +
          result.debugInfo.fullAttempt.text.substring(0, 1000) +
          "\n```\n";
      }
    }

    return {
      content: debugContent,
      files: attachments,
    };
  }

  const { success, summonerPrestige, championPrestige, relicPrestige } = result;

  const isValid =
    success && summonerPrestige! === championPrestige! + relicPrestige!;

  if (isValid) {
    const oldPrestige = player.summonerPrestige;

    await prisma.player.update({
      where: { id: player.id },
      data: {
        summonerPrestige,
        championPrestige,
        relicPrestige,
      },
    });

    const prestigeChange =
      oldPrestige && oldPrestige > 0 ? summonerPrestige! - oldPrestige : 0;
    const changeString =
      prestigeChange > 0
        ? `(+${prestigeChange})`
        : prestigeChange < 0
        ? `(${prestigeChange})`
        : "";

    const prestigeInfo =
      `**Prestige Values for ${player.ingameName}**:\n` +
      `🏆 TOP 30 Prestige: **${summonerPrestige}** ${changeString}\n` +
      `⚔️ Champion Prestige: **${championPrestige}**\n` +
      `🔮 Relic Prestige: **${relicPrestige}**\n` +
      `\n*Prestige has been updated for ${player.ingameName}.*`;

    const container = new ContainerBuilder();
    container.setAccentColor(0xffd700); // Gold color for prestige
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(prestigeInfo)
    );

    return { components: [container], isComponentsV2: true };
  } else {
    return {
      content:
        "❌ **Could not validate prestige from the image.**\n\n" +
        "For best results, please try one of the following:\n" +
        "1. Use a clear, unedited screenshot from your profile.\n" +
        "2. Crop the screenshot to *only* the area with the three prestige numbers.",
    };
  }
}
