import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  User,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";
import { processRosterScreenshot, getRoster, deleteRoster } from "../services/rosterService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const image = interaction.options.getAttachment("image", true) as Attachment;
  const stars = interaction.options.getInteger("stars", true);
  const rank = interaction.options.getInteger("rank", true);
  const playerOption = interaction.options.getUser("player");
  const debug = interaction.options.getBoolean("debug") || false;

  const targetUser = playerOption || interaction.user;

  try {
    if (debug) {
      const result = await processRosterScreenshot(image.url, stars, rank, true);
      await safeReply(interaction, result);
      return;
    }

    const player = await prisma.player.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!player) {
      await safeReply(interaction, `Player ${targetUser.username} is not registered. Please register with /profile register first.`);
      return;
    }

    const result = await processRosterScreenshot(image.url, stars, rank, false, player.id);
    await safeReply(interaction, result);
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:roster:update",
      userId: interaction.user.id,
    });
    await safeReply(interaction, userMessage);
  }
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars");
  const rank = interaction.options.getInteger("rank");
  const playerOption = interaction.options.getUser("player");

  const targetUser = playerOption || interaction.user;

  try {
    const player = await prisma.player.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!player) {
      await safeReply(interaction, `Player ${targetUser.username} is not registered. Please register with /profile register first.`);
      return;
    }

    const roster = await getRoster(player.id, stars, rank);
    await safeReply(interaction, roster);
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:roster:view",
      userId: interaction.user.id,
    });
    await safeReply(interaction, userMessage);
  }
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const playerOption = interaction.options.getUser("player");
  const targetUser = playerOption || interaction.user;

  try {
    const player = await prisma.player.findUnique({
      where: { discordId: targetUser.id },
    });

    if (!player) {
      await safeReply(interaction, `Player ${targetUser.username} is not registered. Please register with /profile register first.`);
      return;
    }

    const result = await deleteRoster(player.id);
    await safeReply(interaction, result);
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:roster:delete",
      userId: interaction.user.id,
    });
    await safeReply(interaction, userMessage);
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Manage your MCOC roster.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update your roster from a screenshot.")
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription("A screenshot of your champion roster.")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("The star level of the champions in the screenshot.")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("The rank of the champions in the screenshot.")
            .setRequired(true)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player to update the roster for (defaults to you).")
            .setRequired(false)
        )
        .addBooleanOption((option) =>
          option
            .setName("debug")
            .setDescription("Run in debug mode without saving to the database.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View a player's roster.")
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("Filter by star level.")
            .setRequired(false)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("Filter by rank.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to view (defaults to you).")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a player's roster.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to delete (defaults to you).")
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "update") {
      await handleUpdate(interaction);
    } else if (subcommand === "view") {
      await handleView(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    }
  },
};
