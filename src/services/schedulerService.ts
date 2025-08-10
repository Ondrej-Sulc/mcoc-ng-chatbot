import cron, { ScheduledTask } from "node-cron";
import { getSchedules, updateSchedule, Schedule } from "./scheduleDbService";
import { Client, ChannelType, TextChannel, ThreadChannel, CommandInteraction, ChatInputCommandInteraction, InteractionType, ApplicationCommandType } from "discord.js";
import { config } from "../config";
import { commands } from "../utils/commandHandler";

const jobs: Record<string, ScheduledTask[]> = {};

function getCronExpressions(schedule: Schedule): string[] {
  if (schedule.frequency === "custom" && schedule.cron_expression) {
    return [schedule.cron_expression];
  }

  const times = (schedule.time || "").split(",").map((t) => t.trim()).filter(Boolean);
  const crons: string[] = [];

  for (const time of times) {
    const [hour, minute] = time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) continue;

    const dayOfMonth = schedule.day ? parseInt(schedule.day, 10) : 1;
    const dayOfWeekMap: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
    const dayOfWeek = schedule.day ? dayOfWeekMap[schedule.day.toLowerCase()] ?? 1 : 1;

    switch (schedule.frequency) {
      case "daily":
        crons.push(`${minute} ${hour} * * *`);
        break;
      case "weekly":
        crons.push(`${minute} ${hour} * * ${dayOfWeek}`);
        break;
      case "monthly":
        crons.push(`${minute} ${hour} ${dayOfMonth} * *`);
        break;
      case "every":
        const interval = schedule.interval ? parseInt(schedule.interval, 10) : 1;
        if (schedule.unit === "days") {
          crons.push(`${minute} ${hour} */${interval} * *`);
        } else if (schedule.unit === "weeks") {
          crons.push(`${minute} ${hour} * * ${dayOfWeek}`);
        }
        break;
    }
  }
  return crons;
}

function parseArgs(argsString: string): Map<string, string | null> {
    const args = new Map<string, string | null>();
    if (!argsString) return args;

    const parts = argsString.split(/\s+(?=\w+:)/g);
    for (const part of parts) {
        const [key, ...valueParts] = part.split(':');
        if (key && valueParts.length > 0) {
            let value = valueParts.join(':').trim();
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            args.set(key, value);
        }
    }
    return args;
}

