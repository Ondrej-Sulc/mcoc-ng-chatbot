import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from "discord.js";
import { Command } from "../types/command";
import { config } from "../config";
import { PrismaClient } from "@prisma/client";
import { getAllAbilities, getAllTags, getChampionByName, getChampionNames, loadChampions } from "../services/championService";

const prisma = new PrismaClient();
const authorizedUsers = config.DEV_USER_IDS || [];

async function handleEditTag(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const championName = interaction.options.getString("champion", true);
  const action = interaction.options.getString("action", true);
  const tagName = interaction.options.getString("name", true);
  const category = interaction.options.getString("category", true);

  const champion = getChampionByName(championName);
  if (!champion) {
    await interaction.editReply({ content: `Champion 
${championName}
 not found.` });
    return;
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  const confirmationMessage = `Are you sure you want to **${action}** the tag **${tagName}** (
${category}
) for **${champion.name}**?`;

  await interaction.editReply({ content: confirmationMessage, components: [row] });

  try {
    const confirmation = await interaction.channel?.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60000,
    });

    if (confirmation?.customId === "confirm") {
      if (action === "add") {
        await prisma.champion.update({
          where: { id: champion.id },
          data: {
            tags: {
              connectOrCreate: {
                where: { name_category: { name: tagName, category } },
                create: { name: tagName, category },
              },
            },
          },
        });
        await interaction.editReply({ content: `Tag 
${tagName}
 (
${category}
) added to 
${champion.name}
.`, components: [] });
      } else if (action === "remove") {
        await prisma.champion.update({
          where: { id: champion.id },
          data: {
            tags: {
              disconnect: {
                name_category: { name: tagName, category },
              },
            },
          },
        });
        await interaction.editReply({ content: `Tag 
${tagName}
 (
${category}
) removed from 
${champion.name}
.`, components: [] });
      }
    } else {
      await interaction.editReply({ content: "Action cancelled.", components: [] });
    }
  } catch (error) {
    await interaction.editReply({ content: "Confirmation not received within 1 minute, cancelling.", components: [] });
  }
}

async function handleEditAbility(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const championName = interaction.options.getString("champion", true);
  const action = interaction.options.getString("action", true);
  const abilityName = interaction.options.getString("ability", true);
  const type = interaction.options.getString("type", true) as "ABILITY" | "IMMUNITY";
  const source = interaction.options.getString("source");

  const champion = getChampionByName(championName);
  if (!champion) {
    await interaction.editReply({ content: `Champion 
${championName}
 not found.` });
    return;
  }

  const ability = await prisma.ability.findUnique({ where: { name: abilityName } });
  if (!ability) {
    await interaction.editReply({ content: `Ability 
${abilityName}
 not found.` });
    return;
  }

  const confirmButton = new ButtonBuilder()
    .setCustomId("confirm")
    .setLabel("Confirm")
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new ButtonBuilder()
    .setCustomId("cancel")
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirmButton, cancelButton);

  const confirmationMessage = `Are you sure you want to **${action}** the ability **${abilityName}** (${type}) for **${champion.name}**?${source ? `\nSource: ${source}` : ''}`;

  await interaction.editReply({ content: confirmationMessage, components: [row] });

  try {
    const confirmation = await interaction.channel?.awaitMessageComponent({
      filter: (i) => i.user.id === interaction.user.id,
      componentType: ComponentType.Button,
      time: 60000,
    });

    if (confirmation?.customId === "confirm") {
      if (action === "add") {
        await prisma.championAbilityLink.create({
          data: {
            championId: champion.id,
            abilityId: ability.id,
            type: type,
            source: source,
          },
        });
        await interaction.editReply({ content: `Ability 
${abilityName}
 (${type}) added to 
${champion.name}
${source ? ` with source 
${source}
` : ''}.`, components: [] });
      } else if (action === "remove") {
        await prisma.championAbilityLink.deleteMany({
          where: {
            championId: champion.id,
            abilityId: ability.id,
            type: type,
          },
        });
        await interaction.editReply({ content: `Ability 
${abilityName}
 (
${type}
) removed from 
${champion.name}
.`, components: [] });
      }
    } else {
      await interaction.editReply({ content: "Action cancelled.", components: [] });
    }
  } catch (error) {
    await interaction.editReply({ content: "Confirmation not received within 1 minute, cancelling.", components: [] });
  }
}

async function handleReloadCache(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  await loadChampions();
  await interaction.editReply({ content: "Champion cache reloaded." });
}

