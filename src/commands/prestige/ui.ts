import { Player } from "@prisma/client";
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ContainerBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
  AttachmentBuilder,
} from "discord.js";

export function buildPrestigeConfirmationContainer(
  targetPlayer: Player
): ActionRowBuilder<ButtonBuilder> {
  const confirmationButtons =
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`prestige:confirm:${targetPlayer.discordId}`)
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`prestige:cancel:${targetPlayer.discordId}`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Danger)
    );

  return confirmationButtons;
}

import { PrestigeResult } from "./types";

export function buildPrestigeSuccessContainer(
  prestigeInfo: string,
  imageUrl: string
): any {
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

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

export function buildPrestigeFailureContainer(imageUrl: string): any {
  const container = new ContainerBuilder();
  container.setAccentColor(0xed4245); // Red

  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder().setURL(imageUrl)
    )
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const errorMessage =
    "❌ **Could not validate prestige from the image.**\n\n" +
    "For best results, please try one of the following:\n" +
    "1. Use a clear, unedited screenshot from your profile.\n" +
    "2. Crop the screenshot to *only* the area with the three prestige numbers.";

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(errorMessage)
  );

  return {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

export function buildPrestigeDebugContainer(result: PrestigeResult): any {
  const attachments: AttachmentBuilder[] = [];
  const container = new ContainerBuilder();
  container.setAccentColor(result.success ? 0x57f287 : 0xed4245);

  if (result.debugInfo?.croppedImage) {
    const attachmentName = "cropped_debug.png";
    attachments.push(
      new AttachmentBuilder(result.debugInfo.croppedImage, {
        name: attachmentName,
      })
    );
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(`attachment://${attachmentName}`)
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  }

  let debugContent = `## Prestige OCR Debug Info\n`;
  debugContent += `**Success:** ${result.success}\n`;
  debugContent += `**Fallback Used:** ${result.fallback ?? false}\n`;
  if (result.error) {
    debugContent += `**Error:** ${result.error}\n`;
  }
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(debugContent)
  );

  const addAttemptFields = (attempt: any, name: string) => {
    if (!attempt) return;

    let attemptContent = `### ${name}\n`;
    if (attempt.error) {
      attemptContent += `**Error:** ${attempt.error}\n`;
    }
    if (attempt.detectedLabels) {
      attemptContent += `**Detected Values:**\n> Summoner: ${attempt.detectedLabels.summoner}\n> Champion: ${attempt.detectedLabels.champion}\n> Relic: ${attempt.detectedLabels.relic}\n`;
    }
    if (attempt.extracted?.labels?.length) {
      const labelsStr = attempt.extracted.labels
        .map((l: any) => `> ${l.text}`)
        .join("\n");
      attemptContent +=
        `**Extracted Labels:**\n${labelsStr.substring(0, 1020)}\n`;
    }
    if (attempt.extracted?.numbers?.length) {
      const numbersStr = attempt.extracted.numbers
        .map((n: any) => `> ${n.value}`)
        .join("\n");
      attemptContent +=
        `**Extracted Numbers:**\n${numbersStr.substring(0, 1020)}\n`;
    }
    if (attempt.text) {
      attemptContent += `**OCR Text:**\n\`\`\`\n${attempt.text.substring(
        0,
        1000
      )}\n\`\`\`\n`;
    }
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(attemptContent)
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  };

  addAttemptFields(result.debugInfo?.cropAttempt, "Crop Attempt");
  addAttemptFields(result.debugInfo?.fullAttempt, "Full Image Attempt");

  return {
    components: [container],
    files: attachments,
    flags: MessageFlags.IsComponentsV2,
  };
}
