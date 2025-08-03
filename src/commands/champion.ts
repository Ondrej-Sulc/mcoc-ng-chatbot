import {
  SlashCommandBuilder,
  EmbedBuilder,
  ColorResolvable,
  ChatInputCommandInteraction,
  MessageFlags,
} from "discord.js";
import {
  PrismaClient,
  Champion,
  ChampionClass,
  Attack,
  Hit,
  ChampionAbilityLink,
  Ability,
} from "@prisma/client";
import { Command, CommandResult } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";

const prisma = new PrismaClient();

const MAX_FIELD_VALUE_LENGTH = 1024;
const MAX_FIELDS_PER_EMBED = 25;

const CLASS_COLOR: Record<ChampionClass, ColorResolvable> = {
  MYSTIC: "Purple",
  MUTANT: "Yellow",
  SKILL: "Red",
  SCIENCE: "Green",
  COSMIC: "Aqua",
  TECH: "Blue",
  SUPERIOR: "White",
};

// Define interfaces for the expected structure of the 'fullAbilities' JSON field.
interface SignatureAbility {
  name: string; // Title
  description: string; // Description
}
interface AbilityBlock {
  title: string;
  description: string;
}

interface FullAbilities {
  signature?: SignatureAbility;
  abilities_breakdown?: AbilityBlock[];
}

// Define the expected type for an Attack with its related Hits.
// This is derived from the Prisma query include statement.
type AttackWithHits = Attack & { hits: Hit[] };

// Define the expected type for a ChampionAbilityLink with its related Ability.
// This is derived from the Prisma query include statement.
type ChampionAbilityLinkWithAbility = ChampionAbilityLink & {
  ability: Ability;
};

interface ChampionCoreParams {
  subcommand: string;
  championName: string;
  userId: string;
}

function formatAttacks(
  attacks: AttackWithHits[]
): { name: string; value: string; inline: boolean }[] {
  if (!attacks || attacks.length === 0) {
    return [
      {
        name: "Missing Information",
        value: "Sorry, Attack type values are missing for this champion.",
        inline: false,
      },
    ];
  }

  const attackStrings: { name: string; value: string; inline: boolean }[] = [];

  const groupedAttacks: { [key: string]: AttackWithHits[] } = {};
  for (const attack of attacks) {
    const key = attack.type.replace(/\d/g, ""); // Group by L, M, S, H
    if (!groupedAttacks[key]) {
      groupedAttacks[key] = [];
    }
    groupedAttacks[key].push(attack);
  }

  for (const key in groupedAttacks) {
    const group = groupedAttacks[key];
    if (group.length > 1) {
      const firstAttackHits = JSON.stringify(
        group[0].hits.map((h) => h.properties).sort()
      );
      const allSame = group.every(
        (attack) =>
          JSON.stringify(attack.hits.map((h) => h.properties).sort()) ===
          firstAttackHits
      );

      if (allSame) {
        const attack = group[0];
        const hitCounts = attack.hits.reduce(
          (acc: Record<string, number>, hit) => {
            const key = hit.properties.join(" ");
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          },
          {}
        );
        const types = Object.entries(hitCounts)
          .map(([detail, count]) => `${count}x ${detail}`)
          .join(", ");
        attackStrings.push({
          name: `${key.toUpperCase()}${
            group.length > 1 ? ` 1-${group.length}` : ""
          } Attack`,
          value: types,
          inline: true,
        });
      } else {
        for (const attack of group) {
          const hitCounts = attack.hits.reduce(
            (acc: Record<string, number>, hit) => {
              const key = hit.properties.join(" ");
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            },
            {}
          );
          const types = Object.entries(hitCounts)
            .map(([detail, count]) => `${count}x ${detail}`)
            .join(", ");
          attackStrings.push({
            name: `${attack.type} Attack`,
            value: types,
            inline: true,
          });
        }
      }
    } else {
      const attack = group[0];
      const hitCounts = attack.hits.reduce(
        (acc: Record<string, number>, hit) => {
          const key = hit.properties.join(" ");
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        },
        {}
      );
      const types = Object.entries(hitCounts)
        .map(([detail, count]) => `${count}x ${detail}`)
        .join(", ");
      attackStrings.push({
        name: `${attack.type} Attack`,
        value: types,
        inline: true,
      });
    }
  }

  return attackStrings;
}

function formatAbilities(
  abilities: ChampionAbilityLinkWithAbility[]
): { name: string; value: string; inline: boolean }[] {
  if (!abilities || abilities.length === 0) {
    return [
      {
        name: "Missing Information",
        value: "This champion does not have any abilities.",
        inline: false,
      },
    ];
  }

  const abilityStrings: { name: string; value: string; inline: boolean }[] = [];

  for (const ability of abilities) {
    const value = ability.source ? `• ${ability.source}` : "\u200b";
    abilityStrings.push({
      name: `${ability.ability.emoji ? `${ability.ability.emoji} ` : ""}${
        ability.ability.name
      }`,
      value,
      inline: true,
    });
  }

  return abilityStrings;
}

