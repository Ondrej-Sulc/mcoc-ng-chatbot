import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  AttachmentBuilder,
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
import { createEmojiResolver } from "../utils/emojiResolver";
import { createChampionThumbnail } from "../utils/thumbnailService";

const prisma = new PrismaClient();

const CLASS_COLOR: Record<ChampionClass, number> = {
  MYSTIC: 0xc026d3,   // vivid magenta-purple
  MUTANT: 0xffc300,   // rich golden yellow (matches Option 3 gradient)
  SKILL: 0xe63946,    // crimson red
  SCIENCE: 0x2ecc71,  // fresh green
  COSMIC: 0x2dd4d4,   // bright cyan
  TECH: 0x4a6cf7,     // vivid blue
  SUPERIOR: 0x20c997, // teal-green
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

function formatAttacks(attacks: AttackWithHits[]): string {
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

function formatLinkedAbilitySection(
  links: ChampionAbilityLinkWithAbility[],
  resolveEmoji: (text: string) => string,
  sectionTitle: string
): string {
  if (!links || links.length === 0) {
    return `No ${sectionTitle.toLowerCase()} found.`;
  }

  // Group by ability name; collect distinct sources per ability
  const byName = new Map<
    string,
    {
      name: string;
      emoji?: string | null;
      sources: string[];
    }
  >();

  for (const link of links) {
    const name = link.ability.name;
    const key = name.toLowerCase();
    const source = (link.source || "").trim();
    if (!byName.has(key)) {
      byName.set(key, {
        name,
        emoji: link.ability.emoji || undefined,
        sources: [],
      });
    }
    if (source) {
      const entry = byName.get(key)!;
      if (!entry.sources.some((s) => s.toLowerCase() === source.toLowerCase())) {
        entry.sources.push(source);
      }
    }
  }

  const items = Array.from(byName.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const lines: string[] = [];

  for (const item of items) {
    const emoji = item.emoji ? resolveEmoji(item.emoji) : "";
    const base = `${emoji ? `${emoji} ` : ""}**${item.name}**`;
    if (item.sources.length > 0) {
      lines.push(`${base} — ${item.sources.join(" • ")}`);
    } else {
      lines.push(base);
    }
  }

  return lines.join("\n");
}

function formatAbilities(
  abilities: ChampionAbilityLinkWithAbility[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(abilities, resolveEmoji, "Abilities");
}

function formatImmunities(
  immunities: ChampionAbilityLinkWithAbility[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(immunities, resolveEmoji, "Immunities");
}

type ChampionWithAllRelations = Champion & {
  attacks: AttackWithHits[];
  abilities: ChampionAbilityLinkWithAbility[];
};

async function getChampionData(
  championName: string
): Promise<ChampionWithAllRelations | null> {
  return prisma.champion.findFirst({
    where: { name: { equals: championName, mode: "insensitive" } },
    include: {
      attacks: { include: { hits: true } },
      abilities: { include: { ability: true } },
    },
  }) as Promise<ChampionWithAllRelations | null>;
}

function handleInfo(champion: ChampionWithAllRelations): CommandResult {
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
  let currentContainer = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  let currentLength = 0;
  const MAX_CONTAINER_LENGTH = 4000;
  const MAX_TEXT_DISPLAY_LENGTH = 2000;

  const addTextToContainer = (text: string) => {
    if (currentLength + text.length > MAX_CONTAINER_LENGTH) {
      containers.push(currentContainer);
      currentContainer = new ContainerBuilder().setAccentColor(
        CLASS_COLOR[champion.class]
      );
      currentLength = 0;
    }
    currentContainer.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(text)
    );
    currentLength += text.length;
  };

  const addBlock = (title: string, description: string) => {
    addTextToContainer(`**${title}**`);
    const descParts =
      description.match(new RegExp(`.{1,${MAX_TEXT_DISPLAY_LENGTH}}`, "gs")) ||
      [];
    for (const part of descParts) {
      addTextToContainer(part);
    }
  };

  addTextToContainer(`**${champion.name}**\n*${champion.class}*`);

  if (fullAbilities.signature) {
    const sig = fullAbilities.signature;
    addBlock(
      sig.name || "Signature Ability",
      sig.description || "No description."
    );
  }

  if (fullAbilities.abilities_breakdown) {
    for (const abilityBlock of fullAbilities.abilities_breakdown) {
      addBlock(
        abilityBlock.title || "Ability",
        abilityBlock.description || "No description."
      );
    }
  }

  if (currentContainer.components.length > 0) {
    containers.push(currentContainer);
  }

  return {
    components: containers,
    isComponentsV2: true,
  };
}

function handleAttacks(champion: ChampionWithAllRelations): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const formattedAttacks = formatAttacks(champion.attacks);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedAttacks)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}

function handleAbilities(
  champion: ChampionWithAllRelations,
  subcommand: "abilities" | "immunities",
  resolveEmoji: (text: string) => string
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const relevantAbilities = champion.abilities.filter(
    (a) => a.type === (subcommand === "abilities" ? "ABILITY" : "IMMUNITY")
  );

  const formattedAbilities =
    subcommand === "abilities"
      ? formatAbilities(relevantAbilities, resolveEmoji)
      : formatImmunities(relevantAbilities, resolveEmoji);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedAbilities)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}

export async function core(
  params: ChampionCoreParams,
  resolveEmoji: (text: string) => string
): Promise<CommandResult> {
  const { subcommand, championName, userId } = params;

  try {
    const champion = await getChampionData(championName);

    if (!champion) {
      return {
        content: `Champion "${championName}" not found.`,
        ephemeral: true,
      };
    }

    const thumbnailBuffer = await createChampionThumbnail({
      championName: champion.name.toUpperCase(),
      championClass: champion.class,
      secondaryImageUrl: getChampionImageUrl(
        champion.images,
        "full",
        "secondary"
      ),
      primaryImageUrl: getChampionImageUrl(champion.images, "full", "primary"),
      subcommand: subcommand,
      width: 800,
      height: 300,
    });

    // Bust any client-side caching by appending a timestamp to the filename
    const cacheBust = Date.now();
    const thumbnailFileName = `${champion.name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()}_thumbnail_${cacheBust}.png`;
    const attachment = new AttachmentBuilder(thumbnailBuffer, {
      name: thumbnailFileName,
      description: `Thumbnail for ${champion.name}`,
    });

    const thumbnailmediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setDescription(`**${champion.name}**`)
        .setURL(`attachment://${thumbnailFileName}`)
    );

    let result: CommandResult;

    switch (subcommand) {
      case "info":
        result = handleInfo(champion);
        break;
      case "attacks":
        result = handleAttacks(champion);
        break;
      case "abilities":
      case "immunities":
        result = handleAbilities(
          champion,
          subcommand as "abilities" | "immunities",
          resolveEmoji
        );
        break;
      default:
        return { content: "Invalid subcommand.", ephemeral: true };
    }

    if (result.components && result.components.length > 0) {
      result.components[0].components.unshift(thumbnailmediaGallery);
    }

    result.files = [attachment];
    return result;
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: `command:champion:${subcommand}`,
      userId: userId,
    });
    return { content: userMessage, ephemeral: false };
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
    await interaction.deferReply({ flags: [] });

    const subcommand = interaction.options.getSubcommand();
    const championName = interaction.options.getString("champion");

    if (!championName) {
      await interaction.editReply({
        content: "You must provide a champion name.",
      });
      return;
    }

    try {
      const resolveEmoji = createEmojiResolver(interaction.client, interaction.guild);
      const result = await core(
        {
          subcommand,
          championName,
          userId: interaction.user.id,
        },
        resolveEmoji
      );

      if (result.components && Array.isArray(result.components)) {
        const firstContainer = result.components.shift();
        if (firstContainer) {
          await interaction.editReply({
            content: result.content || "",
            components: [firstContainer],
            flags: [MessageFlags.IsComponentsV2],
            files: result.files || [],
          });
        }

        for (const container of result.components) {
          await interaction.followUp({
            components: [container],
            ephemeral: false,
            flags: [MessageFlags.IsComponentsV2],
            files: result.files || [],
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