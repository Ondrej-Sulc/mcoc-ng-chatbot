-- CreateTable
CREATE TABLE "public"."AQReminderSettings" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "remindersEnabled" BOOLEAN NOT NULL DEFAULT true,
    "section1PingDelayHours" INTEGER NOT NULL DEFAULT 11,
    "section2PingDelayHours" INTEGER NOT NULL DEFAULT 18,
    "finalPingHoursBeforeEnd" INTEGER NOT NULL DEFAULT 4,

    CONSTRAINT "AQReminderSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AQReminderSettings_allianceId_key" ON "public"."AQReminderSettings"("allianceId");

-- AddForeignKey
ALTER TABLE "public"."AQReminderSettings" ADD CONSTRAINT "AQReminderSettings_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "public"."Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
