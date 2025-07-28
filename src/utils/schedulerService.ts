import cron, { ScheduledTask } from "node-cron";
import { getSchedules, ScheduleRow } from "./sheetsService";
import {
  Client,
  ChannelType,
  TextChannel,
  ThreadChannel,
  MessageFlags,
  MessageCreateOptions,
} from "discord.js";
import { config } from "../config";
import fs from "fs";
import path from "path";

const jobs: Record<string, ScheduledTask[]> = {};
/**
 * An object to store scheduled tasks, keyed by schedule ID.
 */

// --- DYNAMIC COMMAND LOADER ---
const commandsDir = path.join(__dirname, "../commands");
const coreCommands: Record<string, Function> = {};
for (const file of fs.readdirSync(commandsDir)) {
  if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;
  const cmd = require(path.join(commandsDir, file));
  if (typeof cmd.core === "function") {
    const name = path.basename(file, path.extname(file));
    coreCommands[name] = cmd.core;
  }
}
// --- END DYNAMIC COMMAND LOADER ---

// Types for scheduled command params and message options
interface ScheduledCommandParams {
  targetChannelId?: string;
  targetUserId?: string;
  subcommand?: string;
  amount?: number | string;
  timeframe?: string;
  args?: string[];
  [key: string]: any;
}

function getCronExpressions(schedule: ScheduleRow): string[] {
  /**
   * Generates cron expressions based on a schedule row.
   * @param schedule - The schedule row object.
   * @returns An array of cron expressions.
   */
  // If custom cron_expression is provided, use it directly
  if (schedule.frequency === "custom" && schedule.cron_expression) {
    return [schedule.cron_expression];
  }

  // Support multiple times per day (comma-separated)
  const times = (schedule.time || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const crons: string[] = [];

  for (const time of times) {
    const [hour, minute] = time.split(":").map(Number);
    if (isNaN(hour) || isNaN(minute)) continue;
    switch (schedule.frequency) {
      case "daily":
        crons.push(`${minute} ${hour} * * *`);
        break;
      case "weekly": {
        // day: e.g. "monday", "tuesday", ...
        const dayMap: Record<string, number> = {
          sunday: 0,
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
        };
        const day = schedule.day ? schedule.day.toLowerCase() : "monday";
        const dayNum = dayMap[day] ?? 1;
        crons.push(`${minute} ${hour} * * ${dayNum}`);
        break;
      }
      case "monthly": {
        // day: e.g. "15" for 15th of the month
        const dayOfMonth = schedule.day ? parseInt(schedule.day, 10) : 1;
        crons.push(`${minute} ${hour} ${dayOfMonth} * *`);
        break;
      }
      case "every": {
        // interval/unit: e.g. every 2 days, every 3 weeks
        const interval = schedule.interval
          ? parseInt(schedule.interval, 10)
          : 1;
        const unit = schedule.unit || "days";
        if (unit === "days") {
          crons.push(`${minute} ${hour} */${interval} * *`);
        } else if (unit === "weeks") {
          // Run every N weeks on the specified day (default Monday)
          const dayMap: Record<string, number> = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6,
          };
          const day = schedule.day ? schedule.day.toLowerCase() : "monday";
          const dayNum = dayMap[day] ?? 1;
          crons.push(`${minute} ${hour} * * ${dayNum}`); // node-cron does not support "every N weeks" natively
          // Note: For true "every N weeks", would need custom logic
        }
        break;
      }
      default:
        // fallback: daily
        crons.push(`${minute} ${hour} * * *`);
    }
  }
  return crons;
}

/**
 * Runs a scheduled command.
 * @param commandString - The command string to run (e.g., "/today", "/exercise pushup").
 * @param params - Additional parameters for the command.
 * @param client - The Discord client.
 * @param channelId - The ID of the channel to send the command result to (if applicable).
 * @param userId - The ID of the user to send the command result to (if applicable).
 */
