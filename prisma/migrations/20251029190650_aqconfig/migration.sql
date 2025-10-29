-- CreateTable
CREATE TABLE "public"."AQSchedule" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "battlegroup" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "aqDay" INTEGER NOT NULL,
    "channelId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "AQSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AQSkip" (
    "id" TEXT NOT NULL,
    "allianceId" TEXT NOT NULL,
    "skipUntil" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AQSkip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AQSchedule_allianceId_battlegroup_dayOfWeek_key" ON "public"."AQSchedule"("allianceId", "battlegroup", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "AQSkip_allianceId_key" ON "public"."AQSkip"("allianceId");

-- AddForeignKey
ALTER TABLE "public"."AQSchedule" ADD CONSTRAINT "AQSchedule_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "public"."Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AQSkip" ADD CONSTRAINT "AQSkip_allianceId_fkey" FOREIGN KEY ("allianceId") REFERENCES "public"."Alliance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
