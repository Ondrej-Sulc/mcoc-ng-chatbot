import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { Command } from "../../types/command";
import { handleHome } from "./home";
import { registerHelpButtons } from "./buttons";

registerHelpButtons();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays an interactive help guide for all bot commands."),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    const result = await handleHome();
    await interaction.editReply(result);
  },
};

export default command;
