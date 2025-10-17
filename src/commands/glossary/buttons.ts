import { ButtonInteraction } from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { handleCategory } from "./category";
import { createEmojiResolver } from "../../utils/emojiResolver";
import { handleList } from "./list";
import { handleEffect } from "./effect";

async function handleCategoryButton(interaction: ButtonInteraction) {
  await interaction.deferUpdate();
  const categoryName = interaction.customId.substring("glossary_category_".length);
  const resolveEmoji = createEmojiResolver(interaction.client);
  const result = await handleCategory(categoryName, resolveEmoji);
  await interaction.editReply(result);
}

async function handleListBackButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleList(resolveEmoji);
    await interaction.editReply(result);
}

async function handleEffectButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const parts = interaction.customId.split("_");
    const effectName = parts[2];
    const categoryName = parts[3];
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleEffect(effectName, resolveEmoji, categoryName);
    await interaction.editReply(result);
}

async function handleBackToCategoryButton(interaction: ButtonInteraction) {
    await interaction.deferUpdate();
    const categoryName = interaction.customId.substring("glossary_back_category_".length);
    const resolveEmoji = createEmojiResolver(interaction.client);
    const result = await handleCategory(categoryName, resolveEmoji);
    await interaction.editReply(result);
}

export function registerGlossaryButtons() {
  registerButtonHandler("glossary_category_", handleCategoryButton);
  registerButtonHandler("glossary_list_back", handleListBackButton);
  registerButtonHandler("glossary_effect_", handleEffectButton);
  registerButtonHandler("glossary_back_category_", handleBackToCategoryButton);
}