async function runScheduledCommand(
  commandString: string,
  params: ScheduledCommandParams,
  client: Client,
  channelId: string | undefined,
  userId?: string
) {
  // Decide where to send the message: DM to user or to channel
  const targetUserId = userId || params.targetUserId;
  const targetChannelId = channelId || params.targetChannelId;

  if (!targetUserId && !targetChannelId) {
    console.warn(
      `[Scheduler] No target_user_id or target_channel_id provided for scheduled command: ${commandString}`
    );
    return;
  }
  // Parse command string: e.g. "/today" or "/exercise pushup"
  const [cmdName, ...args] = commandString.replace(/^\//, "").split(" ");
  const coreFn = coreCommands[cmdName];
  if (!coreFn) {
    console.warn(`[Scheduler] No core function for command: ${cmdName}`);
    return;
  }
  // Generalized mapping: if args are present, map to subcommand, amount, timeframe
  let callParams: ScheduledCommandParams = {
    ...params,
    args,
    userId: targetUserId,
  };
  if (Array.isArray(args) && args.length > 0) {
    callParams = { ...params, userId: targetUserId };
    callParams.subcommand = args[0];
    if (args[1]) {
      const n = parseInt(args[1], 10);
      callParams.amount = !isNaN(n) ? n : args[1];
    }
    if (args[2]) {
      callParams.timeframe = args[2];
    }
    callParams.args = args;
  }
  const result = await coreFn(callParams);

  if (targetUserId) {
    // Send DM to user
    try {
      const user = await client.users.fetch(targetUserId);
      if (user) {
        const messageOptions: MessageCreateOptions = {};
        if (result.isComponentsV2) {
          messageOptions.flags = MessageFlags.IsComponentsV2;
          if (result.components && result.components.length > 0)
            messageOptions.components = result.components;
          // Do NOT include content when using Components V2
        } else {
          if (result.content) messageOptions.content = result.content;
          if (result.components && result.components.length > 0)
            messageOptions.components = result.components;
        }
        if (!messageOptions.content && !result.isComponentsV2)
          messageOptions.content = `Scheduled command ran: ${cmdName}`;
        await user.send(messageOptions);
        return;
      }
    } catch (err) {
      console.warn(`[Scheduler] Could not DM user: ${targetUserId}`, err);
    }
  }

  if (targetChannelId) {
    // Send to channel
    try {
      const channel = await client.channels.fetch(targetChannelId);
      if (
        channel &&
        (channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.PublicThread ||
          channel.type === ChannelType.PrivateThread)
      ) {
        const sendable = channel as TextChannel | ThreadChannel;
        const messageOptions: MessageCreateOptions = {};
        if (result.isComponentsV2) {
          messageOptions.flags = MessageFlags.IsComponentsV2;
          if (result.components && result.components.length > 0)
            messageOptions.components = result.components;
          // Do NOT include content when using Components V2
        } else {
          if (result.content) messageOptions.content = result.content;
          if (result.components && result.components.length > 0)
            messageOptions.components = result.components;
        }
        if (!messageOptions.content && !result.isComponentsV2)
          messageOptions.content = `Scheduled command ran: ${cmdName}`;
        await sendable.send(messageOptions);
      } else {
        console.warn(
          `[Scheduler] Could not find text channel: ${targetChannelId}`
        );
      }
    } catch (err) {
      console.warn(
        `[Scheduler] Error sending to channel: ${targetChannelId}`,
        err
      );
    }
  }
}

/**
 * Sends a scheduled message to a target channel or user.
 * @param message - The message content to send.
 * @param client - The Discord client.
 * @param channelId - The ID of the channel to send the message to (optional).
 * @param userId - The ID of the user to send the message to (optional).
 */
async function sendScheduledMessage(
  message: string,
  client: Client,
  channelId?: string,
  userId?: string
) {
  if (!userId && !channelId) {
    console.warn(
      `[Scheduler] No target_user_id or target_channel_id provided for scheduled message: ${message}`
    );
    return;
  }
  if (userId) {
    try {
      const user = await client.users.fetch(userId);
      if (user) {
        await user.send({ content: message });
        return;
      }
    } catch (err) {
      console.warn(`[Scheduler] Could not DM user: ${userId}`, err);
    }
  }
  if (channelId) {
    try {
      const channel = await client.channels.fetch(channelId);
      if (
        channel &&
        (channel.type === ChannelType.GuildText ||
          channel.type === ChannelType.PublicThread ||
          channel.type === ChannelType.PrivateThread)
      ) {
        const sendable = channel as TextChannel | ThreadChannel;
        await sendable.send({ content: message });
      } else {
        console.warn(`[Scheduler] Could not find text channel: ${channelId}`);
      }
    } catch (err) {
      console.warn(`[Scheduler] Error sending to channel: ${channelId}`, err);
    }
  }
}

/**
 * Starts the scheduler, loading and scheduling tasks from the Google Sheet.
 * Stops any previously scheduled jobs before starting new ones.
 * @param client - The Discord client instance.
 */
export async function startScheduler(client: Client) {
  // Stop any existing jobs
  Object.values(jobs)
    .flat()
    .forEach((job) => job.stop());
  Object.keys(jobs).forEach((id) => delete jobs[id]);

  const schedules = (await getSchedules()).filter((s) => s.is_active);
  for (const schedule of schedules) {
    const cronExprs = getCronExpressions(schedule);
    jobs[schedule.id] = [];
    for (const cronExpr of cronExprs) {
      if (!cron.validate(cronExpr)) {
        console.warn(
          `[Scheduler] Invalid cron for schedule:`,
          schedule,
          cronExpr
        );
        continue;
      }
      const job = cron.schedule(
        cronExpr,
        async () => {
          console.log(
            `[Scheduler] Triggering schedule: ${JSON.stringify(schedule)}`
          );
          if (schedule.message && schedule.message.trim()) {
            await sendScheduledMessage(
              schedule.message,
              client,
              schedule.target_channel_id,
              schedule.target_user_id
            );
          } else if (schedule.command && schedule.command.trim()) {
            await runScheduledCommand(
              schedule.command,
              {
                targetChannelId: schedule.target_channel_id,
                targetUserId: schedule.target_user_id,
              },
              client,
              schedule.target_channel_id,
              schedule.target_user_id
            );
          } else {
            console.warn(
              `[Scheduler] No command or message to run for schedule:`,
              schedule
            );
          }
        },
        { timezone: config.TIMEZONE }
      );
      jobs[schedule.id].push(job);
      console.log(
        `[Scheduler] Scheduled: ${schedule.name} (${cronExpr}) [${schedule.id}]`
      );
    }
  }
}