import cron from "node-cron";
import { prisma } from "./prismaService";
import { Client, TextChannel } from "discord.js";
import { handleStart } from "../commands/aq/start";

let isRunning = false;

export function startAQScheduler(client: Client) {
  if (isRunning) {
    console.log("[AQScheduler] Already running.");
    return;
  }

  // Run every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const time = `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')}`;

    const schedules = await prisma.aQSchedule.findMany({
      where: {
        dayOfWeek,
        time,
      },
      include: {
        alliance: {
          include: {
            aqSkip: true,
          },
        },
      },
    });

    const guildSchedules = new Map<string, { guild: any, schedules: { schedule: any, channel: any }[] }>();

    for (const schedule of schedules) {
      try {
        const channel = await client.channels.fetch(schedule.channelId);
        if (channel && channel instanceof TextChannel) {
          const guild = channel.guild;
          if (!guildSchedules.has(guild.id)) {
            guildSchedules.set(guild.id, { guild, schedules: [] });
          }
          guildSchedules.get(guild.id)!.schedules.push({ schedule, channel });
        }
      } catch (error) {
        console.error(`[AQScheduler] Error fetching channel for schedule ${schedule.id}:`, error);
      }
    }

    for (const [guildId, { guild, schedules: guildSchedulesList }] of guildSchedules.entries()) {
      try {
        await guild.members.fetch();
      } catch (error: any) {
        if (error.code === 'GuildMembersTimeout') {
          console.error(`[AQScheduler] guild.members.fetch() timed out for guild ${guild.name}. Skipping all AQ starts for this guild.`);
          continue; // Skip this guild
        } else {
          console.error(`[AQScheduler] Error fetching members for guild ${guild.name}:`, error);
          continue; // Skip this guild
        }
      }

      for (const { schedule, channel } of guildSchedulesList) {
        const { alliance, aqDay, roleId } = schedule;

        if (alliance.aqSkip && alliance.aqSkip.skipUntil > now) {
          console.log(`[AQScheduler] Skipping AQ for alliance ${alliance.name} (raid week).`);
          continue;
        }

        try {
          const role = await guild.roles.fetch(roleId);

          if (!role) {
            console.error(`[AQScheduler] Role with ID ${roleId} not found in guild ${guild.name}.`);
            continue;
          }

          console.log(`[AQScheduler] Running AQ start for ${alliance.name}, BG associated with role ${role.name}`);
          
          await handleStart({
            day: aqDay,
            roleId: roleId,
            channel: channel,
            guild: guild,
            channelName: channel.name,
            roleName: role.name,
          });
        } catch (error) {
          console.error(`[AQScheduler] Error running AQ start for alliance ${alliance.name}:`, error);
        }
      }
    }
  });

  isRunning = true;
  console.log("[AQScheduler] Started.");
}
