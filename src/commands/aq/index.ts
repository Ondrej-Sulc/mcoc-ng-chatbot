import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  AutocompleteInteraction,
  GuildBasedChannel,
  PermissionsBitField,
} from "discord.js";
import { Command, CommandAccess } from "../../types/command";
import { handleStart } from "./start";
import { handleEnd } from "./end";
import { handleAqSchedule } from "./schedule";
import { handleAqSkip } from "./skip";
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
    )
    .addSubcommandGroup(group =>
      group
        .setName('schedule')
        .setDescription('Manage the automated AQ schedule.')
        .addSubcommand(sub =>
          sub
            .setName('add')
            .setDescription('Add a new entry to the AQ schedule.')
            .addIntegerOption(option =>
              option
                .setName('battlegroup')
                .setDescription('The battlegroup (1, 2, or 3).')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addIntegerOption(option =>
              option
                .setName('day_of_week')
                .setDescription('The day of the week (0=Sun, 1=Mon, ...).')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addStringOption(option =>
              option
                .setName('time')
                .setDescription('The time in your local timezone (HH:mm format).')
                .setRequired(true)
            )
            .addIntegerOption(option =>
              option
                .setName('aq_day')
                .setDescription('The day of the AQ cycle (1-4).')
                .setRequired(true)
                .setAutocomplete(true)
            )
            .addChannelOption(option =>
              option
                .setName('channel')
                .setDescription('The channel to run the command in.')
                .setRequired(true)
            )
            .addStringOption(option =>
              option
                .setName('role')
                .setDescription('The role to tag.')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('remove')
            .setDescription('Remove an entry from the AQ schedule.')
        )
        .addSubcommand(sub =>
          sub
            .setName('view')
            .setDescription('View the current AQ schedule.')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip the AQ schedule for a specified duration.')
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('The duration to skip for (e.g., 7d, 1w).')
            .setRequired(true)
        )
    ),
  access: CommandAccess.USER,
  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === 'schedule') {
        if (focused.name === 'role') {
          const guild = interaction.guild;
          if (!guild) {
            await interaction.respond([]);
            return;
          }

          const query = String(focused.value || '').toLowerCase();

          const rolesCollection = await guild.roles.fetch();

          const filteredRoles = rolesCollection
            .filter(
              (r) =>
                !r.managed &&
                r.name !== '@everyone' &&
                r.name.toLowerCase().includes(query)
            )
            .first(25);

          await interaction.respond(
            filteredRoles.map((r) => ({ name: r.name, value: r.id }))
          );
        } else if (focused.name === 'day_of_week') {
          const days = [
            { name: 'Monday', value: 1 },
            { name: 'Tuesday', value: 2 },
            { name: 'Wednesday', value: 3 },
            { name: 'Thursday', value: 4 },
            { name: 'Friday', value: 5 },
            { name: 'Saturday', value: 6 },
            { name: 'Sunday', value: 0 },
          ];
          await interaction.respond(days);
        } else if (focused.name === 'battlegroup') {
          await interaction.respond([
            { name: 'Battlegroup 1', value: 1 },
            { name: 'Battlegroup 2', value: 2 },
            { name: 'Battlegroup 3', value: 3 },
          ]);
        } else if (focused.name === 'aq_day') {
          await interaction.respond([
            { name: 'Day 1', value: 1 },
            { name: 'Day 2', value: 2 },
            { name: 'Day 3', value: 3 },
            { name: 'Day 4', value: 4 },
          ]);
        }
        return;
    }

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
    const subcommand = interaction.options.getSubcommand(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    if (subcommandGroup === 'schedule' || subcommand === 'skip') {
      const member = interaction.member;
      if (!member || typeof member.permissions === 'string' || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: 'You must be an administrator to use this command.', flags: [MessageFlags.Ephemeral] });
        return;
      }
    }

    if (subcommandGroup === 'schedule') {
      await handleAqSchedule(interaction);
      return;
    }

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
    } else if (sub === 'skip') {
        await handleAqSkip(interaction);
    }
  },
};

export default command;