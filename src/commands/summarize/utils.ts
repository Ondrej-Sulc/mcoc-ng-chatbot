import {
  Message,
  Attachment,
  MessageReaction,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import { DateTime } from "luxon";

// Constants for better readability and maintenance
export const MAX_INPUT_CHARS = 100000;
export const EMBED_DESCRIPTION_LIMIT = 4096;

// Helper function to parse timeframe strings like "4h", "2d", "today", "yesterday", "lastweek"
export function parseTimeframe(timeframeStr: string): DateTime | null {
  const now = DateTime.now();
  const lowerTimeframeStr = timeframeStr.toLowerCase();

  if (lowerTimeframeStr === "today") {
    return now.startOf("day");
  }
  if (lowerTimeframeStr === "yesterday") {
    return now.minus({ days: 1 }).startOf("day");
  }
  if (lowerTimeframeStr === "lastweek" || lowerTimeframeStr === "last_week") {
    // Luxon's week starts on Monday
    return now.startOf("week").minus({ weeks: 1 });
  }

  const match = lowerTimeframeStr.match(/^(\d+)([hdwmy])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    const duration: Record<string, number> = {};
    switch (unit) {
      case "m":
        duration["minutes"] = value;
        break;
      case "h":
        duration["hours"] = value;
        break;
      case "d":
        duration["days"] = value;
        break;
      case "w":
        duration["weeks"] = value;
        break;
      case "y":
        duration["years"] = value;
        break;
      default:
        return null;
    }
    return now.minus(duration);
  }

  const parsedDate = DateTime.fromISO(timeframeStr);
  if (parsedDate.isValid) {
    return parsedDate;
  }

  return null;
}

/**
 * Fetches all messages from a channel after a specific time.
 * @param channel The channel to fetch messages from.
 * @param afterTime The date to fetch messages after.
 * @returns A promise that resolves to an array of messages.
 */
export async function fetchMessages(
  channel: TextChannel | ThreadChannel,
  afterTime: DateTime
): Promise<Message[]> {
  const allMessages: Message[] = [];
  let lastId: string | undefined;
  const afterTimestamp = afterTime.toMillis();

  while (true) {
    const messages = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });

    if (messages.size === 0) {
      break;
    }

    let shouldBreak = false;
    for (const message of messages.values()) {
      if (message.createdTimestamp >= afterTimestamp) {
        allMessages.push(message);
      } else {
        // Messages are generally sorted by time, so we can stop fetching.
        shouldBreak = true;
      }
    }

    if (shouldBreak) {
      break;
    }

    lastId = messages.last()?.id;
  }

  return allMessages;
}

/**
 * Formats an array of messages into a history format for the LLM.
 * @param messages The messages to format.
 * @returns A formatted message history array.
 */
export function formatMessageHistory(
  messages: Message[]
): { role: string; content: string }[] {
  const messageHistory: { role: string; content: string }[] = [];

  // Sort messages chronologically (oldest to newest)
  const sortedMessages = messages.sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp
  );

  for (const message of sortedMessages) {
    if (message.author.bot) continue;

    let msgContent = `${message.author.displayName}: ${message.content}`;

    if (message.attachments.size > 0) {
      const attachmentDescriptions = message.attachments
        .map((att: Attachment) => {
          if (att.contentType?.startsWith("image/")) {
            return "[Image attached]";
          }
          return `[Attachment: ${att.name}]`;
        })
        .join(" ");
      msgContent += ` ${attachmentDescriptions}`;
    }

    if (message.reactions.cache.size > 0) {
      const reactionSummaries = message.reactions.cache
        .map(
          (reaction: MessageReaction) =>
            `${reaction.emoji.toString()} x${reaction.count}`
        )
        .join(", ");
      if (reactionSummaries.length > 0) {
        msgContent += ` [${reactionSummaries}]`;
      }
    }

    messageHistory.push({
      role: "user",
      content: msgContent,
    });
  }

  return messageHistory;
}

/**
 * Truncates message history if it exceeds the maximum character limit.
 * @param messageHistory The message history to truncate.
 * @returns An object containing the truncated history and a warning message.
 */
export function truncateHistory(messageHistory: { role: string; content: string }[]): {
  truncatedHistory: { role: string; content: string }[];
  truncationWarning: string;
} {
  const totalConversationLength = messageHistory.reduce(
    (sum, msg) => sum + msg.content.length,
    0
  );

  if (totalConversationLength <= MAX_INPUT_CHARS) {
    return { truncatedHistory: messageHistory, truncationWarning: "" };
  }

  let truncatedHistory: { role: string; content: string }[] = [];
  let currentChars = 0;

  // Iterate backwards from the most recent message
  for (let i = messageHistory.length - 1; i >= 0; i--) {
    const msg = messageHistory[i];
    if (currentChars + msg.content.length <= MAX_INPUT_CHARS) {
      truncatedHistory.unshift(msg); // Add to the beginning to maintain order
      currentChars += msg.content.length;
    } else {
      break;
    }
  }

  const truncationWarning = `Warning: Conversation history was too long (${totalConversationLength} chars) and was truncated to the last ${truncatedHistory.length} relevant messages (${currentChars} chars) for summarization.\n`;

  return { truncatedHistory, truncationWarning };
}
