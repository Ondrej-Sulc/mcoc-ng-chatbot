import { PrismaClient, Schedule } from "@prisma/client";
import { ScheduleFrequency } from "@prisma/client";

const prisma = new PrismaClient();

export { Schedule, ScheduleFrequency };

/**
 * A subset of the Schedule model for creating a new schedule.
 */
export type NewSchedulePayload = Omit<
  Schedule,
  "id" | "createdAt" | "updatedAt" | "is_active" | "last_run"
>;

/**
 * Retrieves all active schedules from the database.
 * @returns A promise that resolves to an array of Schedule objects.
 */
export async function getSchedules(): Promise<Schedule[]> {
  return prisma.schedule.findMany({
    where: { is_active: true },
  });
}

/**
 * Adds a new schedule to the database.
 * @param data - The schedule data to add.
 * @returns A promise that resolves to the created Schedule object.
 */
export async function addSchedule(data: NewSchedulePayload): Promise<Schedule> {
  return prisma.schedule.create({
    data: {
      ...data,
      command: data.command || null,
      message: data.message || null,
      target_channel_id: data.target_channel_id || null,
      target_user_id: data.target_user_id || null,
      day: data.day || null,
      interval: data.interval || null,
      unit: data.unit || null,
      cron_expression: data.cron_expression || null,
    },
  });
}

/**
 * Marks a schedule as inactive in the database (soft delete).
 * @param id - The ID of the schedule to delete.
 * @returns A promise that resolves to the updated Schedule object.
 */
export async function deleteSchedule(id: string): Promise<Schedule> {
  return prisma.schedule.update({
    where: { id },
    data: { is_active: false },
  });
}

/**
 * Updates a schedule in the database.
 * @param id - The ID of the schedule to update.
 * @param data - The partial schedule data to update.
 * @returns A promise that resolves to the updated Schedule object.
 */
export async function updateSchedule(
  id: string,
  data: Partial<Schedule>
): Promise<Schedule> {
  return prisma.schedule.update({
    where: { id },
    data,
  });
}
