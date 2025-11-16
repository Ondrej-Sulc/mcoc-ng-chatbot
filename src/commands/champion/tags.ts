import { ChampionWithAllRelations } from "../../services/championService";
import { Tag } from "@prisma/client";

export function getTagsContent(
  champion: ChampionWithAllRelations
): string {
  if (!champion.tags || champion.tags.length === 0) {
    return "No tags found for this champion.";
  }

  const tagsByCategory = new Map<string, Tag[]>();
  for (const tag of champion.tags) {
    if (!tagsByCategory.has(tag.category)) {
      tagsByCategory.set(tag.category, []);
    }
    tagsByCategory.get(tag.category)?.push(tag);
  }

  let formattedTags = "";
  for (const [category, tags] of tagsByCategory.entries()) {
    formattedTags += `### ${category}\n`;
    formattedTags += tags
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((t) => `- \`${t.name}\``)
      .join("\n");
    formattedTags += "\n";
  }

  return formattedTags.trim();
}
