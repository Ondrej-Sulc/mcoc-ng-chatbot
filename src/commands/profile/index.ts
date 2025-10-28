import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleName } from "./name";
import { handleView } from "./view";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Manage your player profile.")
    .addSubcommand(subcommand =>
      subcommand
        .setName("name")
        .setDescription("Change your in-game name.")
        .addStringOption(option =>
          option.setName("new_name")
            .setDescription("Your new in-game name.")
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName("view")
        .setDescription("View a player's profile.")
        .addUserOption(option =>
          option.setName("user")
            .setDescription("The user to view.")
            .setRequired(false)
        )
    ),
  access: CommandAccess.USER,

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "name") {
      await handleName(interaction);
    } else if (subcommand === "view") {
      await handleView(interaction);
    }
  },
};