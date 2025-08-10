-- CreateEnum
CREATE TYPE "public"."ScheduleFrequency" AS ENUM ('daily', 'weekly', 'monthly', 'every', 'custom');

-- CreateTable
CREATE TABLE "public"."Schedule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "public"."ScheduleFrequency" NOT NULL,
    "time" TEXT NOT NULL,
    "command" TEXT,
    "message" TEXT,
    "target_channel_id" TEXT,
    "target_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "day" TEXT,
    "interval" TEXT,
    "unit" TEXT,
    "cron_expression" TEXT,
    "last_run" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
