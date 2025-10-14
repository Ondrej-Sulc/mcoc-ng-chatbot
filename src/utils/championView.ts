import { ChampionClass, Hit } from "@prisma/client";
import {
  AttackWithHits,
  ChampionAbilityLinkWithAbility,
  ChampionWithAllRelations,
} from "../services/championService";
import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from "discord.js";
import { CommandResult } from "../types/command";

export const CLASS_COLOR: Record<ChampionClass, number> = {
  MYSTIC: 0xc026d3, // vivid magenta-purple
  MUTANT: 0xffc300, // rich golden yellow (matches Option 3 gradient)
  SKILL: 0xe63946, // crimson red
  SCIENCE: 0x2ecc71, // fresh green
  COSMIC: 0x2dd4d4, // bright cyan
  TECH: 0x4a6cf7, // vivid blue
  SUPERIOR: 0x20c997, // teal-green
};

// Define interfaces for the expected structure of the 'fullAbilities' JSON field.
export interface SignatureAbility {
  name: string; // Title
  description: string; // Description
}
export interface AbilityBlock {
  title: string;
  description: string;
}

export interface FullAbilities {
  signature?: SignatureAbility;
  abilities_breakdown?: AbilityBlock[];
}

export function formatAttacks(attacks: AttackWithHits[]): string {
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
        group[0].hits.map((h: Hit) => h.properties).sort()
      );
      const allSame = group.every(
        (attack) =>
          JSON.stringify(attack.hits.map((h: Hit) => h.properties).sort()) ===
          firstAttackHits
      );

      if (allSame) {
        const attack = group[0];
        const hitCounts = attack.hits.reduce(
          (acc: Record<string, number>, hit: Hit) => {
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
            (acc: Record<string, number>, hit: Hit) => {
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
        (acc: Record<string, number>, hit: Hit) => {
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

export function formatLinkedAbilitySection(
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
      if (
        !entry.sources.some((s: string) => s.toLowerCase() === source.toLowerCase())
      ) {
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

    if (item.sources.length === 0) {
      lines.push(base);
    } else if (item.sources.length === 1) {
      lines.push(`${base} — ${item.sources[0]}`);
    } else {
      lines.push(base);
      // Sort sources for consistent ordering
      item.sources.sort((a: string, b: string) => a.localeCompare(b));
      for (const source of item.sources) {
        lines.push(`  • ${source}`);
      }
    }
  }

  return lines.join("\n");
}

export function formatAbilities(
  abilities: ChampionAbilityLinkWithAbility[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(abilities, resolveEmoji, "Abilities");
}

export function formatImmunities(
  immunities: ChampionAbilityLinkWithAbility[],
  resolveEmoji: (text: string) => string
): string {
  return formatLinkedAbilitySection(immunities, resolveEmoji, "Immunities");
}

export function handleInfo(champion: ChampionWithAllRelations): CommandResult {
  const fullAbilities = champion.fullAbilities as FullAbilities;

  if (
    !fullAbilities ||
    (!fullAbilities.signature && !fullAbilities.abilities_breakdown)
  ) {
    return {
      content: `Detailed abilities are not available for ${champion.name}.`,
      flags: MessageFlags.Ephemeral,
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

export function handleAttacks(
  champion: ChampionWithAllRelations
): CommandResult {
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

export function handleAbilities(
  champion: ChampionWithAllRelations,
  subcommand: "abilities" | "immunities",
  resolveEmoji: (text: string) => string
): CommandResult {
  const container = new ContainerBuilder().setAccentColor(
    CLASS_COLOR[champion.class]
  );
  const relevantAbilities = champion.abilities.filter(
    (a: ChampionAbilityLinkWithAbility) => a.type === (subcommand === "abilities" ? "ABILITY" : "IMMUNITY")
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
