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

    for (const schedule of schedules) {
      const { alliance, aqDay, channelId, roleId } = schedule;

      if (alliance.aqSkip && alliance.aqSkip.skipUntil > now) {
        console.log(`[AQScheduler] Skipping AQ for alliance ${alliance.name} (raid week).`);
        continue;
      }

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel instanceof TextChannel) {
          const guild = channel.guild;
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
            createThread: false,
            channelName: channel.name,
            roleName: role.name,
          });
        }
      } catch (error) {
        console.error(`[AQScheduler] Error running AQ start for alliance ${alliance.name}:`, error);
      }
    }
  });

  isRunning = true;
  console.log("[AQScheduler] Started.");
}