export async function core(params: ChampionCoreParams): Promise<CommandResult> {
  const { subcommand, championName, userId } = params;

  try {
    if (subcommand === "info") {
      const champion = await prisma.champion.findFirst({
        where: {
          name: {
            equals: championName,
            mode: "insensitive",
          },
        },
      });

      if (!champion) {
        return {
          content: `Champion "${championName}" not found.`,
          ephemeral: true,
        };
      }

      const fullAbilities = champion.fullAbilities as FullAbilities;

      if (
        !fullAbilities ||
        (!fullAbilities.signature && !fullAbilities.abilities_breakdown)
      ) {
        return {
          content: `Detailed abilities are not available for ${champion.name}.`,
          ephemeral: true,
        };
      }

      const embeds: EmbedBuilder[] = [];
      let currentEmbed = new EmbedBuilder()
        .setTitle(champion.name)
        .setColor(CLASS_COLOR[champion.class]);

      let currentFieldCount = 0;

      if (fullAbilities.signature) {
        const sig = fullAbilities.signature;
        const sigName = sig.name || "Signature Ability";
        const sigDesc = sig.description || "No description.";
        const descParts =
          sigDesc.match(new RegExp(`.{1,${MAX_FIELD_VALUE_LENGTH}}`, "g")) ||
          [];

        for (let i = 0; i < descParts.length; i++) {
          if (currentFieldCount >= MAX_FIELDS_PER_EMBED) {
            embeds.push(currentEmbed);
            currentEmbed = new EmbedBuilder()
              .setTitle(`${champion.name} (Continued)`)
              .setColor(CLASS_COLOR[champion.class]);
            currentFieldCount = 0;
          }
          currentEmbed.addFields({
            name: `${sigName}${descParts.length > 1 ? ` (Part ${i + 1})` : ""}`,
            value: descParts[i],
          });
          currentFieldCount++;
        }
      }

      if (fullAbilities.abilities_breakdown) {
        for (const abilityBlock of fullAbilities.abilities_breakdown) {
          const blockTitle = abilityBlock.title || "Ability";
          const blockDesc = abilityBlock.description || "No description.";
          const descParts =
            blockDesc.match(
              new RegExp(`.{1,${MAX_FIELD_VALUE_LENGTH}}`, "g")
            ) || [];

          for (let i = 0; i < descParts.length; i++) {
            if (currentFieldCount >= MAX_FIELDS_PER_EMBED) {
              embeds.push(currentEmbed);
              currentEmbed = new EmbedBuilder()
                .setTitle(`${champion.name} (Continued)`)
                .setColor(CLASS_COLOR[champion.class]);
              currentFieldCount = 0;
            }
            currentEmbed.addFields({
              name: `${blockTitle}${
                descParts.length > 1 ? ` (Part ${i + 1})` : ""
              }`,
              value: descParts[i],
            });
            currentFieldCount++;
          }
        }
      }

      if (currentFieldCount > 0) {
        embeds.push(currentEmbed);
      }

      return { embeds };
    } else if (subcommand === "attacks") {
      const champion = await prisma.champion.findFirst({
        where: {
          name: {
            equals: championName,
            mode: "insensitive",
          },
        },
        include: {
          attacks: {
            include: {
              hits: true,
            },
          },
        },
      });

      if (!champion) {
        return {
          content: `Champion "${championName}" not found.`,
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setTitle(`${champion.name} - Attacks`)
        .setColor(CLASS_COLOR[champion.class]);

      const formattedAttacks = formatAttacks(champion.attacks);
      embed.addFields(formattedAttacks);

      return { embeds: [embed] };
    } else if (subcommand === "abilities" || subcommand === "immunities") {
      const champion = await prisma.champion.findFirst({
        where: {
          name: {
            equals: championName,
            mode: "insensitive",
          },
        },
        include: {
          abilities: {
            where: {
              type: subcommand === "abilities" ? "ABILITY" : "IMMUNITY",
            },
            include: {
              ability: true,
            },
          },
        },
      });

      if (!champion) {
        return {
          content: `Champion "${championName}" not found.`,
          ephemeral: true,
        };
      }

      const embed = new EmbedBuilder()
        .setTitle(
          `${champion.name} - ${
            subcommand.charAt(0).toUpperCase() + subcommand.slice(1)
          }`
        )
        .setColor(CLASS_COLOR[champion.class]);

      const formattedAbilities = formatAbilities(champion.abilities);
      embed.addFields(formattedAbilities);

      return { embeds: [embed] };
    }
    return { content: "Invalid subcommand.", ephemeral: true };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: `command:champion:${subcommand}`,
      userId: userId,
    });
    return { content: userMessage, ephemeral: true };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("champion")
    .setDescription("Get information about a specific champion.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("info")
        .setDescription("Display a champion's core details and full abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("attacks")
        .setDescription("Display a champion's attack types and properties.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("abilities")
        .setDescription("List all of a champion's abilities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("immunities")
        .setDescription("List all of a champion's immunities.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The name of the champion.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const champions = await prisma.champion.findMany({
      where: {
        name: {
          contains: focusedValue,
          mode: "insensitive",
        },
      },
      take: 25,
    });
    await interaction.respond(
      champions.map((champion: Champion) => ({
        name: champion.name,
        value: champion.name,
      }))
    );
  },
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const subcommand = interaction.options.getSubcommand();
    const championName = interaction.options.getString("champion");

    if (!championName) {
      await interaction.editReply({
        content: "You must provide a champion name.",
      });
      return;
    }

    try {
      const result = await core({
        subcommand,
        championName,
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
        location: "command:champion",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

export default command;
