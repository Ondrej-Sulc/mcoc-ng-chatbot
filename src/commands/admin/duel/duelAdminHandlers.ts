import {
  ButtonInteraction,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { DuelStatus } from "@prisma/client";
import logger from "../../../services/loggerService";

export async function handleDuelReviewApprove(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ACTIVE },
    });

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ Approved duel target \`${duel.playerName}\`. It is now active.`
      )
    );
    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to approve duel suggestion");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while approving this suggestion."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewReject(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ARCHIVED },
    });

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🗑️ Rejected and archived duel suggestion \`${duel.playerName}\`.`
      )
    );
    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to reject duel suggestion");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while rejecting this suggestion."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewDelete(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ARCHIVED },
    });

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `🗑️ Archived outdated duel target \`${duel.playerName}\`.`
      )
    );
    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to delete outdated duel");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while archiving this duel target."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}

export async function handleDuelReviewActivate(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const duelId = parseInt(interaction.customId.split("_")[1], 10);

  try {
    const duel = await prisma.duel.update({
      where: { id: duelId },
      data: { status: DuelStatus.ACTIVE },
    });

    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `✅ Marked duel target \`${duel.playerName}\` as active again.`
      )
    );
    await interaction.editReply({
      components: [container],
    });
  } catch (error) {
    logger.error(error, "Failed to activate outdated duel");
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "An error occurred while activating this duel target."
      )
    );
    await interaction.editReply({
      components: [container],
    });
  }
}
