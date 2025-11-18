import {
  CommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SeparatorBuilder,
  TextDisplayBuilder,
  ComponentBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import type { DuelStatus } from "@prisma/client";
import logger from "../../../services/loggerService";

const DUEL_REVIEW_APPROVE_ID = "duel-review-approve_";
const DUEL_REVIEW_REJECT_ID = "duel-review-reject_";
const DUEL_REVIEW_DELETE_ID = "duel-review-delete_";
const DUEL_REVIEW_ACTIVATE_ID = "duel-review-activate_";

export async function handleDuelReview(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;

  const status = interaction.options.getString("status", true) as DuelStatus;

  await interaction.deferReply({ ephemeral: true });

  try {
    const duelsToReview = await prisma.duel.findMany({
      where: { status },
      include: { champion: true },
      orderBy: { createdAt: "desc" },
      take: 5, // Limit to 5 to avoid hitting component limits
    });

    if (duelsToReview.length === 0) {
      await interaction.editReply(`No duels found with status \`${status}\`.`);
      return;
    }

    const container = new ContainerBuilder();

    duelsToReview.forEach((duel, index) => {
      const submittedBy = duel.submittedByDiscordId
        ? `<@${duel.submittedByDiscordId}>`
        : "Unknown";

      const reviewText = `Player: \`${duel.playerName}\` (Top Champion: \`${duel.champion.name}\`)\nSubmitted By: ${submittedBy}`;

      container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(reviewText)
      );

      const actionRow = new ActionRowBuilder<ButtonBuilder>();
      if (status === "SUGGESTED") {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`${DUEL_REVIEW_APPROVE_ID}${duel.id}`)
            .setLabel("Approve")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`${DUEL_REVIEW_REJECT_ID}${duel.id}`)
            .setLabel("Reject")
            .setStyle(ButtonStyle.Danger)
        );
      } else if (status === "OUTDATED") {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`${DUEL_REVIEW_DELETE_ID}${duel.id}`)
            .setLabel("Archive")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`${DUEL_REVIEW_ACTIVATE_ID}${duel.id}`)
            .setLabel("Mark as Active")
            .setStyle(ButtonStyle.Success)
        );
      }
      container.addActionRowComponents(actionRow);

      if (index < duelsToReview.length - 1) {
        container.addSeparatorComponents(new SeparatorBuilder());
      }
    });

    await interaction.editReply({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (error) {
    logger.error(error, "Failed to fetch duels for review");
    await interaction.editReply(
      "An error occurred while fetching duels for review."
    );
  }
}

