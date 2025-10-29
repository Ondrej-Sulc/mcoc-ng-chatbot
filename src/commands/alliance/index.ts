import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { handleAllianceToggleFeature } from './toggle-feature';
import { handleAllianceJoin } from './join';
import { handleAqSchedule } from './aq_schedule';
import { handleAqSkip } from './aq_skip';
import { handleAllianceName } from './name';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alliance')
    .setDescription('Manage your alliance settings.')
    .addSubcommandGroup(group =>
      group
        .setName('aq_schedule')
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
            .addStringOption(option =>
              option
                .setName('id')
                .setDescription('The ID of the schedule entry to remove.')
                .setRequired(true)
            )
        )
        .addSubcommand(sub =>
          sub
            .setName('view')
            .setDescription('View the current AQ schedule.')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('aq_skip')
        .setDescription('Skip the AQ schedule for a specified duration.')
        .addStringOption(option =>
          option
            .setName('duration')
            .setDescription('The duration to skip for (e.g., 7d, 1w).')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('toggle-feature')
        .setDescription('Enable or disable a feature for your alliance.')
        .addStringOption((option) =>
          option
            .setName('feature')
            .setDescription('The feature to toggle.')
            .setRequired(true)
        )
        .addBooleanOption((option) =>
          option
            .setName('enabled')
            .setDescription('Whether the feature should be enabled or disabled.')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('join')
        .setDescription('Join the alliance associated with this server.')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('name')
        .setDescription("Update your alliance's name.")
        .addStringOption((option) =>
          option
            .setName('name')
            .setDescription('The new name for the alliance.')
            .setRequired(true)
        )
    ),
  access: CommandAccess.USER, // Set base access to USER

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand(true);
    const subcommandGroup = interaction.options.getSubcommandGroup();

    // Admin-only commands
    if (subcommandGroup === 'aq_schedule' || subcommand === 'aq_skip' || subcommand === 'toggle-feature' || subcommand === 'name') {
      const member = interaction.member;
      if (!member || typeof member.permissions === 'string' || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: 'You must be an administrator to use this command.', flags: [MessageFlags.Ephemeral] });
        return;
      }
    }

    if (subcommandGroup === 'aq_schedule') {
      await handleAqSchedule(interaction);
    } else {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      switch (subcommand) {
        case 'toggle-feature':
          await handleAllianceToggleFeature(interaction);
          break;
        case 'join':
          await handleAllianceJoin(interaction);
          break;
        case 'aq_skip':
          await handleAqSkip(interaction);
          break;
        case 'name':
          await handleAllianceName(interaction);
          break;
      }
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);

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
  },
};