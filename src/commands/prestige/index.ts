import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { Command } from "../../types/command";
import { handleUpdate } from "./update";
import { handleLeaderboard } from "./leaderboard";
import { prisma } from "../../services/prismaService";

export async function autocomplete(interaction: AutocompleteInteraction) {
  const focusedValue = interaction.options.getFocused();
  const guildId = interaction.guildId;
  if (!guildId) return;

  const alliance = await prisma.alliance.findUnique({
    where: { guildId },
    select: { id: true },
  });

  if (!alliance) {
    await interaction.respond([]);
    return;
  }

  const players = await prisma.player.findMany({
    where: {
      allianceId: alliance.id,
      ingameName: {
        contains: focusedValue,
        mode: "insensitive",
      },
    },
    take: 25,
  });

  await interaction.respond(
    players.map((player) => ({
      name: player.ingameName,
      value: player.discordId,
    }))
  );
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("prestige")
    .setDescription(
      "Extract prestige values from an MCOC screenshot or view the leaderboard."
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Extract prestige values from an MCOC screenshot.")
        .addAttachmentOption((option) =>
          option
            .setName("image")
            .setDescription(
              "Screenshot of your MCOC profile showing prestige values."
            )
            .setRequired(true)
        )
        .addStringOption((option) =>
          option
            .setName("player")
            .setDescription("The player to update prestige for.")
            .setRequired(false)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("leaderboard")
        .setDescription("Shows the server prestige leaderboard.")
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "update") {
      await handleUpdate(interaction);
    } else if (subcommand === "leaderboard") {
      await handleLeaderboard(interaction);
    }
  },
  autocomplete,
};