async function executeScheduledCommand(client: Client, schedule: Schedule) {
    if (!schedule.command) return;

    const targetChannelId = schedule.target_channel_id;
    const targetUserId = schedule.target_user_id;

    if (!targetUserId && !targetChannelId) {
        console.warn(`[Scheduler] No target specified for schedule: ${schedule.id}`);
        return;
    }

    const commandString = schedule.command.replace(/^\//, "");
    const commandParts = commandString.split(/\s+/);
    const commandName = commandParts.shift()!;

    const command = commands.get(commandName);
    if (!command) {
        console.warn(`[Scheduler] Command "${commandName}" not found for schedule: ${schedule.id}`);
        return;
    }

    const hasSubcommands = command.data?.toJSON().options?.some((o: any) => o.type === 1 || o.type === 2);
    const subcommand = hasSubcommands ? commandParts.shift() : null;
    
    const argsString = commandParts.join(' ');
    const args = parseArgs(argsString);

    let channel: TextChannel | ThreadChannel | null = null;
    if (targetChannelId) {
        try {
            const fetchedChannel = await client.channels.fetch(targetChannelId);
            if (fetchedChannel && (fetchedChannel.type === ChannelType.GuildText || fetchedChannel.type === ChannelType.PublicThread || fetchedChannel.type === ChannelType.PrivateThread)) {
                channel = fetchedChannel as TextChannel | ThreadChannel;
            }
        } catch (error) {
            console.error(`[Scheduler] Could not fetch channel ${targetChannelId}:`, error);
            return; 
        }
    }
    const guild = channel?.guild;

    const user = targetUserId ? await client.users.fetch(targetUserId) : null;

    const mockInteraction = {
        client,
        channel,
        user,
        guild,
        commandName,
        type: InteractionType.ApplicationCommand,
        applicationId: client.application?.id || '',
        isChatInputCommand: () => true,
        deferReply: async () => {},
        editReply: async (options: any) => {
            const target = channel || user;
            if (target) {
                await target.send(options);
            }
        },
        reply: async (options: any) => {
            const target = channel || user;
            if (target) {
                await target.send(options);
            }
        },
        followUp: async (options: any) => {
            const target = channel || user;
            if (target) {
                await target.send(options);
            }
        },
        options: {
            data: [],
            _group: null,
            _subcommand: subcommand,
            _hoistedOptions: [],
            getSubcommand: (required = false) => subcommand,
            getString: (name: string) => {
                const value = args.get(name);
                if (!value) return null;
                if (name === 'role' && guild) {
                    const role = guild.roles.cache.find(r => r.name === value || r.id === value);
                    return role ? role.id : null;
                }
                return value;
            },
            getInteger: (name: string) => parseInt(args.get(name) || '0'),
            getBoolean: (name: string) => args.get(name) === 'true',
            getUser: (name: string) => null, 
            getMember: (name: string) => null,
            getChannel: (name: string) => {
                const value = args.get(name);
                if (!value) return null;
                const channelName = value.replace(/^#/, '');
                if (!guild) return null;
                return guild.channels.cache.find(c => c.name === channelName || c.id === value) || null;
            },
            getRole: (name: string) => {
                const value = args.get(name);
                if (!value) return null;
                if (!guild) return null;
                return guild.roles.cache.get(value) || guild.roles.cache.find(r => r.name === value) || null;
            },
            getMentionable: (name: string) => null,
            getAttachment: (name: string) => null,
            getNumber: (name: string) => parseFloat(args.get(name) || '0'),
        }
    } as unknown as ChatInputCommandInteraction;

    try {
        await command.execute(mockInteraction);
    } catch (error) {
        console.error(`[Scheduler] Error executing command for schedule ${schedule.id}:`, error);
    }
}

async function sendScheduledMessage(client: Client, schedule: Schedule) {
  if (!schedule.message) return;

  const target = schedule.target_user_id ? await client.users.fetch(schedule.target_user_id) : 
                 schedule.target_channel_id ? await client.channels.fetch(schedule.target_channel_id) : null;

  if (target && 'send' in target) {
    await (target as TextChannel).send(schedule.message);
  }
}

export async function startScheduler(client: Client) {
  Object.values(jobs).flat().forEach((job) => job.stop());
  Object.keys(jobs).forEach((id) => delete jobs[id]);

  const schedules = await getSchedules();
  for (const schedule of schedules) {
    const cronExprs = getCronExpressions(schedule);
    jobs[schedule.id] = [];

    for (const cronExpr of cronExprs) {
      if (!cron.validate(cronExpr)) {
        console.warn(`[Scheduler] Invalid cron for schedule: ${schedule.id}`);
        continue;
      }

      const job = cron.schedule(cronExpr, async () => {
        console.log(`[Scheduler] Triggering schedule: ${schedule.name} (${schedule.id})`);

        if (schedule.frequency === 'every' && schedule.unit === 'weeks') {
            const interval = parseInt(schedule.interval || '1', 10);
            const lastRun = schedule.last_run || schedule.createdAt;
            const weeksSinceLastRun = Math.floor((new Date().getTime() - lastRun.getTime()) / (1000 * 60 * 60 * 24 * 7));

            if (weeksSinceLastRun < interval) {
                return; 
            }
        }

        if (schedule.message) {
          await sendScheduledMessage(client, schedule);
        } else if (schedule.command) {
          await executeScheduledCommand(client, schedule);
        }

        await updateSchedule(schedule.id, { last_run: new Date() });

      }, { timezone: config.TIMEZONE });

      jobs[schedule.id].push(job);
      console.log(`[Scheduler] Scheduled: ${schedule.name} (${cronExpr}) [${schedule.id}]`);
    }
  }
}
