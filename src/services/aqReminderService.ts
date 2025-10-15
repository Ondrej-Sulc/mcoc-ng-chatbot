import { Client, TextChannel } from "discord.js";
import cron from "node-cron";
import { config } from "../config";
import { AQState, getAllStates, setState } from "../commands/aq/state";

function getSlackers(state: AQState, isFinal: boolean): string[] {
  const slackers: Set<string> = new Set();
  const sectionsToCheck: ("s1" | "s2" | "s3")[] = isFinal
    ? ["s1", "s2", "s3"]
    : ["s1"];

  for (const section of sectionsToCheck) {
    if (state.players[section]) {
      for (const playerId in state.players[section]) {
        if (!state.players[section][playerId].done) {
          slackers.add(`<@${playerId}>`);
        }
      }
    }
  }
  return Array.from(slackers);
}

async function sendReminderPing(
  client: Client,
  state: AQState,
  isFinal: boolean
) {
  const slackers = getSlackers(state, isFinal);
  if (slackers.length === 0) return;

  const message = isFinal
    ? `🚨 Final push! Map not complete. Please clear your paths: ${slackers.join(
        " "
      )}`
    : `Friendly reminder to move in AQ: ${slackers.join(" ")}`;

  try {
    const channel = await client.channels.fetch(state.channelId);
    if (channel && channel.isTextBased()) {
      await (channel as TextChannel).send(message);
    }
  } catch (error) {
    console.error(
      `Failed to send AQ reminder to channel ${state.channelId}:`,
      error
    );
  }
}

async function checkAqStatuses(client: Client) {
  const allStates = await getAllStates();
  const now = new Date();

  for (const state of allStates) {
    if (state.status !== "active") continue;

    const startTime = new Date(state.startTimeIso);
    const endTime = new Date(state.endTimeIso);

    // Auto-end
    if (now >= endTime) {
      state.status = "ended";
      await setState(state.channelId, state);
      try {
        const channel = await client.channels.fetch(state.channelId);
        if (channel && channel.isTextBased()) {
          const message = await (channel as TextChannel).messages.fetch(
            state.messageId
          );
          await message.edit({ content: "AQ Day has ended.", components: [] });
        }
      } catch (e) {
        console.error(
          `Could not edit AQ message for channel ${state.channelId} after auto-ending.`,
          e
        );
      }
      continue;
    }

    // Slacker ping
    const slackerPingTime = new Date(
      startTime.getTime() + config.AQ_SLACKER_PING_DELAY_HOURS * 60 * 60 * 1000
    );
    if (!state.slackerPingSent && now >= slackerPingTime) {
      await sendReminderPing(client, state, false);
      state.slackerPingSent = true;
      await setState(state.channelId, state);
    }

    // Final ping
    const finalPingTime = new Date(
      endTime.getTime() - config.AQ_FINAL_PING_HOURS_BEFORE_END * 60 * 60 * 1000
    );
    if (!state.finalPingSent && now >= finalPingTime) {
      await sendReminderPing(client, state, true);
      state.finalPingSent = true;
      await setState(state.channelId, state);
    }
  }
}

export function initializeAqReminders(client: Client) {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", () => checkAqStatuses(client), {
    timezone: config.TIMEZONE,
  });
  console.log(" AQ Reminder service initialized.");
}
