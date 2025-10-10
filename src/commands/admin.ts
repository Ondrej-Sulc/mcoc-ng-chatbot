import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, AutocompleteInteraction } from 'discord.js';
import { Command } from '../types/command';
import { championAdminHelper } from '../utils/championAdminHelper';
import { config } from '../config';
import { championsByName } from '../services/championService';

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
            .addStringOption(option => option.setName('primary_image').setDescription('URL of the new primary image.').setRequired(true))
            .addStringOption(option => option.setName('secondary_image').setDescription('URL of the new secondary image.').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('sync-sheet')
            .setDescription('Syncs the champion database with Google Sheets.')
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
      } else if (subcommand === 'sync-sheet') {
        await interaction.deferReply({ ephemeral: true });
        await championAdminHelper.syncSheet(interaction);
      }
    }
  },
  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === 'update_images') {
        const champions = Array.from(championsByName.values());
        const filtered = champions.filter(champion => champion.name.toLowerCase().includes(focusedValue.toLowerCase()));
        await interaction.respond(
            filtered.map(champion => ({ name: champion.name, value: champion.name })).slice(0, 25)
        );
    }
  },
};
