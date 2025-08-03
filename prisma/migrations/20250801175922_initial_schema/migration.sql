-- CreateEnum
CREATE TYPE "public"."ChampionClass" AS ENUM ('SCIENCE', 'SKILL', 'MYSTIC', 'COSMIC', 'TECH', 'MUTANT', 'SUPERIOR');

-- CreateEnum
CREATE TYPE "public"."AbilityLinkType" AS ENUM ('ABILITY', 'IMMUNITY');

-- CreateEnum
CREATE TYPE "public"."AttackType" AS ENUM ('L1', 'L2', 'L3', 'L4', 'M1', 'M2', 'H', 'S1', 'S2');

-- CreateTable
CREATE TABLE "public"."AbilityCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AbilityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ability" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "emoji" TEXT,

    CONSTRAINT "Ability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Champion" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "class" "public"."ChampionClass" NOT NULL,
    "releaseDate" TIMESTAMP(3) NOT NULL,
    "obtainable" TEXT[],
    "prestige" JSONB NOT NULL,
    "images" JSONB NOT NULL,
    "discordEmoji" TEXT,
    "fullAbilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Champion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChampionAbilityLink" (
    "id" SERIAL NOT NULL,
    "type" "public"."AbilityLinkType" NOT NULL,
    "source" TEXT NOT NULL,
    "championId" INTEGER NOT NULL,
    "abilityId" INTEGER NOT NULL,

    CONSTRAINT "ChampionAbilityLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Attack" (
    "id" SERIAL NOT NULL,
    "type" "public"."AttackType" NOT NULL,
    "championId" INTEGER NOT NULL,

    CONSTRAINT "Attack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Hit" (
    "id" SERIAL NOT NULL,
    "properties" TEXT[],
    "attackId" INTEGER NOT NULL,

    CONSTRAINT "Hit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."_AbilityToAbilityCategory" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AbilityToAbilityCategory_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "public"."_ChampionToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ChampionToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbilityCategory_name_key" ON "public"."AbilityCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Ability_name_key" ON "public"."Ability"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Champion_name_key" ON "public"."Champion"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_category_key" ON "public"."Tag"("name", "category");

-- CreateIndex
CREATE INDEX "ChampionAbilityLink_championId_idx" ON "public"."ChampionAbilityLink"("championId");

-- CreateIndex
CREATE INDEX "ChampionAbilityLink_abilityId_idx" ON "public"."ChampionAbilityLink"("abilityId");

-- CreateIndex
CREATE UNIQUE INDEX "ChampionAbilityLink_championId_abilityId_type_key" ON "public"."ChampionAbilityLink"("championId", "abilityId", "type");

-- CreateIndex
CREATE INDEX "Attack_championId_idx" ON "public"."Attack"("championId");

-- CreateIndex
CREATE UNIQUE INDEX "Attack_championId_type_key" ON "public"."Attack"("championId", "type");

-- CreateIndex
CREATE INDEX "Hit_attackId_idx" ON "public"."Hit"("attackId");

-- CreateIndex
CREATE INDEX "_AbilityToAbilityCategory_B_index" ON "public"."_AbilityToAbilityCategory"("B");

-- CreateIndex
CREATE INDEX "_ChampionToTag_B_index" ON "public"."_ChampionToTag"("B");

-- AddForeignKey
ALTER TABLE "public"."ChampionAbilityLink" ADD CONSTRAINT "ChampionAbilityLink_championId_fkey" FOREIGN KEY ("championId") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChampionAbilityLink" ADD CONSTRAINT "ChampionAbilityLink_abilityId_fkey" FOREIGN KEY ("abilityId") REFERENCES "public"."Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Attack" ADD CONSTRAINT "Attack_championId_fkey" FOREIGN KEY ("championId") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Hit" ADD CONSTRAINT "Hit_attackId_fkey" FOREIGN KEY ("attackId") REFERENCES "public"."Attack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AbilityToAbilityCategory" ADD CONSTRAINT "_AbilityToAbilityCategory_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Ability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_AbilityToAbilityCategory" ADD CONSTRAINT "_AbilityToAbilityCategory_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."AbilityCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ChampionToTag" ADD CONSTRAINT "_ChampionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."Champion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_ChampionToTag" ADD CONSTRAINT "_ChampionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
