import { Schedule, ScheduleFrequency, Prisma } from "@prisma/client";

export { Schedule, ScheduleFrequency };

/**
 * A subset of the Schedule model for creating a new schedule.
 */
export type NewSchedulePayload = {
  name: string;
  frequency: ScheduleFrequency;
  time: string;
  command?: string | null;
  message?: string | null;
  target_channel_id?: string | null;
  target_user_id?: string | null;
  day?: string | null;
  interval?: string | null;
  unit?: string | null;
};

/**
 * Retrieves all active schedules from the database.
 * @returns A promise that resolves to an array of Schedule objects.
 */
export async function getSchedules(): Promise<Schedule[]> {
  const { prisma } = await import("./prismaService.js");
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
  const { prisma } = await import("./prismaService.js");
  return prisma.schedule.create({
    data,
  });
}

/**
 * Marks a schedule as inactive in the database (soft delete).
 * @param id - The ID of the schedule to delete.
 * @returns A promise that resolves to the updated Schedule object.
 */
export async function deleteSchedule(id: string): Promise<Schedule> {
  const { prisma } = await import("./prismaService.js");
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
  const { prisma } = await import("./prismaService.js");
  return prisma.schedule.update({
    where: { id },
    data,
  });
}
