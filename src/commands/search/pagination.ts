import { ChampionWithRelations, RosterEntryWithChampionRelations } from "../../types/search";

const PAGE_SIZE = 10;
const CONTENT_LIMIT = 3800;

export function simplePaginate<T extends ChampionWithRelations | RosterEntryWithChampionRelations>(
  items: T[]
): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += PAGE_SIZE) {
    pages.push(items.slice(i, i + PAGE_SIZE));
  }
  return pages;
}

export function paginate<T extends ChampionWithRelations | RosterEntryWithChampionRelations>(
  items: T[],
  getLength: (item: T) => number
): T[][] {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentLength = 0;

  for (const item of items) {
    const itemLength = getLength(item);
    if (currentLength + itemLength > CONTENT_LIMIT) {
      pages.push(currentPage);
      currentPage = [];
      currentLength = 0;
    }
    currentPage.push(item);
    currentLength += itemLength;
  }

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  return pages;
}
