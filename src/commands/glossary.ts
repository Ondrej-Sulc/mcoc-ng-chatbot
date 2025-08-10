import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { PrismaClient, Ability, AbilityCategory } from "@prisma/client";
import { handleError, safeReply } from "../utils/errorHandler";
import { createEmojiResolver } from "../utils/emojiResolver";

const prisma = new PrismaClient();

interface GlossaryCoreParams {
  subcommand: string;
  name: string;
  userId: string;
}

export async function core(
  params: GlossaryCoreParams,
  resolveEmoji: (text: string) => string
): Promise<CommandResult> {
  const { subcommand, name, userId } = params;

  try {
    if (subcommand === "effect") {
      const effect = await prisma.ability.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
        include: {
          categories: true,
        },
      });

      if (!effect) {
        return { content: `Effect "${name}" not found.`, ephemeral: true };
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(
          `${
            effect.emoji ? `${resolveEmoji(effect.emoji)} ` : ""
          }${effect.name}`
        )
        .setDescription(
          effect.description
            ? `*${effect.description}*`
            : "No description available."
        );

      if (effect.categories.length > 0) {
        // Show each category with its description
        for (const category of effect.categories as AbilityCategory[]) {
          embed.addFields({
            name: `Category: ${category.name}`,
            value: category.description
              ? `*${category.description}*`
              : "*No description available.*",
          });
        }

        // Find related effects from the same categories (excluding the current effect)
        const categoryIds = effect.categories.map((c) => c.id);
        if (categoryIds.length > 0) {
          const relatedRaw = await prisma.ability.findMany({
            where: {
              id: { not: effect.id },
              categories: {
                some: {
                  id: { in: categoryIds },
                },
              },
            },
            take: 100, // safety cap; we'll dedupe and trim below
          });

          // Dedupe by id and format with emojis
          const seen = new Set<number>();
          const relatedFormatted: string[] = [];
          for (const rel of relatedRaw) {
            if (seen.has(rel.id)) continue;
            seen.add(rel.id);
            const prefix = rel.emoji ? `${resolveEmoji(rel.emoji)} ` : "";
            const namePart = rel.name;
            const label = `${prefix}${namePart}`;
            relatedFormatted.push(label);
          }

          if (relatedFormatted.length > 0) {
            // Ensure we don't exceed Discord's 1024 char field limit
            let value = relatedFormatted.join(", ");
            if (value.length > 1024) {
              // Trim conservatively by adding items until near the limit
              const parts: string[] = [];
              let currentLen = 0;
              for (const part of relatedFormatted) {
                const addition = parts.length === 0 ? part : `, ${part}`;
                if (currentLen + addition.length > 1000) break; // leave room for ellipsis
                parts.push(part);
                currentLen += addition.length;
              }
              value = `${parts.join(", ")}, …`;
            }
            embed.addFields({ name: "Related Effects 🔗", value });
          }
        }
      }

      return { embeds: [embed] };
    } else if (subcommand === "category") {
      const category = await prisma.abilityCategory.findFirst({
        where: {
          name: {
            equals: name,
            mode: "insensitive",
          },
        },
        include: {
          abilities: true,
        },
      });

      if (!category) {
        return { content: `Category "${name}" not found.`, ephemeral: true };
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(category.name)
        .setDescription(
          category.description ? `*${category.description}*` : ""
        );

      if (category.abilities.length > 0) {
        const formatted = category.abilities.map((a: Ability) => {
          const prefix = a.emoji ? `${resolveEmoji(a.emoji)} ` : "";
          const namePart = a.name;
          return `${prefix}${namePart}`;
        });

        // Ensure we don't exceed Discord's 1024 char field limit
        let value = formatted.join(", ");
        if (value.length > 1024) {
          const parts: string[] = [];
          let currentLen = 0;
          for (const part of formatted) {
            const addition = parts.length === 0 ? part : `, ${part}`;
            if (currentLen + addition.length > 1000) break;
            parts.push(part);
            currentLen += addition.length;
          }
          value = `${parts.join(", ")}, …`;
        }

        embed.addFields({
          name: "Effects",
          value,
        });
      }

      return { embeds: [embed] };
    }
    return { content: "Invalid subcommand.", ephemeral: true };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: `command:glossary:${subcommand}`,
      userId: userId,
    });
    return { content: userMessage, ephemeral: true };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("glossary")
    .setDescription("Look up MCOC effects, buffs, and debuffs.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("effect")
        .setDescription("Look up a specific effect by name.")
        .addStringOption((option) =>
          option
            .setName("effect")
            .setDescription("The name of the effect.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("category")
        .setDescription("List all effects within a given category.")
        .addStringOption((option) =>
          option
            .setName("category")
            .setDescription("The name of the category.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
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
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const subcommand = interaction.options.getSubcommand();
    const name = interaction.options.getString(subcommand);

    if (!name) {
      await interaction.editReply({ content: "You must provide a name." });
      return;
    }

    try {
      const resolveEmoji = createEmojiResolver(interaction.client, interaction.guild);
      const result = await core(
        {
          subcommand,
          name,
          userId: interaction.user.id,
        },
        resolveEmoji
      );

      if (result.embeds) {
        await interaction.editReply({
          content: result.content || "",
          embeds: result.embeds,
        });
      } else if (result.content) {
        await interaction.editReply({ content: result.content });
      }
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:glossary",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

export default command;
