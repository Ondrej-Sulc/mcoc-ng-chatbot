import { Client, TextChannel } from "discord.js";
import { DateTime } from "luxon";
import cron from "node-cron";
import { config } from "../config";
import { AQState, getAllStates, setState } from "../commands/aq/state";
import { prisma } from "./prismaService";

function getSlackers(
  state: AQState,
  isFinal: boolean,
  isSection2: boolean
): string[] {
  const slackers: Set<string> = new Set();
  let sectionsToCheck: ("s1" | "s2" | "s3")[] = ["s1"];
  if (isFinal) {
    sectionsToCheck = ["s1", "s2", "s3"];
  } else if (isSection2) {
    sectionsToCheck = ["s1", "s2"];
  }

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
  isFinal: boolean,
  isSection2: boolean
) {
  const slackers = getSlackers(state, isFinal, isSection2);
  if (slackers.length === 0) return;

  let message = `Friendly reminder to move in AQ: ${slackers.join(" ")}`;
  if (isFinal) {
    message = `🚨 Final push! Map not complete. Please clear your paths: ${slackers.join(
      " "
    )}`;
  } else if (isSection2) {
    message = `Reminder to clear section 2 in AQ: ${slackers.join(" ")}`;
  }

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

    let allianceId = state.allianceId;
    if (!allianceId) {
      const schedule = await prisma.aQSchedule.findFirst({
        where: { channelId: state.channelId },
      });
      if (schedule) {
        allianceId = schedule.allianceId;
      }
    }

    if (!allianceId) continue;

    const alliance = await prisma.alliance.findUnique({
      where: { id: allianceId },
      include: { aqReminderSettings: true },
    });

    if (!alliance) continue;

    const { aqReminderSettings } = alliance;

    if (!aqReminderSettings) continue;

    const now = DateTime.utc();

    // Section 1 ping
    if (aqReminderSettings.section1ReminderEnabled) {
      const [hour, minute] = aqReminderSettings.section1PingTime.split(":").map(Number);
      const section1PingTime = now.set({ hour, minute, second: 0, millisecond: 0 });
      if (!state.slackerPingSent && now >= section1PingTime) {
        await sendReminderPing(client, state, false, false);
        state.slackerPingSent = true;
        await setState(state.channelId, state);
      }
    }

    // Section 2 ping
    if (aqReminderSettings.section2ReminderEnabled) {
        const [hour, minute] = aqReminderSettings.section2PingTime.split(":").map(Number);
        const section2PingTime = now.set({ hour, minute, second: 0, millisecond: 0 });
        if (!state.section2PingSent && now >= section2PingTime) {
            await sendReminderPing(client, state, false, true);
            state.section2PingSent = true;
            await setState(state.channelId, state);
        }
    }

    // Final ping
    if (aqReminderSettings.finalReminderEnabled) {
        const [hour, minute] = aqReminderSettings.finalPingTime.split(":").map(Number);
        const finalPingTime = now.set({ hour, minute, second: 0, millisecond: 0 });
        if (!state.finalPingSent && now >= finalPingTime) {
            await sendReminderPing(client, state, true, false);
            state.finalPingSent = true;
            await setState(state.channelId, state);
        }
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
