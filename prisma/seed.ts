import {
  PrismaClient,
  ChampionClass,
  AttackType,
  AbilityLinkType,
  Prisma,
} from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const prisma = new PrismaClient();

// Resolve a base directory compatible with both CJS (__dirname) and ESM (import.meta.url)
const BASE_DIR = (() => {
  try {
    // @ts-ignore - __dirname exists in CJS
    if (typeof __dirname !== "undefined") return __dirname as string;
  } catch {}
  try {
    // Works in ESM (tsx) environments
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // Fallback to process.cwd() if both mechanisms are unavailable
    return process.cwd();
  }
})();

// --- Raw JSON typings ---
interface RawChampionData {
  "Champion Name": string;
  "Short Name": string;
  Class: string;
  Tags: { [key: string]: string[] };
  Immunities: Record<string, string[]>;
  Abilities: Record<string, string[]>;
  "Release Date": string;
  Obtainable: string[];
  Prestige: object;
  Attacks: Record<string, string[][]>;
  primary_image_full: string;
  secondary_image_full: string;
  primary_image_128: string;
  secondary_image_128: string;
  primary_image_64: string;
  secondary_image_64: string;
  primary_image_32: string;
  secondary_image_32: string;
  "Discord Emoji": string;
  full_abilities: object;
}
interface RawGlossaryData {
  categories: Record<string, { name: string; description: string }>;
  effects: {
    id: string;
    name: string;
    description: string;
    emoji: string;
    category_ids: string[];
  }[];
}

async function main() {
  console.log("🚀 Starting seed…");

  // 1) Data seeding is now non-destructive and uses upserts.
  //    The old destructive 'deleteMany' calls have been removed.

  // 2) Load JSON
  const championsRaw: RawChampionData[] = JSON.parse(
    fs.readFileSync(
      path.join(BASE_DIR, "..", "legacy", "champions_data.json"),
      "utf-8"
    )
  );
  const glossaryRaw: RawGlossaryData = JSON.parse(
    fs.readFileSync(
      path.join(BASE_DIR, "..", "legacy", "glossary.json"),
      "utf-8"
    )
  );

  // 3) Seed categories & glossary effects → Ability & AbilityCategory
  console.log("🔧 Seeding Ability Categories & Abilities…");
  const abilityMap = await seedAbilitiesAndCategories(glossaryRaw);

  // 4) Seed Tags
  console.log("🏷️  Seeding Tags…");
  const tagMap = await seedTags(championsRaw);

  // 5) Seed Champions + Attacks + ChampionAbilityLink
  console.log("🏆 Seeding Champions…");
  await seedChampions(championsRaw, abilityMap, tagMap);

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed!");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/**
 * 3) Seed AbilityCategory and Ability tables.
 *    Handles duplicates in glossary data gracefully.
 */
