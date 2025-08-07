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
import sharp from "sharp";
import fetch from "node-fetch";

const prisma = new PrismaClient();

const CLASS_COLOR: Record<ChampionClass, number> = {
  MYSTIC: 0x8a2be2,
  MUTANT: 0xffd700,
  SKILL: 0xff0000,
  SCIENCE: 0x00ff00,
  COSMIC: 0x00ffff,
  TECH: 0x0000ff,
  SUPERIOR: 0xffffff,
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
  championClass: ChampionClass;
  secondaryImageUrl: string; // full-body
  primaryImageUrl?: string; // circular avatar
  subcommand: string; // e.g., "abilities"
  tagline?: string; // optional, small text line
  iconUrls?: string[]; // optional icons row
  width?: number;
  height?: number;
  fetchTimeoutMs?: number;
}

// Class color mappings for MCOC
const CLASS_COLORS = {
  COSMIC: { primary: "#00CED1", secondary: "#008B8B" },
  TECH: { primary: "#224bbdff", secondary: "#073374ff" },
  MUTANT: { primary: "#FFD700", secondary: "#FFA500" },
  SKILL: { primary: "#DC143C", secondary: "#8B0000" },
  SCIENCE: { primary: "#32CD32", secondary: "#228B22" },
  MYSTIC: { primary: "#a51776ff", secondary: "#820286ff" },
} as const;

const DEFAULTS = {
  width: 800,
  height: 300,
  padding: 28,
  panelWidthRatio: 0.625,
  panelRadius: 15,
  avatarRing: 8,
  avatarGlow: 0,
  iconSize: 32,
  iconGap: 8,
  fetchTimeoutMs: 8000,
};

// ---- utils ----

const escapeXml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

async function fetchArrayBufferWithTimeout(
  url: string,
  timeoutMs: number
): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "mcoc-bot-thumbnail/1.0" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
  }
}

// ---- background (consistent, full-canvas) ----

