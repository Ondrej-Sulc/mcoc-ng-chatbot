import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleHome } from "./home";
import { registerHelpButtons } from "./buttons";

registerHelpButtons();

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("help")
    .setDescription("Displays an interactive help guide for all bot commands."),
  access: CommandAccess.PUBLIC,
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const result = await handleHome(interaction);
    await interaction.editReply({ ...result, flags: [MessageFlags.IsComponentsV2] });
  },
};

export default command;
