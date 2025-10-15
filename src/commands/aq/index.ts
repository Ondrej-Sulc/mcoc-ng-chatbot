import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  AutocompleteInteraction,
  GuildBasedChannel,
} from "discord.js";
import { Command } from "../../types/command";
import { handleStart } from "./start";
import { handleEnd } from "./end";
import "./handlers";

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aq")
    .setDescription("Alliance Quest utilities")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new AQ tracker")
        .addIntegerOption((o) =>
          o
            .setName("day")
            .setDescription("Current AQ day (1-4)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(4)
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Select the battlegroup role")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Target channel (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
        .addBooleanOption((o) =>
          o
            .setName("create_thread")
            .setDescription("Create a thread for updates (defaults to false)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End the active AQ tracker in a channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to end (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "role") return;

    const guild = interaction.guild;
    if (!guild) {
      await interaction.respond([]);
      return;
    }

    const query = String(focused.value || "").toLowerCase();

    // Fetch roles from the guild to ensure we have fresh data
    const rolesCollection = await guild.roles.fetch();

    const filteredRoles = rolesCollection
      .filter(
        (r) =>
          !r.managed &&
          r.name !== "@everyone" &&
          r.name.toLowerCase().includes(query)
      )
      .first(25);

    await interaction.respond(
      filteredRoles.map((r) => ({ name: r.name, value: r.id }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "start") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const day = interaction.options.getInteger("day", true);
      const roleId = interaction.options.getString("role", true);
      const createThread =
        interaction.options.getBoolean("create_thread") ?? false;
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Please choose a valid channel.");
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply(
          "This command can only be used in a guild."
        );
        return;
      }

      const role = await guild.roles.fetch(roleId);
      if (!role) {
        await interaction.editReply("Role not found.");
        return;
      }

      const result = await handleStart({
        day,
        roleId,
        channel: targetChannel,
        guild,
        createThread,
        channelName: targetChannel.name,
        roleName: role.name,
      });
      await interaction.editReply(result);
    } else if (sub === "end") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Channel not found.");
        return;
      }

      const result = await handleEnd({
        channel: targetChannel,
        user: interaction.user,
      });
      await interaction.editReply(result);
    }
  },
};

export default command;
