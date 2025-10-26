import { ChampionClass } from "@prisma/client";

export interface ChampionThumbnailOptions {
  championName: string;
  championClass: ChampionClass;
  secondaryImageUrl: string; // full-body
  primaryImageUrl?: string; // circular avatar
  subcommand: string; // e.g., "abilities"
  tagline?: string; // optional, small text line
  width?: number;
  height?: number;
  fetchTimeoutMs?: number;
  patternScale?: number;
  patternOpacityMultiplier?: number;
}
