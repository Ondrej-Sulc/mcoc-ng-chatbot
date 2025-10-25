import { ButtonInteraction } from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleHome } from "./home";
import { handleDetail } from "./detail";

async function handleCommandButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const commandName = interaction.customId.substring("help_command_".length);
  const result = await handleDetail(commandName);
  await interaction.editReply(result);
}

async function handleHomeButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const result = await handleHome();
  await interaction.editReply(result);
}

export function registerHelpButtons() {
  registerButtonHandler("help_command_", handleCommandButton);
  registerButtonHandler("help_home", handleHomeButton);
}
