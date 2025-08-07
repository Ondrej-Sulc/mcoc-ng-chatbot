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
import sharp from 'sharp';
import fetch from 'node-fetch';

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

interface ChampionThumbnailOptions {
  championName: string;
  championClass: string;
  imageUrl: string;
  width?: number;
  height?: number;
}

// Class color mappings for MCOC
const CLASS_COLORS = {
  COSMIC: { primary: '#00CED1', secondary: '#008B8B' }, // Cyan gradient
  TECH: { primary: '#224bbdff', secondary: '#073374ff' },    // Cyan gradient
  MUTANT: { primary: '#FFD700', secondary: '#FFA500' },  // Gold gradient
  SKILL: { primary: '#DC143C', secondary: '#8B0000' },   // Red gradient
  SCIENCE: { primary: '#32CD32', secondary: '#228B22' }, // Green gradient
  MYSTIC: { primary: '#a51776ff', secondary: '#820286ff' }   // Pink gradient
};

export async function createChampionThumbnail(
  options: ChampionThumbnailOptions
): Promise<Buffer> {
  const { championName, championClass, imageUrl, width = 800, height = 400 } = options;
  
  try {
    // Download champion image
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const imageBuffer = await response.buffer();
    
    // Get class colors
    const colors = CLASS_COLORS[championClass as keyof typeof CLASS_COLORS] 
      || CLASS_COLORS.SKILL; // fallback
    
    // Create gradient background SVG
    const gradientSvg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="classGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:0.9" />
            <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
          </linearGradient>
          <filter id="noise">
            <feTurbulence baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
            <feComposite operator="over" in2="SourceGraphic"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#classGradient)" filter="url(#noise)"/>
      </svg>
    `;
    
    // Process champion image - resize and create circular mask
    const processedChampion = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'cover' })
      .png()
      .toBuffer();
    
    // Create circular mask
    const circleMask = Buffer.from(
      `<svg width="300" height="300">
        <circle cx="150" cy="150" r="140" fill="white"/>
      </svg>`
    );
    
    const maskedChampion = await sharp(processedChampion)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toBuffer();
    
    // Handle champion name text sizing
    const fontSize = getOptimalFontSize(championName, width);
    const textSvg = createTextSvg(championName, fontSize, width, height);
    
    // Composite everything together
    const finalImage = await sharp(Buffer.from(gradientSvg))
      .composite([
        {
          input: maskedChampion,
          top: Math.round((height - 300) / 2),
          left: Math.round((width - 300) / 2),
        },
        {
          input: Buffer.from(textSvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
    
    return finalImage;
    
  } catch (error) {
    console.error('Error creating champion thumbnail:', error);
    throw error;
  }
}

function getOptimalFontSize(text: string, imageWidth: number): number {
  const baseSize = 48;
  const minSize = 24; // Ensure a minimum readable font size
  const maxWidth = imageWidth * 0.9; // Allow 90% of image width for text
  
  // Approximate average character width for rough calculation
  const avgCharWidthRatio = 0.6; 

  if (text.length <= 8) return baseSize;
  
  // For longer names, calculate based on approximate pixel width
  // Start with baseSize assumption for initial calculation
  let estimatedTextWidth = text.length * baseSize * avgCharWidthRatio; 

  if (estimatedTextWidth > maxWidth) {
    // Calculate required font size to fit within maxWidth
    const calculatedFontSize = (maxWidth / text.length) / avgCharWidthRatio;
    return Math.max(minSize, calculatedFontSize);
  }
  
  // For names that don't exceed maxWidth at baseSize, but are longer than short ones
  return Math.max(minSize, baseSize - (text.length - 8) * 1.5);
}

function createTextSvg(text: string, fontSize: number, width: number, height: number): string {
  // Position text at bottom with some padding
  const yPosition = height - 60;
  
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="textShadow">
          <feDropShadow dx="2" dy="2" stdDeviation="3" flood-opacity="0.8"/>
        </filter>
      </defs>
      <text 
        x="50%" 
        y="${yPosition}" 
        font-family="Noto Color Emoji, Arial, sans-serif"
        font-size="${fontSize}" 
        font-weight="bold" 
        fill="white" 
        text-anchor="middle" 
        filter="url(#textShadow)"
      >
        ${text}
      </text>
    </svg>
  `;
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

      const thumbnailBuffer = await createChampionThumbnail({
        championName: champion.name,
        championClass: champion.class,
        imageUrl: getChampionImageUrl(champion.images, "full", "primary"),
        // You can specify width/height here if you want to override defaults
        // width: 800,
        // height: 400
      });

      const thumbnailFileName = `${champion.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_thumbnail.png`;
      const attachment = new AttachmentBuilder(thumbnailBuffer, {
        name: thumbnailFileName,
        description: `Thumbnail for ${champion.name}`,
      });

      const thumbnailmediaGallery = new MediaGalleryBuilder().addItems(
      new MediaGalleryItemBuilder()
        .setDescription(`**${champion.name}**`) // Custom description for your new thumbnail
        // Reference the attachment using the 'attachment://' protocol and its filename
        .setURL(`attachment://${thumbnailFileName}`)
    );
      // const banner = new MediaGalleryBuilder()
      //   .addItems(
      //     new MediaGalleryItemBuilder()
      //       .setDescription(`**${champion.name}** - Primary Image`)
      //       .setURL(getChampionImageUrl(champion.images, "128", "primary")),
      //     new MediaGalleryItemBuilder()
      //       .setDescription(`**${champion.name}** - Secondary Image`)
      //       .setURL(getChampionImageUrl(champion.images, "128", "secondary"))
      //   );
      container.addMediaGalleryComponents(thumbnailmediaGallery);
      const headerSection = new TextDisplayBuilder().setContent(`**${champion.name} - ${ 
              subcommand.charAt(0).toUpperCase() + subcommand.slice(1)
            }**`);
      container.addTextDisplayComponents(headerSection);

      const formattedAbilities = formatAbilities(champion.abilities);
      container.addTextDisplayComponents(new TextDisplayBuilder().setContent(formattedAbilities))

      return {
          components: [container],
          isComponentsV2: true,
          files: [attachment],
      };
    }
    return { content: "Invalid subcommand.", ephemeral: true };
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
