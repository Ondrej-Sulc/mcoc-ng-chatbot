import { ChampionImages } from '@/types/champion';

export function getChampionImageUrl(
  images: ChampionImages,
  size: "32" | "64" | "128" | "full" = "full",
  type: "primary" | "secondary" | "hero" = "primary"
): string {
  if (type === "hero") {
    return images.hero;
  }

  if (size === "full") {
    return type === "primary"
      ? images.full_primary
      : images.full_secondary;
  }

  const key = `${type.charAt(0)}_${size}` as keyof ChampionImages;
  return images[key];
}

export function normalizeChampionName(name: string): string {
  if (!name) return "";
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
