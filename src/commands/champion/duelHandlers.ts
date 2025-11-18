import {
  ButtonInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ModalSubmitInteraction,
  EmbedBuilder,
  TextChannel,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { DuelStatus } from "@prisma/client";
import logger from "../../services/loggerService";
import { getChampionDataById } from "../../services/championService";

const DUEL_SUGGEST_MODAL_ID = "champion-duel-suggest-modal";
const DUEL_REPORT_SELECT_ID = "champion-duel-report-select";
const DUEL_PLAYER_NAME_ID = "player-name";

// --- Notification Service ---

async function sendDuelNotification(
  interaction:
    | ButtonInteraction
    | ModalSubmitInteraction
    | StringSelectMenuInteraction,
  embed: EmbedBuilder
) {
  const channelId = process.env.ADMIN_LOG_CHANNEL_ID;
  if (!channelId) {
    logger.warn(
      "ADMIN_LOG_CHANNEL_ID is not set. Cannot send duel notification."
    );
    return;
  }

  try {
    const channel = await interaction.client.channels.fetch(channelId);
    if (channel && channel.isTextBased()) {
      (channel as TextChannel).send({ embeds: [embed] });
    }
  } catch (error) {
    logger.error(error, "Failed to send duel notification");
  }
}

// --- Button Handlers ---

export async function handleDuelSuggestButton(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];

  const modal = new ModalBuilder()
    .setCustomId(`${DUEL_SUGGEST_MODAL_ID}_${championId}`)
    .setTitle("Suggest a New Duel Target");

  const playerNameInput = new TextInputBuilder()
    .setCustomId(DUEL_PLAYER_NAME_ID)
    .setLabel("Player's In-Game Name")
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMinLength(3)
    .setMaxLength(50);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    playerNameInput
  );

  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleDuelReportButton(interaction: ButtonInteraction) {
  await interaction.deferReply({ ephemeral: true });
  const championId = parseInt(interaction.customId.split("_")[1], 10);

  const activeDuels = await prisma.duel.findMany({
    where: {
      championId,
      status: DuelStatus.ACTIVE,
    },
  });

  if (activeDuels.length === 0) {
    await interaction.editReply(
      "There are no active duel targets to report for this champion."
    );
    return;
  }

  const options = activeDuels.map((duel) => ({
    label: duel.playerName,
    value: duel.id.toString(),
    description: duel.rank ? `Rank: ${duel.rank}` : "No rank info",
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${DUEL_REPORT_SELECT_ID}_${championId}`)
    .setPlaceholder("Select the outdated duel target")
    .addOptions(options);

  const actionRow =
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.editReply({
    content: "Please select the duel target you want to report as outdated.",
    components: [actionRow],
  });
}

// --- Component Interaction Handlers ---

export async function handleDuelSuggestModalSubmit(
  interaction: ModalSubmitInteraction
) {
  await interaction.deferReply({ ephemeral: true });
  const championId = parseInt(interaction.customId.split("_")[1], 10);
  const playerName = interaction.fields.getTextInputValue(DUEL_PLAYER_NAME_ID);

  try {
    const champion = await getChampionDataById(championId);
    if (!champion) {
      await interaction.editReply("Could not find the associated champion.");
      return;
    }

    await prisma.duel.create({
      data: {
        championId,
        playerName,
        source: "user_suggestion",
        status: DuelStatus.SUGGESTED,
        submittedByDiscordId: interaction.user.id,
      },
    });

    await interaction.editReply(
      `Thank you! Your suggestion for "${playerName}" has been submitted for review.`
    );

    // Send notification
    const embed = new EmbedBuilder()
      .setTitle("New Duel Suggestion")
      .setColor("Green")
      .addFields(
        { name: "Champion", value: champion.name, inline: true },
        { name: "Suggested Target", value: playerName, inline: true },
        {
          name: "Submitted By",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        }
      )
      .setTimestamp();
    await sendDuelNotification(interaction, embed);
  } catch (error: any) {
    if (error.code === "P2002") {
      // Unique constraint violation
      await interaction.editReply(
        `This player has already been suggested for this champion. It's pending review.`
      );
    } else {
      logger.error(error, "Failed to create duel suggestion");
      await interaction.editReply(
        "An error occurred while submitting your suggestion."
      );
    }
  }
}

export async function handleDuelReportSelect(
  interaction: StringSelectMenuInteraction
) {
  await interaction.deferReply({ ephemeral: true });
  const duelId = parseInt(interaction.values[0], 10);

  try {
    const updatedDuel = await prisma.duel.update({
      where: { id: duelId },
      data: {
        status: DuelStatus.OUTDATED,
        submittedByDiscordId: interaction.user.id,
      },
      include: {
        champion: true,
      },
    });

    await interaction.editReply(
      `Thank you for your feedback. "${updatedDuel.playerName}" has been reported as outdated and will be reviewed.`
    );

    // Send notification
    const embed = new EmbedBuilder()
      .setTitle("Outdated Duel Report")
      .setColor("Red")
      .addFields(
        { name: "Champion", value: updatedDuel.champion.name, inline: true },
        {
          name: "Reported Target",
          value: updatedDuel.playerName,
          inline: true,
        },
        {
          name: "Reported By",
          value: `${interaction.user.tag} (${interaction.user.id})`,
        }
      )
      .setTimestamp();
    await sendDuelNotification(interaction, embed);
  } catch (error) {
    logger.error(error, "Failed to report duel as outdated");
    await interaction.editReply(
      "An error occurred while reporting this duel target."
    );
  }
}

// --- Admin Review Button Handlers ---

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
