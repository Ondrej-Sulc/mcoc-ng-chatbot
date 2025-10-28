import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { Command, CommandAccess } from "../../types/command";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Manage your player profile."),
  access: CommandAccess.USER,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.reply({ content: "This command is under construction.", ephemeral: true });
  },
};