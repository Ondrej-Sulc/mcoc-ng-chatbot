// src/commands/profile.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command, CommandResult } from "../types/command";

import { PrismaClient } from "@prisma/client";
import { importRosterFromSheet } from "../services/rosterService";

const prisma = new PrismaClient();

async function register(
  interaction: ChatInputCommandInteraction
): Promise<CommandResult> {
  const ingameName = interaction.options.getString("name", true);
  const discordId = interaction.user.id;
  const guildId = interaction.guildId;

  if (!guildId) {
    return { content: "This command can only be used in a server." };
  }

  const player = await prisma.player.upsert({
    where: { discordId },
    update: { ingameName, guildId },
    create: { discordId, ingameName, guildId },
  });

  // Import roster from sheet after registration
  await importRosterFromSheet(player.id);

  return { content: `✅ Successfully registered **${player.ingameName}**.` };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Manage your player profile.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("register")
        .setDescription("Register your in-game name.")
        .addStringOption((option) =>
          option
            .setName("name")
            .setDescription("Your in-game name.")
            .setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({});
    const subcommand = interaction.options.getSubcommand();
    let result: CommandResult;

    switch (subcommand) {
      case "register":
        result = await register(interaction);
        break;
      default:
        result = { content: "Unknown subcommand." };
    }

    await interaction.editReply({
      content: result.content || "An unknown error occurred.",
    });
  },
};
