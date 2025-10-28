import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ChannelType,
  TextChannel,
  AutocompleteInteraction,
  ThreadChannel,
  MessageFlags,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleSummarize } from "./handlers";
import { handleError, safeReply } from "../../utils/errorHandler";

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
  access: CommandAccess.PUBLIC,

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
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

      const result = await handleSummarize({
        channel,
        timeframe,
        language,
        customPrompt,
      });

      // If there are embeds, the content (truncation warning) is sent with the first embed.
      if (result.embeds && result.embeds.length > 0) {
        await interaction.editReply({
          content: result.content || undefined,
          embeds: [result.embeds.shift()!],
        });
        // Send remaining embeds as follow-ups
        for (const embed of result.embeds) {
          await interaction.followUp({
            embeds: [embed],
            flags: [MessageFlags.Ephemeral],
          });
        }
      } else if (result.content) {
        // If only content exists (e.g., an error message from core)
        await interaction.editReply({ content: result.content });
      } else {
        // Fallback for the unlikely case that core returns nothing.
        await interaction.editReply({ content: "Nothing to summarize." });
      }
    } catch (error) {
      const { userMessage } = handleError(error, {
        location: "summarize.execute",
        userId: interaction.user.id,
      });
      await safeReply(interaction, userMessage);
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