async function seedAbilitiesAndCategories(
  glossary: RawGlossaryData
): Promise<Map<string, number>> {
  const abilityMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  console.log(
    `  - Processing ${Object.keys(glossary.categories).length} categories...`
  );
  // 1) Create/Update all categories first
  for (const [catKey, catVal] of Object.entries(glossary.categories)) {
    const cat = await prisma.abilityCategory.upsert({
      where: { name: catVal.name },
      update: {}, // Do nothing if exists
      create: {
        name: catVal.name,
        description: catVal.description,
      },
    });
    categoryMap.set(catKey, cat.id);
    // Debug log if needed: console.log(`    + Category: ${cat.name} (${cat.id})`);
  }

  console.log(`  - Processing ${glossary.effects.length} glossary effects...`);
  // 2) Process each glossary effect. Use a Map to ensure we only process each unique name once.
  const uniqueEffects = new Map<string, (typeof glossary.effects)[0]>();
  for (const effect of glossary.effects) {
    // Use the name as the unique key. If a name appears twice, the last one wins (or you could warn).
    // This prevents trying to create the same ability twice.
    uniqueEffects.set(effect.name, effect);
  }

  // 3) Now, iterate the deduplicated list of effects
  for (const effect of uniqueEffects.values()) {
    // Build the list of category IDs to connect to this ability
    const connectCategoryIds: number[] = [];
    for (const catId of effect.category_ids) {
      const mappedId = categoryMap.get(catId);
      if (mappedId !== undefined) {
        connectCategoryIds.push(mappedId);
      } else {
        console.warn(
          `  ⚠️  Unknown category id "${catId}" for effect "${effect.name}"`
        );
      }
    }

    // 4) Upsert the Ability itself
    // This handles the case where an ability might already exist from a previous iteration
    // or if it was created for a champion-specific ability earlier.
    let ability = await prisma.ability.upsert({
      where: { name: effect.name },
      update: {
        // If it exists, we might want to update description/emoji if they were missing.
        // But for seeding, often we just leave them if they exist.
        // Let's assume the first occurrence has the canonical data.
        // If you want to merge/update, you can add logic here.
        // For now, we'll just ensure it exists and connect categories if needed.
        // A more robust way is to check if fields are null and update them.
        // Let's do a conditional update:
        ...(effect.description && { description: effect.description }),
        ...(effect.emoji && { emoji: effect.emoji }),
        // Note: This simple upsert won't *add* categories if the ability already existed.
        // To fully merge categories, you'd need a more complex find -> update process.
        // For seeding, this is often sufficient.
      },
      create: {
        name: effect.name,
        description: effect.description || null,
        emoji: effect.emoji || null,
      },
    });

    // Store the ID in our map for linking later
    abilityMap.set(ability.name, ability.id);

    // 5) Connect the categories *after* creation/upserting
    // This part is tricky with `upsert`. We need to ensure categories are linked.
    // The simplest way is to always update the categories link after upserting.
    // We can use `set` on the relation to replace the current set of connected categories.
    // However, `upsert` doesn't give us an easy way to do this in one go if we want to merge.
    // Let's assume the glossary data is the source of truth for categories.
    if (connectCategoryIds.length > 0) {
      await prisma.ability.update({
        where: { id: ability.id },
        data: {
          categories: {
            // `set` replaces the existing connections with the new ones.
            // This means if an ability is in multiple categories in the glossary,
            // it will be connected to all of them.
            set: connectCategoryIds.map((id) => ({ id })),
          },
        },
      });
    }
    // Debug log if needed: console.log(`    + Ability: ${ability.name} (${ability.id})`);
  }

  console.log(
    `  - Found and processed ${uniqueEffects.size} unique abilities.`
  );
  return abilityMap;
}

/**
 * Normalize a list of source strings for ability/immunity links.
 * - Accepts unknown input (e.g. string, string[]) and coerces to an array of non-empty, trimmed strings
 * - If the result is empty, returns a single entry: null (meaning always active)
 */
function normalizeSources(input: unknown): Array<string | null> {
  const potentialSources = Array.isArray(input)
    ? input
    : typeof input === "string"
    ? [input]
    : [];

  const cleaned = potentialSources
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  return cleaned.length > 0 ? cleaned : [null];
}

/**
 * 4) Seed Tag table
 */
async function seedTags(
  champions: RawChampionData[]
): Promise<Map<string, number>> {
  const tagMap = new Map<string, number>();
  const collector = new Map<string, string>(); // name -> category

  // Collect all unique tags and their categories
  for (const champ of champions) {
    for (const [category, names] of Object.entries(champ.Tags)) {
      if (category === "All") continue;
      for (const name of names) {
        // If a tag appears in multiple champion categories, the last one wins.
        // This is usually fine for tags.
        collector.set(name, category);
      }
    }
  }

  console.log(`  - Creating ${collector.size} unique tags...`);
  for (const [name, category] of collector.entries()) {
    // Use `upsert` here too, in case a tag somehow gets created elsewhere.
    const tag = await prisma.tag.upsert({
      where: { name_category: { name, category } },
      update: {}, // Do nothing if exists
      create: { name, category },
    });
    tagMap.set(name, tag.id);
    // Debug log if needed: console.log(`    + Tag: ${tag.name} (${tag.id})`);
  }

  return tagMap;
}

/**
 * 5) Seed Champion, nested Attacks, and ChampionAbilityLink
 */
