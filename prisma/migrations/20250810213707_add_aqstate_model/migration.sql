-- CreateTable
CREATE TABLE "public"."AQState" (
    "channelId" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AQState_pkey" PRIMARY KEY ("channelId")
);
