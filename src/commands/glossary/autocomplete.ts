import { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../services/prismaService";
import { Ability, AbilityCategory } from "@prisma/client";

export async function handleAutocomplete(interaction: AutocompleteInteraction) {
  const focusedOption = interaction.options.getFocused(true);

  if (focusedOption.name === "effect") {
    const effects = await prisma.ability.findMany({
      where: {
        name: {
          contains: focusedOption.value,
          mode: "insensitive",
        },
      },
      take: 25,
    });
    await interaction.respond(
      effects.map((effect: Ability) => ({
        name: effect.name,
        value: effect.name,
      }))
    );
  } else if (focusedOption.name === "category") {
    const categories = await prisma.abilityCategory.findMany({
      where: {
        name: {
          contains: focusedOption.value,
          mode: "insensitive",
        },
      },
      take: 25,
    });
    await interaction.respond(
      categories.map((category: AbilityCategory) => ({
        name: category.name,
        value: category.name,
      }))
    );
  }
}