import { AutocompleteInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";

export async function autocompleteAbility(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const abilities = await prisma.ability.findMany({
        where: { name: { contains: focusedValue, mode: "insensitive" } },
        take: 25,
    });
    await interaction.respond(
        abilities.map((ability) => ({ name: ability.name, value: ability.name }))
    );
}

export async function autocompleteCategory(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const categories = await prisma.abilityCategory.findMany({
        where: { name: { contains: focusedValue, mode: "insensitive" } },
        take: 25,
    });
    await interaction.respond(
        categories.map((category) => ({ name: category.name, value: category.name }))
    );
}
