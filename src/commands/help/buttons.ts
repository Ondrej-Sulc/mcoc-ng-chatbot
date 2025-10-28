import { ButtonInteraction, ChatInputCommandInteraction, MessageFlags } from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleHome } from "./home";
import { handleDetail } from "./detail";

async function handleCommandButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const commandName = interaction.customId.substring("help:".length);
  const result = await handleDetail(commandName, interaction);
  await interaction.editReply(result);
}

async function handleHomeButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const result = await handleHome(interaction as unknown as ChatInputCommandInteraction);
  await interaction.editReply({ ...result, flags: [MessageFlags.IsComponentsV2] });
}

export function registerHelpButtons() {
  registerButtonHandler("help:", handleCommandButton);
  registerButtonHandler("help_home", handleHomeButton);
}