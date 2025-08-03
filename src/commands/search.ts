import {
  SlashCommandBuilder,
  EmbedBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { Prisma, PrismaClient, ChampionClass } from "@prisma/client";
import { handleError, safeReply } from "../utils/errorHandler";

const prisma = new PrismaClient();

// From legacy bot, for better display
const CLASS_EMOJIS: Record<ChampionClass, string> = {
  MYSTIC: "<:Mystic:1253449751555215504>",
  MUTANT: "<:Mutant:1253449731284406332>",
  SKILL: "<:Skill:1253449798825279660>",
  SCIENCE: "<:Science:1253449774271696967>",
  COSMIC: "<:Cosmic:1253449702595235950>",
  TECH: "<:Tech:1253449817808703519>",
  SUPERIOR: "<:Superior:1253458213618323660>",
};

interface SearchCoreParams {
  abilities?: string | null;
  immunities?: string | null;
  tags?: string | null;
  championClass?: string | null;
  abilityCategory?: string | null;
  userId: string;
}

/**
 * Parses a string of conditions separated by 'and' or 'or'.
 * @param input The input string from the user.
 * @returns An object with the list of conditions and a boolean indicating if 'and' logic should be used.
 */
function parseAndOrConditions(input: string | null | undefined): {
  conditions: string[];
  useAnd: boolean;
} {
  if (!input) {
    return { conditions: [], useAnd: true };
  }
  const lowercasedInput = input.toLowerCase();
  if (lowercasedInput.includes(" or ")) {
    return {
      conditions: input
        .split(/\s+or\s+/i)
        .map((c) => c.trim())
        .filter(Boolean),
      useAnd: false,
    };
  }
  // Default to AND logic if 'or' is not present
  return {
    conditions: input
      .split(/\s+and\s+/i)
      .map((c) => c.trim())
      .filter(Boolean),
    useAnd: true,
  };
}

/**
 * Gets the prefix and the current search term for autocomplete.
 * @param current The current input string from the user.
 * @returns An object with the prefix and the search term.
 */
function getAutocompletePrefixAndCurrent(current: string): {
  prefix: string;
  search: string;
} {
  let prefix = "";
  let search = current;
  const lastAnd = current.toLowerCase().lastIndexOf(" and ");
  const lastOr = current.toLowerCase().lastIndexOf(" or ");

  if (lastAnd > lastOr) {
    prefix = current.substring(0, lastAnd + 5); // " and " is 5 chars
    search = current.substring(lastAnd + 5);
  } else if (lastOr > lastAnd) {
    prefix = current.substring(0, lastOr + 4); // " or " is 4 chars
    search = current.substring(lastOr + 4);
  }
  return { prefix, search };
}

export async function core(params: SearchCoreParams): Promise<CommandResult> {
  const { abilities, immunities, tags, championClass, abilityCategory, userId } =
    params;

  try {
    if (!abilities && !immunities && !tags && !championClass && !abilityCategory) {
      return { content: "You must provide at least one search criteria." };
    }

    const where: Prisma.ChampionWhereInput = { AND: [] };

    // Handle Champion Class search
    if (championClass) {
      const { conditions, useAnd } = parseAndOrConditions(championClass);
      const classEnums = conditions
        .map((c) => c.toUpperCase())
        .filter((c) =>
          Object.keys(ChampionClass).includes(c)
        ) as ChampionClass[];

      if (classEnums.length > 0) {
        if (useAnd) {
          // A champion can't be multiple classes, so this will yield 0 results if more than one class is provided.
          classEnums.forEach((c) => {
            (where.AND as Prisma.ChampionWhereInput[]).push({ class: c });
          });
        } else {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            class: { in: classEnums },
          });
        }
      }
    }

    // Handle Tags search
    if (tags) {
      const { conditions, useAnd } = parseAndOrConditions(tags);
      if (conditions.length > 0) {
        if (useAnd) {
          conditions.forEach((tagName) => {
            (where.AND as Prisma.ChampionWhereInput[]).push({
              tags: {
                some: { name: { equals: tagName, mode: "insensitive" } },
              },
            });
          });
        } else {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            tags: {
              some: { name: { in: conditions, mode: "insensitive" } },
            },
          });
        }
      }
    }

    // Handle Abilities search
    if (abilities) {
      const { conditions, useAnd } = parseAndOrConditions(abilities);
      if (conditions.length > 0) {
        if (useAnd) {
          conditions.forEach((abilityName) => {
            (where.AND as Prisma.ChampionWhereInput[]).push({
              abilities: {
                some: {
                  type: "ABILITY",
                  ability: {
                    name: { equals: abilityName, mode: "insensitive" },
                  },
                },
              },
            });
          });
        } else {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "ABILITY",
                ability: { name: { in: conditions, mode: "insensitive" } },
              },
            },
          });
        }
      }
    }

    // Handle Immunities search
    if (immunities) {
      const { conditions, useAnd } = parseAndOrConditions(immunities);
      if (conditions.length > 0) {
        if (useAnd) {
          conditions.forEach((immunityName) => {
            (where.AND as Prisma.ChampionWhereInput[]).push({
              abilities: {
                some: {
                  type: "IMMUNITY",
                  ability: {
                    name: { equals: immunityName, mode: "insensitive" },
                  },
                },
              },
            });
          });
        } else {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                type: "IMMUNITY",
                ability: { name: { in: conditions, mode: "insensitive" } },
              },
            },
          });
        }
      }
    }

    // Handle Ability Category search
    if (abilityCategory) {
      const { conditions, useAnd } = parseAndOrConditions(abilityCategory);
      if (conditions.length > 0) {
        const categoryQuery = {
          abilities: {
            some: {
              ability: {
                categories: {
                  some: {
                    name: {
                      in: conditions,
                      mode: "insensitive",
                    },
                  },
                },
              },
            },
          },
        };

        if (useAnd) {
          conditions.forEach((categoryName) => {
            (where.AND as Prisma.ChampionWhereInput[]).push({
              abilities: {
                some: {
                  ability: {
                    categories: {
                      some: {
                        name: {
                          equals: categoryName,
                          mode: "insensitive",
                        },
                      },
                    },
                  },
                },
              },
            });
          });
        } else {
          (where.AND as Prisma.ChampionWhereInput[]).push({
            abilities: {
              some: {
                ability: {
                  categories: {
                    some: {
                      name: {
                        in: conditions,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              },
            },
          });
        }
      }
    }

    const champions = await prisma.champion.findMany({
      where,
      include: {
        tags: true,
        abilities: {
          include: {
            ability: {
              include: {
                categories: true,
              },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    if (champions.length === 0) {
      return { content: "No champions found matching your criteria." };
    }

    // For rich output, get the search criteria back
    const searchCriteria = {
      abilities: parseAndOrConditions(abilities).conditions.map((c) =>
        c.toLowerCase()
      ),
      immunities: parseAndOrConditions(immunities).conditions.map((c) =>
        c.toLowerCase()
      ),
      tags: parseAndOrConditions(tags).conditions.map((c) => c.toLowerCase()),
      abilityCategory: parseAndOrConditions(abilityCategory).conditions.map((c) =>
        c.toLowerCase()
      ),
    };

    const descriptionLines: string[] = [];
    const championsToDisplay = champions.slice(0, 15); // Show up to 15 champions

    for (const champion of championsToDisplay) {
      const classEmoji = CLASS_EMOJIS[champion.class] || "";
      let champString = `${classEmoji} **${champion.name}**`;

      // Find and display matched abilities
      const matchedAbilities = champion.abilities
        .filter(
          (link) =>
            link.type === "ABILITY" &&
            searchCriteria.abilities.includes(link.ability.name.toLowerCase())
        )
        .map((link) => link.ability.name);
      if (matchedAbilities.length > 0) {
        champString += `\n> Abilities: *${matchedAbilities.join(", ")}*`;
      }

      // Find and display matched immunities
      const matchedImmunities = champion.abilities
        .filter(
          (link) =>
            link.type === "IMMUNITY" &&
            searchCriteria.immunities.includes(link.ability.name.toLowerCase())
        )
        .map((link) => link.ability.name);
      if (matchedImmunities.length > 0) {
        champString += `\n> Immunities: *${matchedImmunities.join(", ")}*`;
      }

      // Find and display matched tags
      const matchedTags = champion.tags
        .filter((tag) => searchCriteria.tags.includes(tag.name.toLowerCase()))
        .map((tag) => tag.name);
      if (matchedTags.length > 0) {
        champString += `\n> Tags: *${matchedTags.join(", ")}*`;
      }

      // Find and display matched ability categories and their abilities
      if (searchCriteria.abilityCategory.length > 0) {
        const matchedAbilitiesForCategory = champion.abilities.filter((link) =>
          link.ability.categories.some((cat) =>
            searchCriteria.abilityCategory.includes(cat.name.toLowerCase())
          )
        );

        if (matchedAbilitiesForCategory.length > 0) {
          const displayCategories = [
            ...new Set(
              matchedAbilitiesForCategory.flatMap((link) =>
                link.ability.categories
                  .filter((cat) =>
                    searchCriteria.abilityCategory.includes(
                      cat.name.toLowerCase()
                    )
                  )
                  .map((cat) => cat.name)
              )
            ),
          ];

          const displayAbilities = [
            ...new Set(
              matchedAbilitiesForCategory.map((link) => link.ability.name)
            ),
          ];

          if (displayCategories.length > 0) {
            champString += `\n> Categories: *${displayCategories.join(
              ", "
            )}*`;
            champString += `\n> Matching Abilities: *${displayAbilities.join(
              ", "
            )}*`;
          }
        }
      }

      descriptionLines.push(champString);
    }

    let footer = "";
    if (champions.length > championsToDisplay.length) {
      footer = `... and ${ 
        champions.length - championsToDisplay.length
      } more champion(s).`;
    }

    const fullDescription = `Found **${
      champions.length
    }** champion(s) matching your criteria.\n\n${descriptionLines.join(
      "\n\n"
    )}`;

    const embed = new EmbedBuilder()
      .setTitle("Champion Search Results")
      .setDescription(fullDescription)
      .setColor("Gold");

    if (footer) {
      embed.setFooter({ text: footer });
    }

    return { embeds: [embed] };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:search:core",
      userId: userId,
    });
    return { content: userMessage };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("search")
    .setDescription("Search for champions using multiple criteria.")
    .addStringOption((option) =>
      option
        .setName("abilities")
        .setDescription("Search by abilities (use 'and'/'or')")
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("immunities")
        .setDescription("Search by immunities (use 'and'/'or')")
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("tags")
        .setDescription("Search by tags (use 'and'/'or')")
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("class")
        .setDescription("Search by class (use 'and'/'or')")
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("ability-category")
        .setDescription("Search by ability category (use 'and'/'or')")
        .setAutocomplete(true)
    ),
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const focusedValue = focusedOption.value;

    const { prefix, search } = getAutocompletePrefixAndCurrent(focusedValue);

    if (focusedOption.name === "abilities") {
      const abilities = await prisma.ability.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
          champions: {
            some: {
              type: "ABILITY",
            },
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        abilities.map((ability) => ({
          name: `${prefix}${ability.name}`,
          value: `${prefix}${ability.name}`,
        }))
      );
    } else if (focusedOption.name === "immunities") {
      const immunities = await prisma.ability.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
          champions: {
            some: {
              type: "IMMUNITY",
            },
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        immunities.map((immunity) => ({
          name: `${prefix}${immunity.name}`,
          value: `${prefix}${immunity.name}`,
        }))
      );
    } else if (focusedOption.name === "tags") {
      const tags = await prisma.tag.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        distinct: ["name"],
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        tags.map((tag) => ({
          name: `${prefix}${tag.name}`,
          value: `${prefix}${tag.name}`,
        }))
      );
    } else if (focusedOption.name === "class") {
      const classes = Object.values(ChampionClass).filter((c) =>
        c.toLowerCase().includes(search.toLowerCase())
      );
      await interaction.respond(
        classes.map((c) => ({ name: `${prefix}${c}`, value: `${prefix}${c}` }))
      );
    } else if (focusedOption.name === "ability-category") {
      const categories = await prisma.abilityCategory.findMany({
        where: {
          name: {
            contains: search,
            mode: "insensitive",
          },
        },
        take: 25,
        orderBy: { name: "asc" },
      });
      await interaction.respond(
        categories.map((category) => ({
          name: `${prefix}${category.name}`,
          value: `${prefix}${category.name}`,
        }))
      );
    }
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply(); // Not ephemeral to show results to everyone

    const abilities = interaction.options.getString("abilities");
    const immunities = interaction.options.getString("immunities");
    const tags = interaction.options.getString("tags");
    const championClass = interaction.options.getString("class");
    const abilityCategory = interaction.options.getString("ability-category");

    try {
      const result = await core({
        abilities,
        immunities,
        tags,
        championClass,
        abilityCategory,
        userId: interaction.user.id,
      });

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
        location: "command:search",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

export default command;
