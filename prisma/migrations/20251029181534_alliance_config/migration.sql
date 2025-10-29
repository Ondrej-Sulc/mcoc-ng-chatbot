-- CreateTable
CREATE TABLE "public"."AllianceConfig" (
    "id" TEXT NOT NULL,
    "sheetId" TEXT,
    "allianceId" TEXT NOT NULL,

    CONSTRAINT "AllianceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllianceConfig_allianceId_key" ON "public"."AllianceConfig"("allianceId");

-- AddForeignKey
ALTER TABLE "public"."AllianceConfig" ADD CONSTRAINT "AllianceConfig_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "public"."Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
