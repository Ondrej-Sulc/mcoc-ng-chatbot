-- CreateEnum
CREATE TYPE "DuelSource" AS ENUM ('USER_SUGGESTION', 'GUIA_MTC', 'COCPIT');

-- 1. Rename old column
ALTER TABLE "Duel" RENAME COLUMN "source" TO "source_old";

-- 2. Add new enum column (temporarily nullable)
ALTER TABLE "Duel" ADD COLUMN "source" "DuelSource";

-- 3. Copy and transform data
UPDATE "Duel" SET "source" = CASE "source_old"
    WHEN 'community_csv' THEN 'GUIA_MTC'::"DuelSource"
    WHEN 'user_suggestion' THEN 'USER_SUGGESTION'::"DuelSource"
    ELSE 'GUIA_MTC'::"DuelSource" -- Default for any other unexpected values
END;

-- 4. Drop old column
ALTER TABLE "Duel" DROP COLUMN "source_old";

-- 5. Add constraints to new column
ALTER TABLE "Duel" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE "Duel" ALTER COLUMN "source" SET DEFAULT 'GUIA_MTC';