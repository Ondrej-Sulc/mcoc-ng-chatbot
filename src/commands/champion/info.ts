import { ChampionWithAllRelations } from "../../services/championService";
import { TextDisplayBuilder } from "discord.js";
import { FullAbilities } from "./view";

const MAX_PAGE_LENGTH = 3900; // Leave some buffer for titles, etc.

interface InfoContent {
  content: string;
  currentPage: number;
  totalPages: number;
}

export function getInfoContent(
  champion: ChampionWithAllRelations,
  page: number = 1
): InfoContent {
  const fullAbilities = champion.fullAbilities as FullAbilities;

  if (
    !fullAbilities ||
    (!fullAbilities.signature && !fullAbilities.abilities_breakdown)
  ) {
    return {
      content: `Detailed abilities are not available for ${champion.name}.`,
      currentPage: 1,
      totalPages: 1,
    };
  }

  let fullText = "";
  const addBlock = (title: string, description: string) => {
    fullText += `**${title}**\n${description}\n\n`;
  };

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

  const pages: string[] = [];
  let currentChunk = "";
  const paragraphs = fullText.split("\n\n");

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === "") continue;
    if (currentChunk.length + paragraph.length > MAX_PAGE_LENGTH) {
      pages.push(currentChunk);
      currentChunk = "";
    }
    currentChunk += paragraph + "\n\n";
  }
  if (currentChunk.length > 0) {
    pages.push(currentChunk);
  }

  const totalPages = pages.length;
  const pageIndex = Math.max(0, Math.min(page - 1, totalPages - 1));

  return {
    content: pages[pageIndex] || "No content for this page.",
    currentPage: pageIndex + 1,
    totalPages: totalPages,
  };
}