async function handleViewChampion(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const championName = interaction.options.getString("champion", true);
  const champion = getChampionByName(championName);
  if (!champion) {
    await interaction.editReply({ content: `Champion 
${championName}
 not found.` });
    return;
  }

  const championWithDetails = await prisma.champion.findUnique({
    where: { id: champion.id },
    include: {
      tags: true,
      abilities: {
        include: {
          ability: true,
        },
      },
    },
  });

  if (!championWithDetails) {
    await interaction.editReply({ content: `Champion 
${championName}
 not found in database.` });
    return;
  }

  const tags = championWithDetails.tags.map(tag => `
${tag.name}
 (Category: 
${tag.category}
)`).join(", ");
  const abilities = championWithDetails.abilities.filter(a => a.type === 'ABILITY').map(a => a.ability.name).join(", ");
  const immunities = championWithDetails.abilities.filter(a => a.type === 'IMMUNITY').map(a => a.ability.name).join(", ");

  const embed = {
    title: `Details for 
${championWithDetails.name}`,
    fields: [
      { name: "Tags", value: tags || "None" },
      { name: "Abilities", value: abilities || "None" },
      { name: "Immunities", value: immunities || "None" },
    ],
  };

  await interaction.editReply({ embeds: [embed] });
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("champion-admin")
    .setDescription("Commands for managing champion details.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit-tag")
        .setDescription("Add or remove a tag from a champion.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The champion to edit.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("The action to perform.")
            .setRequired(true)
            .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })
        )
        .addStringOption((option) =>
          option.setName("name").setDescription("The name of the tag.").setRequired(true).setAutocomplete(true)
        )
        .addStringOption((option) =>
          option.setName("category").setDescription("The category of the tag.").setRequired(true).setAutocomplete(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("edit-ability")
        .setDescription("Add or remove an ability from a champion.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The champion to edit.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("action")
            .setDescription("The action to perform.")
            .setRequired(true)
            .addChoices({ name: "Add", value: "add" }, { name: "Remove", value: "remove" })
        )
        .addStringOption((option) =>
          option
            .setName("ability")
            .setDescription("The name of the ability.")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption((option) =>
          option
            .setName("type")
            .setDescription("The type of the ability link.")
            .setRequired(true)
            .addChoices({ name: "Ability", value: "ABILITY" }, { name: "Immunity", value: "IMMUNITY" })
        )
        .addStringOption((option) =>
          option
            .setName("source")
            .setDescription("The source of the ability.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("reload-cache")
        .setDescription("Reloads the champion cache from the database.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View a champion's details.")
        .addStringOption((option) =>
          option
            .setName("champion")
            .setDescription("The champion to view.")
            .setRequired(true)
            .setAutocomplete(true)
        )
    ),
  async execute(interaction: ChatInputCommandInteraction) {
    if (authorizedUsers.length === 0 || !authorizedUsers.includes(interaction.user.id)) {
      await interaction.reply({ content: "You are not authorized to use this command.", flags: [MessageFlags.Ephemeral] });
      return;
    }

    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "edit-tag") {
      await handleEditTag(interaction);
    } else if (subcommand === "edit-ability") {
      await handleEditAbility(interaction);
    } else if (subcommand === "reload-cache") {
      await handleReloadCache(interaction);
    } else if (subcommand === "view") {
      await handleViewChampion(interaction);
    }
  },
  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedOption = interaction.options.getFocused(true);
    let choices: string[] = [];

    if (focusedOption.name === 'champion') {
        choices = getChampionNames();
    } else if (focusedOption.name === 'name' || focusedOption.name === 'category') {
        const championName = interaction.options.getString('champion');
        const action = interaction.options.getString('action');

        if (action === 'add') {
            const allTags = await getAllTags();
            if (focusedOption.name === 'name') {
                choices = [...new Set(allTags.map(tag => tag.name))];
            } else { // category
                choices = [...new Set(allTags.map(tag => tag.category))];
            }
        } else if (action === 'remove' && championName) {
            const champion = getChampionByName(championName);
            if (champion) {
                const championWithTags = await prisma.champion.findUnique({
                    where: { id: champion.id },
                    include: { tags: true },
                });
                if (championWithTags) {
                    if (focusedOption.name === 'name') {
                        choices = championWithTags.tags.map(tag => tag.name);
                    } else { // category
                        choices = championWithTags.tags.map(tag => tag.category);
                    }
                }
            }
        }
    } else if (focusedOption.name === 'ability') {
        const championName = interaction.options.getString('champion');
        const action = interaction.options.getString('action');

        if (action === 'add') {
            const allAbilities = await getAllAbilities();
            choices = allAbilities.map(ability => ability.name);
        } else if (action === 'remove' && championName) {
            const champion = getChampionByName(championName);
            if (champion) {
                const championWithAbilities = await prisma.champion.findUnique({
                    where: { id: champion.id },
                    include: { abilities: { include: { ability: true } } },
                });
                if (championWithAbilities) {
                    choices = championWithAbilities.abilities.map(link => link.ability.name);
                }
            }
        }
    }

    const filtered = choices.filter((choice) => choice.toLowerCase().startsWith(focusedOption.value.toLowerCase()));
    await interaction.respond(
      filtered.slice(0, 25).map((choice) => ({ name: choice, value: choice }))
    );
  },
};