async function seedChampions(
  champions: RawChampionData[],
  abilityMap: Map<string, number>,
  tagMap: Map<string, number>
) {
  console.log(`  - Upserting ${champions.length} champions...`);
  for (const c of champions) {
    console.log(`    • ${c["Champion Name"]}`);

    // 5.1) Ensure any champion-specific ability/immunity is in abilityMap
    const allChampAbilityNames = new Set([
      ...Object.keys(c.Abilities),
      ...Object.keys(c.Immunities),
    ]);

    for (const abilityName of allChampAbilityNames) {
      if (!abilityMap.has(abilityName)) {
        console.log(
          `      + Found new ability/immunity for champion: ${abilityName}`
        );
        const ab = await prisma.ability.upsert({
          where: { name: abilityName },
          update: {},
          create: { name: abilityName },
        });
        abilityMap.set(ab.name, ab.id);
      }
    }

    // 5.2) Upsert Champion and connect Tags
    const tagsToConnect = c.Tags.All.map((t) => {
      const id = tagMap.get(t);
      if (id === undefined) {
        throw new Error(
          `Tag '${t}' not found in tagMap for champion ${c["Champion Name"]}`
        );
      }
      return { id };
    });

    const baseChampionData = {
      name: c["Champion Name"],
      shortName: c["Short Name"],
      class: c.Class.toUpperCase() as ChampionClass,
      releaseDate: new Date(c["Release Date"]),
      obtainable: c.Obtainable,
      prestige: c.Prestige,
      images: {
        full_primary: c.primary_image_full,
        full_secondary: c.secondary_image_full,
        p_128: c.primary_image_128,
        s_128: c.secondary_image_128,
        p_64: c.primary_image_64,
        s_64: c.secondary_image_64,
        p_32: c.primary_image_32,
        s_32: c.secondary_image_32,
      },
      discordEmoji: c["Discord Emoji"] || null,
      fullAbilities: c.full_abilities,
    };

    const champ = await prisma.champion.upsert({
      where: { name: c["Champion Name"] },
      update: {
        ...baseChampionData,
        tags: {
          set: tagsToConnect,
        },
      },
      create: {
        ...baseChampionData,
        tags: {
          connect: tagsToConnect,
        },
      },
    });

    // 5.3) Upsert Attacks and Hits
    // First, remove old attacks to ensure data consistency
    await prisma.attack.deleteMany({ where: { championId: champ.id } });
    // Then, create the new attacks from the JSON
    const attackData = Object.entries(c.Attacks).map(([key, hits]) => ({
      championId: champ.id,
      type: key.toUpperCase() as AttackType,
      hits: {
        create: hits.map((properties) => ({ properties })),
      },
    }));
    for (const ad of attackData) {
      await prisma.attack.create({ data: ad });
    }

    // 5.4) Link Abilities & Immunities
    // First, remove old links
    await prisma.championAbilityLink.deleteMany({
      where: { championId: champ.id },
    });

    const links: Prisma.ChampionAbilityLinkCreateManyInput[] = [];
    for (const [name, sources] of Object.entries(c.Abilities)) {
      const normalized = normalizeSources(sources);
      for (const src of normalized) {
        const abilityId = abilityMap.get(name);
        if (abilityId === undefined) {
          console.error(
            `Critical: Ability ID for '${name}' not found. Champion: ${c["Champion Name"]}`
          );
          continue;
        }
        links.push({
          championId: champ.id,
          abilityId: abilityId,
          type: AbilityLinkType.ABILITY,
          ...(src !== null ? { source: src } : {}),
        } as Prisma.ChampionAbilityLinkCreateManyInput);
      }
    }
    for (const [name, sources] of Object.entries(c.Immunities)) {
      const normalized = normalizeSources(sources);
      for (const src of normalized) {
        const abilityId = abilityMap.get(name);
        if (abilityId === undefined) {
          console.error(
            `Critical: Immunity ID for '${name}' not found. Champion: ${c["Champion Name"]}`
          );
          continue;
        }
        links.push({
          championId: champ.id,
          abilityId: abilityId,
          type: AbilityLinkType.IMMUNITY,
          ...(src !== null ? { source: src } : {}),
        } as Prisma.ChampionAbilityLinkCreateManyInput);
      }
    }

    if (links.length) {
      await prisma.championAbilityLink.createMany({
        data: links,
        skipDuplicates: true,
      });
    }
  }
}
