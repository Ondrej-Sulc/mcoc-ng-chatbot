import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  EmbedBuilder,
  Message,
  Attachment,
  MessageReaction,
  AutocompleteInteraction,
  ThreadChannel,
  MessageFlags,
} from "discord.js";
import { getLLMSummary } from "../utils/openRouterService";
import { handleError, safeReply } from "../utils/errorHandler";
import { Command, CommandResult } from "../types/command";

// Constants for better readability and maintenance
const MAX_INPUT_CHARS = 100000;
const EMBED_DESCRIPTION_LIMIT = 4096;

interface SummarizeParams {
  channel: TextChannel | ThreadChannel;
  timeframe: string;
  language: string;
  userId: string;
  customPrompt?: string;
}

// Helper function to parse timeframe strings like "4h", "2d", "today", "yesterday", "lastweek"
function parseTimeframe(timeframeStr: string): Date | null {
  const now = new Date();
  const lowerTimeframeStr = timeframeStr.toLowerCase();

  if (lowerTimeframeStr === "today") {
    now.setHours(0, 0, 0, 0);
    return now;
  } else if (lowerTimeframeStr === "yesterday") {
    now.setDate(now.getDate() - 1);
    now.setHours(0, 0, 0, 0);
    return now;
  } else if (
    lowerTimeframeStr === "lastweek" ||
    lowerTimeframeStr === "last_week"
  ) {
    const today = new Date(now); // Create a copy
    const dayOfWeek = today.getDay(); // 0 for Sunday, 1 for Monday
    const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Days since last Monday
    today.setDate(today.getDate() - daysSinceMonday); // Go to current week's Monday
    today.setDate(today.getDate() - 7); // Go to previous week's Monday
    today.setHours(0, 0, 0, 0);
    return today;
  }

  const match = lowerTimeframeStr.match(/^(\d+)([hdwmy])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "m": // minutes
        now.setMinutes(now.getMinutes() - value);
        break;
      case "h": // hours
        now.setHours(now.getHours() - value);
        break;
      case "d": // days
        now.setDate(now.getDate() - value);
        break;
      case "w": // weeks
        now.setDate(now.getDate() - value * 7);
        break;
      case "y": // years
        now.setFullYear(now.getFullYear() - value);
        break;
      default:
        return null;
    }
    return now;
  }

  try {
    const parsedDate = new Date(timeframeStr);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  } catch (e) {
    // Fallback to null if parsing fails
  }

  return null;
}

/**
 * Fetches all messages from a channel after a specific time.
 * @param channel The channel to fetch messages from.
 * @param afterTime The date to fetch messages after.
 * @returns A promise that resolves to an array of messages.
 */
