import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command } from "../../types/command";
import { handleProfileRegister } from "./register";

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
    await interaction.deferReply({ ephemeral: true });
    const subcommand = interaction.options.getSubcommand(true);

    switch (subcommand) {
      case "register":
        await handleProfileRegister(interaction);
        break;
    }
  },
};
