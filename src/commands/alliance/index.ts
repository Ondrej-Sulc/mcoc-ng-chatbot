import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { Command, CommandAccess } from '../../types/command';
import { handleAllianceToggleFeature } from './toggle-feature';
import { handleAllianceJoin } from './join';

import { handleAllianceName } from './name';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('alliance')
    .setDescription('Manage your alliance settings.')


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

    if (subcommand === 'toggle-feature' || subcommand === 'name') {
      const member = interaction.member;
      if (!member || typeof member.permissions === 'string' || !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: 'You must be an administrator to use this command.', flags: [MessageFlags.Ephemeral] });
        return;
      }
    }

    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
    switch (subcommand) {
        case 'toggle-feature':
          await handleAllianceToggleFeature(interaction);
          break;
        case 'join':
          await handleAllianceJoin(interaction);
          break;
        case 'name':
          await handleAllianceName(interaction);
          break;
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
    }
  },
};