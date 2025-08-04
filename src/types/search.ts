import {
  Champion,
  Tag,
  ChampionAbilityLink,
  Ability,
  AbilityCategory,
  Attack,
  Hit,
} from "@prisma/client";

export interface SearchCoreParams {
  abilities?: string | null;
  immunities?: string | null;
  tags?: string | null;
  championClass?: string | null;
  abilityCategory?: string | null;
  attackType?: string | null;
  userId: string;
  page?: number;
  searchId?: string;
}

export type ChampionWithRelations = Champion & {
  tags: Tag[];
  abilities: (ChampionAbilityLink & {
    ability: Ability & {
      categories: AbilityCategory[];
    };
  })[];
  attacks: (Attack & {
    hits: Hit[];
  })[];
};
