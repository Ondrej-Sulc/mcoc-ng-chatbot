import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { Command } from '../types/command';
import { championAdminHelper } from '../utils/championAdminHelper';
import { config } from '../config';
import { championsByName } from '../services/championService';
import { AbilityLinkType } from '@prisma/client';

const authorizedUsers = config.DEV_USER_IDS || [];

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative commands.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommandGroup(group =>
      group
        .setName('champion')
        .setDescription('Admin commands for managing champions.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Adds a new champion to the database.')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('update_images')
            .setDescription('Updates the images for an existing champion.')
            .addStringOption(option => option.setName('name').setDescription('Name of the champion to update.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('primary_image').setDescription('URL of the new primary image.').setRequired(false))
            .addStringOption(option => option.setName('secondary_image').setDescription('URL of the new secondary image.').setRequired(false))
            .addStringOption(option => option.setName('hero_image').setDescription('URL of the new hero image.').setRequired(false))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('update_tags')
            .setDescription('Updates the tags for an existing champion.')
            .addStringOption(option => option.setName('name').setDescription('Name of the champion to update.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('tags_image').setDescription('URL of the new tags image.').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('sync-sheet')
            .setDescription('Syncs the champion database with Google Sheets.')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('ability')
        .setDescription('Admin commands for managing champion abilities.')
        .addSubcommand(subcommand =>
          subcommand
            .setName('add')
            .setDescription('Adds an ability or immunity to a champion.')
            .addStringOption(option => option.setName('champion').setDescription('Name of the champion.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('type').setDescription('Type of link.').setRequired(true).addChoices(
              { name: 'Ability', value: AbilityLinkType.ABILITY },
              { name: 'Immunity', value: AbilityLinkType.IMMUNITY },
            ))
            .addStringOption(option => option.setName('ability').setDescription('Name of the ability or immunity.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('source').setDescription('Source of the ability (e.g., Signature Ability, SP1, Synergy).').setRequired(false).setAutocomplete(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('Removes an ability or immunity from a champion.')
            .addStringOption(option => option.setName('champion').setDescription('Name of the champion.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('type').setDescription('Type of link to remove.').setRequired(true).addChoices(
              { name: 'Ability', value: AbilityLinkType.ABILITY },
              { name: 'Immunity', value: AbilityLinkType.IMMUNITY },
            ))
            .addStringOption(option => option.setName('ability').setDescription('Name of the ability or immunity.').setRequired(true).setAutocomplete(true))
            .addStringOption(option => option.setName('source').setDescription('Source of the ability.').setRequired(false).setAutocomplete(true))
        )
    ),
  async execute(interaction) {
    if (!interaction.isChatInputCommand()) return;

    if (authorizedUsers.length === 0 || !authorizedUsers.includes(interaction.user.id)) {
        await interaction.reply({ content: 'You are not authorized to use this command.', flags: MessageFlags.Ephemeral });
        return;
    }

    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'champion') {
      if (subcommand === 'add') {
        await championAdminHelper.showChampionModalPart1(interaction);
      } else if (subcommand === 'update_images') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.updateChampionImages(interaction);
      } else if (subcommand === 'update_tags') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.updateChampionTags(interaction);
      } else if (subcommand === 'sync-sheet') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.syncSheet(interaction);
      }
    } else if (group === 'ability') {
      if (subcommand === 'add') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.addChampionAbility(interaction);
      } else if (subcommand === 'remove') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.removeChampionAbility(interaction);
      }
    }
  },
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    const group = interaction.options.getSubcommandGroup();
    const subcommand = interaction.options.getSubcommand();

    if (group === 'champion') {
      if (subcommand === 'update_images' || subcommand === 'update_tags') {
        if (focused.name === 'name') {
          const champions = Array.from(championsByName.values());
          const filtered = champions.filter(champion => champion.name.toLowerCase().includes(focused.value.toLowerCase()));
          await interaction.respond(
              filtered.map(champion => ({ name: champion.name, value: champion.name })).slice(0, 25)
          );
        }
      }
    } else if (group === 'ability') {
      if (focused.name === 'champion') {
        const champions = Array.from(championsByName.values());
        const filtered = champions.filter(champion => champion.name.toLowerCase().includes(focused.value.toLowerCase()));
        await interaction.respond(
            filtered.map(champion => ({ name: champion.name, value: champion.name })).slice(0, 25)
        );
      } else if (focused.name === 'ability') {
        if (subcommand === 'remove') {
          await championAdminHelper.autocompleteChampionAbility(interaction);
        } else {
          await championAdminHelper.autocompleteAllAbilities(interaction);
        }
      } else if (focused.name === 'source') {
        await championAdminHelper.autocompleteSource(interaction);
      }
    }
  },
};
