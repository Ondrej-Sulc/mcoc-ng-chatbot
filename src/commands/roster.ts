import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  User,
} from "discord.js";
import { Command } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";
import { processRosterScreenshot, getRoster, deleteRoster, RosterUpdateResult, RosterWithChampion } from "../services/rosterService";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars", true);
  const rank = interaction.options.getInteger("rank", true);
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

    const images: Attachment[] = [];
    for (let i = 1; i <= 5; i++) {
        const image = interaction.options.getAttachment(`image${i}`);
        if (image) {
            images.push(image);
        }
    }

    if (images.length === 0) {
        await interaction.editReply('You must provide at least one image.');
        return;
    }

    let totalChampionsAdded = 0;
    const resultMessages: string[] = [];

    await interaction.editReply(`Processing ${images.length} image(s)...`);

    for (const image of images) {
        try {
            const result = await processRosterScreenshot(image.url, stars, rank, false, player.id) as RosterUpdateResult;
            totalChampionsAdded += result.count;
            resultMessages.push(`- ${image.name}: ${result.message}`);
        } catch (error) {
            const { userMessage } = handleError(error, {
                location: "command:roster:update:image",
                userId: interaction.user.id,
                extra: { imageName: image.name },
            });
            resultMessages.push(`- ${image.name}: Error - ${userMessage}`);
        }
    }

    await interaction.followUp(
        `Roster update complete. Total champions added/updated: ${totalChampionsAdded}.\n\n**Details:**\n${resultMessages.join('\n')}`
    );

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

    if (typeof roster === 'string') {
        await safeReply(interaction, roster);
        return;
    }

    let response = "";
    roster.forEach((entry: RosterWithChampion) => {
        const awakened = entry.isAwakened ? '★' : '☆';
        const emoji = entry.champion.discordEmoji || '';
        response += `${emoji} ${entry.champion.name} ${entry.stars}* R${entry.rank} ${awakened}\n`;
    });

    await safeReply(interaction, response);
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
        .setDescription("Update your roster from one or more screenshots.")
        .addIntegerOption((option) => option.setName("stars").setDescription("The star level of the champions in the screenshot.").setRequired(true))
        .addIntegerOption((option) => option.setName("rank").setDescription("The rank of the champions in the screenshot.").setRequired(true))
        .addAttachmentOption((option) => option.setName("image1").setDescription("A screenshot of your champion roster.").setRequired(true))
        .addAttachmentOption((option) => option.setName("image2").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image3").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image4").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image5").setDescription("Another screenshot.").setRequired(false))
        .addUserOption((option) => option.setName("player").setDescription("The player to update the roster for (defaults to you).").setRequired(false))
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