async function fetchMessages(
  channel: TextChannel | ThreadChannel,
  afterTime: Date
): Promise<Message[]> {
  const allMessages: Message[] = [];
  let lastId: string | undefined;
  const afterTimestamp = afterTime.getTime();

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
function formatMessageHistory(
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
function truncateHistory(
  messageHistory: { role: string; content: string }[]
): {
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

export async function core(params: SummarizeParams): Promise<CommandResult> {
  const { channel, timeframe, language, userId, customPrompt } = params;

  try {
    const afterTime = parseTimeframe(timeframe);
    if (!afterTime) {
      return {
        content: `Invalid timeframe format: \`${timeframe}\`. Please use formats like '4h', '2d', 'today', 'yesterday', 'lastweek', or a specific date (e.g., '2023-01-15').`,
      };
    }

    const fetchedMessages = await fetchMessages(channel, afterTime);

    if (fetchedMessages.length === 0) {
      return {
        content: `No messages found in ${channel.toString()} within the specified timeframe.`,
      };
    }

    let messageHistory = formatMessageHistory(fetchedMessages);

    if (messageHistory.length === 0) {
      return {
        content: `No non-bot messages found in ${channel.toString()} within the specified timeframe.`,
      };
    }

    const { truncatedHistory, truncationWarning } =
      truncateHistory(messageHistory);
    messageHistory = truncatedHistory;

    const summaryPromptTemplate =
      customPrompt ||
      `You're an alliance mate in an MCOC Discord server. Write a friendly, casual summary of the following conversation, like you're catching up another member. Highlight the main topics, any decisions, and important questions. If there are any clear actions or follow-ups, mention them at the end. Keep it brief, upbeat, and easy to read. Write the summary in ${language}.\n\nHere is the conversation:\n\n`;

    const summary = await getLLMSummary(messageHistory, summaryPromptTemplate);

    if (summary.startsWith("Error:")) {
      return { content: `Error generating summary: ${summary}` };
    }

    const summaryChunks: string[] = [];
    for (let i = 0; i < summary.length; i += EMBED_DESCRIPTION_LIMIT) {
      summaryChunks.push(summary.substring(i, i + EMBED_DESCRIPTION_LIMIT));
    }

    const embeds: EmbedBuilder[] = [];
    for (let i = 0; i < summaryChunks.length; i++) {
      const chunk = summaryChunks[i];
      const title = `Summary of ${channel.name}${
        summaryChunks.length > 1 ? ` (continued ${i + 1})` : ""
      }`;
      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(chunk)
        .setColor(0x0099ff)
        .setFooter({ text: `Timeframe: ${timeframe} | Generated by AI` });
      embeds.push(embed);
    }

    return { embeds, content: truncationWarning };
  } catch (error) {
    const { userMessage } = handleError(error, {
      location: "command:summarize:core",
      userId: userId,
    });
    return { content: userMessage };
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("summarize")
    .setDescription("Summarizes recent messages in a channel/thread.")
    .addStringOption((option) =>
      option
        .setName("timeframe")
        .setDescription(
          "How far back to look (e.g., '4h', '2d', 'today', 'yesterday', 'lastweek')."
        )
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addChannelOption((option) =>
      option
        .setName("channel")
        .setDescription(
          "The channel to summarize. Defaults to current channel."
        )
        .setRequired(false)
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.PublicThread,
          ChannelType.PrivateThread,
          ChannelType.AnnouncementThread
        )
    )
    .addStringOption((option) =>
      option
        .setName("language")
        .setDescription("Language for the summary (default: English).")
        .setAutocomplete(true)
    )
    .addStringOption((option) =>
      option
        .setName("custom_prompt")
        .setDescription(
          "Custom prompt for the summarization. Overrides the default prompt."
        )
        .setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    const timeframe = interaction.options.getString("timeframe", true);
    const channelOption =
      interaction.options.getChannel("channel") ?? interaction.channel;

    if (
      !channelOption ||
      !(
        channelOption instanceof TextChannel ||
        channelOption instanceof ThreadChannel
      )
    ) {
      await interaction.editReply({
        content: "I can only summarize messages in text channels or threads.",
      });
      return;
    }
    const channel = channelOption;

    const language = interaction.options.getString("language") || "English";
    const customPrompt =
      interaction.options.getString("custom_prompt") || undefined;

    try {
      const result = await core({
        channel,
        timeframe,
        language,
        customPrompt,
        userId: interaction.user.id,
      });

      // If there are embeds, the content (truncation warning) is sent with the first embed.
      if (result.embeds && result.embeds.length > 0) {
        await interaction.editReply({
          content: result.content || undefined,
          embeds: [result.embeds.shift()!],
        });
        // Send remaining embeds as follow-ups
        for (const embed of result.embeds) {
          await interaction.followUp({ embeds: [embed], flags: [MessageFlags.Ephemeral] });
        }
      } else if (result.content) {
        // If only content exists (e.g., an error message from core)
        await interaction.editReply({ content: result.content });
      } else {
        // Fallback for the unlikely case that core returns nothing.
        await interaction.editReply({ content: "Nothing to summarize." });
      }
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:summarize",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    let choices: { name: string; value: string }[] = [];

    if (focusedOption.name === "timeframe") {
      choices = [
        { name: "Last 4 hours", value: "4h" },
        { name: "Last 12 hours", value: "12h" },
        { name: "Last 24 hours", value: "24h" },
        { name: "Today", value: "today" },
        { name: "Yesterday", value: "yesterday" },
        { name: "Last week (Monday to Sunday)", value: "lastweek" },
        { name: "Last 2 days", value: "2d" },
        { name: "Last 7 days", value: "7d" },
      ];
    } else if (focusedOption.name === "language") {
      choices = [
        { name: "English", value: "English" },
        { name: "Czech", value: "Czech" },
        { name: "Slovak", value: "Slovak" },
      ];
    }

    const filtered = choices.filter((choice) =>
      choice.name.toLowerCase().includes(focusedOption.value.toLowerCase())
    );
    await interaction.respond(filtered.slice(0, 25));
  },
};