function createBackgroundSvg(
  width: number,
  height: number,
  primary: string,
  secondary: string
): Buffer {
  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${secondary}" />
        </linearGradient>
        <linearGradient id="sheen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <radialGradient id="vign" cx="50%" cy="50%" r="75%">
          <stop offset="70%" stop-color="#000000" stop-opacity="0" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.18" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect width="100%" height="100%" fill="url(#sheen)"/>
      <rect width="100%" height="100%" fill="url(#vign)"/>
    </svg>
  `;
  return Buffer.from(svg);
}

function createGlassPanelSvg(
  width: number,
  height: number,
  radius: number
): Buffer {
  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="panelG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#000000" stop-opacity="0.32" />
          <stop offset="100%" stop-color="#000000" stop-opacity="0.22" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}"
        rx="${radius}" ry="${radius}"
        fill="url(#panelG)"
        stroke="#ffffff" stroke-opacity="0.18" stroke-width="1"/>
    </svg>
  `;
  return Buffer.from(svg);
}

// ---- text + pills (title top-left, pills bottom-left) ----

function createTextAndPillsSvg(opts: {
  title: string;
  classLabel: string;
  subcommand: string;
  width: number;
  height: number;
  padding: number;
  titleRightLimit: number; // panelWidth - padding
  pillsLeft: number; // next to avatar
  pillsBottom: number; // distance from bottom
}): Buffer {
  const {
    title,
    classLabel,
    subcommand,
    width,
    height,
    padding,
    titleRightLimit,
    pillsLeft,
    pillsBottom,
  } = opts;

  const escapedTitle = escapeXml(title);
  const escapedClass = escapeXml(classLabel);
  const escapedCmd = escapeXml(subcommand.toUpperCase());

  // Big title, sized to fit until panel edge
  const maxTitleWidth = titleRightLimit - padding;
  const baseSize = 70;
  const minSize = 28;
  const estimate = (t: string, s: number) => t.length * (s * 0.56);
  let fontSize = baseSize;
  if (estimate(title, baseSize) > maxTitleWidth) {
    fontSize = clamp(
      Math.floor(maxTitleWidth / title.length / 0.56),
      minSize,
      baseSize
    );
  }

  // Pills
  const chipFont = 18;
  const chipPadX = 12;
  const chipPadY = 6;
  const classW = escapedClass.length * (chipFont * 0.6) + chipPadX * 2 + 10;
  const cmdW = escapedCmd.length * (chipFont * 0.62) + chipPadX * 2 + 10;

  const chipH = chipFont + chipPadY * 2;
  const yTitle = padding + fontSize; // sits above avatar

  const svg = `
    <svg width="${width}" height="${height}"
      viewBox="0 0 ${width} ${height}"
      xmlns="http://www.w3.org/2000/svg">
      <style>
        .title {
          font-family: "DejaVu Sans", system-ui, sans-serif;
          font-weight: 900;
          font-size: ${fontSize}px;
          fill: #ffffff;
          stroke: #000000;
          stroke-opacity: 0.85;
          stroke-width: 2px;
          paint-order: stroke fill;
          letter-spacing: 0.4px;
        }
        .chip {
          font-family: "DejaVu Sans", system-ui, sans-serif;
          font-weight: 800;
          font-size: ${chipFont}px;
          fill: #ffffff;
        }
        .class {
          font-family: "DejaVu Sans", system-ui, sans-serif;
          font-weight: 700;
          font-size: ${chipFont}px;
          fill: #111111;
        }
      </style>

      <text x="${padding}" y="${yTitle}" class="title">${escapedTitle}</text>

      <!-- Pills row (bottom-left, next to avatar) -->
      <g transform="translate(${pillsLeft}, ${height - pillsBottom - chipH})">
        <!-- class pill -->
        <rect x="0" y="0" rx="12" ry="12"
          width="${classW}" height="${chipH}"
          fill="#ffffff" fill-opacity="0.86"
          stroke="#000000" stroke-opacity="0.2" stroke-width="1"/>
        <text class="class"
          x="${chipPadX - 2}" y="${chipFont + chipPadY - 3}">
          ${escapedClass}
        </text>

        <!-- subcommand chip -->
        <g transform="translate(${classW + 12}, 0)">
          <rect x="0" y="0" rx="12" ry="12"
            width="${cmdW}" height="${chipH}"
            fill="#ffffff" fill-opacity="0.14"
            stroke="#ffffff" stroke-opacity="0.24" stroke-width="1"/>
          <text class="chip"
            x="${chipPadX + 4}" y="${chipFont + chipPadY - 4}">
            ${escapedCmd}
          </text>
        </g>
      </g>
    </svg>
  `;
  return Buffer.from(svg);
}

// ---- avatar ----

async function createCircularAvatar(opts: {
  image: Buffer;
  diameter: number;
  ringWidth: number;
  ringStart: string;
  ringEnd: string;
  glowOpacity: number;
}): Promise<Buffer> {
  const { image, diameter, ringWidth, ringStart, ringEnd, glowOpacity } = opts;
  const r = diameter / 2;
  const innerR = r - ringWidth / 2;

  const avatar = await sharp(image)
    .resize(diameter, diameter, { fit: "cover" })
    .toBuffer();

  const mask = Buffer.from(`
    <svg width="${diameter}" height="${diameter}"
      xmlns="http://www.w3.org/2000/svg">
      <circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/>
    </svg>
  `);

  const ring = Buffer.from(`
    <svg width="${diameter}" height="${diameter}"
      xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${ringStart}"/>
          <stop offset="100%" stop-color="${ringEnd}"/>
        </linearGradient>
      </defs>
      <circle cx="${r}" cy="${r}" r="${r}"
        fill="#ffffff" fill-opacity="${glowOpacity}"/>
      <circle cx="${r}" cy="${r}" r="${innerR}"
        fill="none" stroke="url(#ring)" stroke-width="${ringWidth}"/>
    </svg>
  `);

  const masked = await sharp(avatar)
    .composite([{ input: mask, blend: "dest-in" }])
    .toBuffer();

  return sharp({
    create: {
      width: diameter,
      height: diameter,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: masked }, { input: ring }])
    .png()
    .toBuffer();
}

// ---- icons ----

async function loadAndResizeIcon(
  url: string,
  size: number,
  timeoutMs: number
): Promise<Buffer> {
  const ab = await fetchArrayBufferWithTimeout(url, timeoutMs);
  return sharp(Buffer.from(ab))
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
}

// ---- main ----

export async function createChampionThumbnail(
  options: ChampionThumbnailOptions
): Promise<Buffer> {
  const {
    championName,
    championClass,
    secondaryImageUrl,
    primaryImageUrl,
    subcommand,
    iconUrls,
    width = DEFAULTS.width,
    height = DEFAULTS.height,
    fetchTimeoutMs = DEFAULTS.fetchTimeoutMs,
  } = options;

  const colors =
    CLASS_COLORS[championClass as keyof typeof CLASS_COLORS] ??
    CLASS_COLORS.SKILL;

  // Fetch images
  const [secondaryAB, primaryAB] = await Promise.all([
    fetchArrayBufferWithTimeout(secondaryImageUrl, fetchTimeoutMs),
    primaryImageUrl
      ? fetchArrayBufferWithTimeout(primaryImageUrl, fetchTimeoutMs)
      : Promise.resolve(undefined),
  ]);

  const panelWidth = Math.round(width * DEFAULTS.panelWidthRatio);
  const bg = createBackgroundSvg(
    width,
    height,
    colors.primary,
    colors.secondary
  );

  // Layout metrics
  // Smaller avatar, lower to make room for big title
  const avatarDiameter = primaryAB
    ? Math.min(Math.floor(height * 0.44), Math.floor(panelWidth * 0.34))
    : 0;

  const avatarLeft = DEFAULTS.padding;
  const avatarTop =
    Math.floor(height) - Math.floor(avatarDiameter) - DEFAULTS.padding;

  // Pills bottom-left, starting to the right of avatar
  const pillsLeft =
    DEFAULTS.padding + (avatarDiameter ? avatarDiameter + 6 : 0);
  const pillsBottom = DEFAULTS.padding;

  // Title can span up to end of panel
  const titleRightLimit = panelWidth - DEFAULTS.padding;

  // Build overlays in order
  const overlays: sharp.OverlayOptions[] = [];

  // Left glass panel for readability (covers full height)
  overlays.push({
    input: createGlassPanelSvg(panelWidth, height, DEFAULTS.panelRadius),
    left: 0,
    top: 0,
  });

  // ensure champ only fills the right area (avoid overflowing left panel)
  const overlap = 0; // small intentional overlap onto the panel
  const rightAreaW = Math.round(width - panelWidth + overlap);
  const characterPng = await sharp(Buffer.from(secondaryAB))
    .resize({
      width: rightAreaW,
      height,
      fit: "cover",
      position: "right",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  overlays.push({
    input: characterPng,
    left: width - rightAreaW,
    top: 0,
  });

  // Title and pills
  overlays.push({
    input: createTextAndPillsSvg({
      title: championName,
      classLabel: championClass,
      subcommand,
      width: panelWidth,
      height,
      padding: DEFAULTS.padding,
      titleRightLimit,
      pillsLeft,
      pillsBottom,
    }),
    left: 0,
    top: 0,
  });

  // Avatar
  if (primaryAB) {
    const avatar = await createCircularAvatar({
      image: Buffer.from(primaryAB),
      diameter: avatarDiameter,
      ringWidth: DEFAULTS.avatarRing,
      ringStart: colors.primary,
      ringEnd: colors.secondary,
      glowOpacity: DEFAULTS.avatarGlow,
    });
    overlays.push({
      input: avatar,
      left: avatarLeft,
      top: avatarTop,
    });
  }

  // Optional icons row (to the right of avatar, above pills if you want)
  if (iconUrls?.length) {
    const size = DEFAULTS.iconSize;
    const gap = DEFAULTS.iconGap;
    const available = panelWidth - pillsLeft - DEFAULTS.padding + 4; // nudge into corner
    const maxIconsFit = Math.floor(available / (size + gap));
    const chosen = iconUrls.slice(0, maxIconsFit);
    const iconBuffers = await Promise.all(
      chosen.map((u) => loadAndResizeIcon(u, size, fetchTimeoutMs))
    );

    const top = height - pillsBottom - size - 6; // sit just above/beside the pills

    iconBuffers.forEach((buf, i) => {
      overlays.push({
        input: buf,
        left: pillsLeft + i * (size + gap),
        top,
      });
    });
  }

  // Final compose on a solid, consistent background (no spotlight)
  const finalImage = await sharp(bg).composite(overlays).png().toBuffer();
  return finalImage;
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

function formatAbilities(abilities: ChampionAbilityLinkWithAbility[]): string {
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
  subcommand: "abilities" | "immunities"
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const relevantAbilities = champion.abilities.filter(
    (a) => a.type === (subcommand === "abilities" ? "ABILITY" : "IMMUNITY")
  );

  const formattedAbilities = formatAbilities(relevantAbilities);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(formattedAbilities)
  );

  return {
    components: [container],
    isComponentsV2: true,
  };
}

export async function core(params: ChampionCoreParams): Promise<CommandResult> {
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
      championName: champion.name,
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

    const thumbnailFileName = `${champion.name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase()}_thumbnail.png`;
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
          subcommand as "abilities" | "immunities"
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
