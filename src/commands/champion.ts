import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
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

const CLASS_COLOR: Record<ChampionClass, number> = {
  MYSTIC: 0x8A2BE2,
  MUTANT: 0xFFD700,
  SKILL: 0xFF0000,
  SCIENCE: 0x00FF00,
  COSMIC: 0x00FFFF,
  TECH: 0x0000FF,
  SUPERIOR: 0xFFFFFF,
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

interface ChampionImages {
  p_32: string;
  p_64: string;
  s_32: string;
  s_64: string;
  p_128: string;
  s_128: string;
  full_primary: string;
  full_secondary: string;
}

function getChampionImageUrl(
  images: any,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" = "primary"
): string {
  const parsedImages = images as ChampionImages;

  if (size === "full") {
    return type === "primary"
      ? parsedImages.full_primary
      : parsedImages.full_secondary;
  }

  const key = `${type.charAt(0)}_${size}` as keyof ChampionImages;
  return parsedImages[key];
}


function formatAttacks(
  attacks: AttackWithHits[]
): string {
  if (!attacks || attacks.length === 0) {
    return "Sorry, Attack type values are missing for this champion.";
  }

  let attackStrings = "";

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
        attackStrings += `**${key.toUpperCase()}${ 
            group.length > 1 ? ` 1-${group.length}` : "" 
          } Attack**: ${types}\n`;
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
          attackStrings += `**${attack.type} Attack**: ${types}\n`;
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
      attackStrings += `**${attack.type} Attack**: ${types}\n`;
    }
  }

  return attackStrings;
}

function formatAbilities(
  abilities: ChampionAbilityLinkWithAbility[]
): string {
  if (!abilities || abilities.length === 0) {
    return "This champion does not have any abilities.";
  }

  return abilities
    .map((ability) => {
      const value = ability.source ? `• ${ability.source}` : "";
      return `${ability.ability.emoji ? `${ability.ability.emoji} ` : ""}${ 
        ability.ability.name
      } ${value}`;
    })
    .join("\n");
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
          content: `Champion \"${championName}\" not found.`, 
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

      const containers: ContainerBuilder[] = [];
      let currentContainer = new ContainerBuilder().setAccentColor(CLASS_COLOR[champion.class]);
      let currentLength = 0;
      const MAX_CONTAINER_LENGTH = 4000;
      const MAX_TEXT_DISPLAY_LENGTH = 2000;

      const addTextToContainer = (text: string) => {
        // This function assumes text is already <= MAX_TEXT_DISPLAY_LENGTH
        if (currentLength + text.length > MAX_CONTAINER_LENGTH) {
            containers.push(currentContainer);
            currentContainer = new ContainerBuilder().setAccentColor(CLASS_COLOR[champion.class]);
            currentLength = 0;
        }
        currentContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
        currentLength += text.length;
      };

      const addBlock = (title: string, description: string) => {
        addTextToContainer(`**${title}**`);
        const descParts = description.match(new RegExp(`.{1,${MAX_TEXT_DISPLAY_LENGTH}}`, "gs")) || [];
        for (const part of descParts) {
            addTextToContainer(part);
        }
      };

      addTextToContainer(`**${champion.name}**\n*${champion.class}*`);

      if (fullAbilities.signature) {
        const sig = fullAbilities.signature;
        addBlock(sig.name || "Signature Ability", sig.description || "No description.");
      }

      if (fullAbilities.abilities_breakdown) {
        for (const abilityBlock of fullAbilities.abilities_breakdown) {
          addBlock(abilityBlock.title || "Ability", abilityBlock.description || "No description.");
        }
      }

      if (currentContainer.components.length > 0) {
        containers.push(currentContainer);
      }

      return {
        components: containers,
        isComponentsV2: true,
      };
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
          content: `Champion \"${championName}\" not found.`, 
          ephemeral: true,
        };
      }

      const container = new ContainerBuilder().setAccentColor(CLASS_COLOR[champion.class]);
      const headerText = new TextDisplayBuilder().setContent(`**${champion.name} - Attacks**`);
      container.addTextDisplayComponents(headerText);

      const formattedAttacks = formatAttacks(champion.attacks);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedAttacks));

      return {
          components: [container],
          isComponentsV2: true,
      };
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
          content: `Champion \"${championName}\" not found.`, 
          ephemeral: true,
        };
      }

      const container = new ContainerBuilder().setAccentColor(CLASS_COLOR[champion.class]);
      const banner = new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setDescription(`**${champion.name}** - Primary Image`)
            .setURL(getChampionImageUrl(champion.images, "128", "primary")),
          new MediaGalleryItemBuilder()
            .setDescription(`**${champion.name}** - Secondary Image`)
            .setURL(getChampionImageUrl(champion.images, "128", "secondary"))
        );
      container.addMediaGalleryComponents(banner);
      const headerSection = new TextDisplayBuilder().setContent(`**${champion.name} - ${ 
              subcommand.charAt(0).toUpperCase() + subcommand.slice(1)
            }**`);
      container.addTextDisplayComponents(headerSection);

      const formattedAbilities = formatAbilities(champion.abilities);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedAbilities))

      return {
          components: [container],
          isComponentsV2: true,
      };
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

      if (result.components && Array.isArray(result.components)) {
        const firstContainer = result.components.shift();
        if (firstContainer) {
            await interaction.editReply({
              content: result.content || "",
              components: [firstContainer],
              flags: [MessageFlags.IsComponentsV2],
            });
        }

        for (const container of result.components) {
            await interaction.followUp({
                components: [container],
                ephemeral: true,
                flags: [MessageFlags.IsComponentsV2],
            });
        }
      } else if (result.embeds) {
        await interaction.editReply({
          content: result.content || "",
          embeds: result.embeds,
        });
      } else if (result.content) {
        await interaction.editReply({ content: result.content });
      }
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: `command:champion:${subcommand}`,
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

export default command;
