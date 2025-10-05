import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  Attachment,
  User,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  AutocompleteInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  AttachmentBuilder,
  ButtonInteraction,
  EmbedBuilder,
} from "discord.js";
import { Command } from "../types/command";

import { processRosterScreenshot, getRoster, deleteRoster, RosterUpdateResult, RosterWithChampion } from "../services/rosterService";
import { PrismaClient, Prisma, Player } from "@prisma/client";
import { createEmojiResolver } from "../utils/emojiResolver";
import { registerButtonHandler } from "../utils/buttonHandlerRegistry";
import crypto from "crypto";

const prisma = new PrismaClient();

const rosterViewCache = new Map<string, { player: Player, pages: RosterWithChampion[][] }>();

function paginateRoster(roster: RosterWithChampion[]): RosterWithChampion[][] {
    const pages: RosterWithChampion[][] = [];
    let currentPage: RosterWithChampion[] = [];
    let currentLength = 0;
    const limit = 4000; // Discord embed description limit is 4096

    roster.forEach(entry => {
        const awakened = entry.isAwakened ? '★' : '☆';
        const ascended = entry.isAscended ? '+' : '';
        const line = `${entry.champion.discordEmoji || ''} ${entry.champion.name} ${entry.stars}* R${entry.rank}${ascended} ${awakened}\n`;
        if (currentLength + line.length > limit) {
            pages.push(currentPage);
            currentPage = [];
            currentLength = 0;
        }
        currentPage.push(entry);
        currentLength += line.length;
    });

    if (currentPage.length > 0) {
        pages.push(currentPage);
    }

    return pages;
}

async function sendRosterPage(interaction: ChatInputCommandInteraction | ButtonInteraction, viewId: string, page: number) {
    const cached = rosterViewCache.get(viewId);
    if (!cached) {
        const errorEmbed = new EmbedBuilder()
            .setTitle("Error")
            .setDescription("This roster view has expired. Please use the command again.")
            .setColor("Red");
        if (interaction instanceof ButtonInteraction) {
            await interaction.update({ embeds: [errorEmbed], components: [] });
        } else {
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
        return;
    }

    const { player, pages } = cached;
    const currentPageData = pages[page - 1];

    const resolveEmojis = createEmojiResolver(interaction.client);
    let response = "";
    currentPageData.forEach((entry: RosterWithChampion) => {
        const awakened = entry.isAwakened ? '★' : '☆';
        const ascended = entry.isAscended ? '+' : '';
        const emoji = entry.champion.discordEmoji || '';
        response += `${emoji} ${entry.champion.name} ${entry.stars}* R${entry.rank}${ascended} ${awakened}\n`;
    });

    const embed = new EmbedBuilder()
        .setTitle(`Roster for ${player.ingameName}`)
        .setDescription(resolveEmojis(response))
        .setFooter({ text: `Page ${page} of ${pages.length}` });

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`roster_view:prev:${viewId}:${page}`)
                .setLabel("Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 1),
            new ButtonBuilder()
                .setCustomId(`roster_view:next:${viewId}:${page}`)
                .setLabel("Next")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === pages.length)
        );

    const replyOptions = {
        embeds: [embed],
        components: [row],
    };

    if (interaction instanceof ButtonInteraction) {
        await interaction.update(replyOptions);
    } else {
        await interaction.editReply(replyOptions);
    }
}

async function handleRosterViewPagination(interaction: ButtonInteraction) {
    const [_, direction, viewId, currentPageStr] = interaction.customId.split(':');
    const currentPage = parseInt(currentPageStr, 10);
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;

    await sendRosterPage(interaction, viewId, newPage);
}

registerButtonHandler('roster_view', handleRosterViewPagination);



async function handleUpdate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars", true);
  const rank = interaction.options.getInteger("rank", true);
  const isAscended = interaction.options.getBoolean("is_ascended") ?? false;
  const playerOption = interaction.options.getUser("player");

  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({ content: `Player ${targetUser.username} is not registered. Please register with /profile register first.` });
    return;
  }

  const images: Attachment[] = [];
  for (let i = 1; i <= 5; i++) {
      const image = interaction.options.getAttachment(`image${i}`);
      if (image) {
          images.push(image);
      }
  }

  if (images.length === 0) {
      await interaction.editReply('You must provide at least one image.');
      return;
  }

  let allAddedChampions: RosterWithChampion[][] = [];
  const errorMessages: string[] = [];

  const promises = images.map(image => 
      processRosterScreenshot(image.url, stars, rank, isAscended, false, player.id)
          .catch(error => {
              return { error: `Error processing ${image.name}: ${error.message}` };
          })
  );

  const results = await Promise.all(promises);

  results.forEach(result => {
      if (result) {
          if ('error' in result && typeof result.error === 'string') {
              errorMessages.push(result.error);
          } else {
              allAddedChampions.push(...(result as RosterUpdateResult).champions);
          }
      }
  });

  const container = new ContainerBuilder();

  const galleryItems = images.map(image => 
      new MediaGalleryItemBuilder()
          .setURL(image.url)
          .setDescription(image.name || 'source image')
  );
  const imageGallery = new MediaGalleryBuilder().addItems(...galleryItems);
  container.addMediaGalleryComponents(imageGallery);

  const title = new TextDisplayBuilder().setContent(`### Roster update for ${player.ingameName} complete. (${stars}* R${rank})`);
  container.addTextDisplayComponents(title);

  const summary = new TextDisplayBuilder().setContent(`Total champions added/updated: ${allAddedChampions.flat().length}`);
  container.addTextDisplayComponents(summary);

  const resolveEmojis = createEmojiResolver(interaction.client);
  let champList = allAddedChampions.map(row => 
      row.map(entry => {
          const awakened = entry.isAwakened ? '★' : '☆';
          const ascended = entry.isAscended ? '+' : '';
          const emoji = entry.champion.discordEmoji || '';
          return `${emoji}${awakened}${ascended}`;
      }).join(' ')
  ).join('\n');

  if (champList) {
      const content = new TextDisplayBuilder().setContent(resolveEmojis(champList));
      container.addTextDisplayComponents(content);
  }

  if (errorMessages.length > 0) {
      const errorContent = new TextDisplayBuilder().setContent(`**Errors:**\n${errorMessages.join('\n')}`);
      container.addTextDisplayComponents(errorContent);
  }

  await interaction.editReply({ 
    components: [container],
    flags: [MessageFlags.IsComponentsV2]
  });
}

async function handleView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const stars = interaction.options.getInteger("stars");
  const rank = interaction.options.getInteger("rank");
  const isAscended = interaction.options.getBoolean("is_ascended");
  const playerOption = interaction.options.getUser("player");

  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({ content: `Player ${targetUser.username} is not registered. Please register with /profile register first.` });
    return;
  }

  const roster = await getRoster(player.id, stars, rank, isAscended);

  if (typeof roster === 'string') {
      await interaction.editReply({ content: roster });
      return;
  }

  const pages = paginateRoster(roster);
  const viewId = crypto.randomUUID();
  rosterViewCache.set(viewId, { player, pages });
  setTimeout(() => rosterViewCache.delete(viewId), 15 * 60 * 1000); // 15 min expiry

  await sendRosterPage(interaction, viewId, 1);
}

async function handleExport(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const playerOption = interaction.options.getUser("player");
  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({ content: `Player ${targetUser.username} is not registered. Please register with /profile register first.` });
    return;
  }

  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster === 'string') {
      await interaction.editReply({ content: roster });
      return;
  }

  let csv = 'Champion,Stars,Rank,IsAwakened,IsAscended\n';
  roster.forEach(entry => {
      csv += `"${entry.champion.name}",${entry.stars},${entry.rank},${entry.isAwakened},${entry.isAscended}\n`;
  });

  const attachment = new AttachmentBuilder(Buffer.from(csv), { name: `${player.ingameName}-roster.csv` });

  await interaction.editReply({
      content: `Roster for ${player.ingameName} exported.`,
      files: [attachment]
  });
}

async function handleSummary(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply();
  const playerOption = interaction.options.getUser("player");
  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({ content: `Player ${targetUser.username} is not registered. Please register with /profile register first.` });
    return;
  }

  const roster = await getRoster(player.id, null, null, null);

  if (typeof roster === 'string') {
      await interaction.editReply({ content: roster });
      return;
  }

  const CLASS_EMOJIS: Record<string, string> = {
    MYSTIC: "<:Mystic:1253449751555215504>",
    MUTANT: "<:Mutant:1253449731284406332>",
    SKILL: "<:Skill:1253449798825279660>",
    SCIENCE: "<:Science:1253449774271696967>",
    COSMIC: "<:Cosmic:1253449702595235950>",
    TECH: "<:Tech:1253449817808703519>",
  };

  const byStar = roster.reduce((acc, champ) => {
      if (!acc[champ.stars]) {
          acc[champ.stars] = [];
      }
      acc[champ.stars].push(champ);
      return acc;
  }, {} as Record<number, RosterWithChampion[]>);

  const container = new ContainerBuilder();
  const title = new TextDisplayBuilder().setContent(`### Roster Summary for ${player.ingameName}\n**Total Champions:** ${roster.length}`);
  container.addTextDisplayComponents(title);

  Object.entries(byStar)
      .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by star level descending
      .forEach(([stars, champions]) => {
          let starSummary = `### ${stars}-Star Champions (${champions.length} total)\n`;

          const byRank = champions.reduce((acc, champ) => {
              acc[champ.rank] = (acc[champ.rank] || 0) + 1;
              return acc;
          }, {} as Record<number, number>);

          starSummary += `**By Rank:** `;
          starSummary += Object.entries(byRank)
              .sort(([a], [b]) => parseInt(b) - parseInt(a)) // Sort by rank descending
              .map(([rank, count]) => `R${rank}: ${count}`)
              .join(' | ');

          const byClass = champions.reduce((acc, champ) => {
              acc[champ.champion.class] = (acc[champ.champion.class] || 0) + 1;
              return acc;
          }, {} as Record<string, number>);

          starSummary += `\n**By Class:** `;
          starSummary += Object.entries(byClass)
              .map(([className, count]) => `${CLASS_EMOJIS[className] || className}${count}`)
              .join(' | ');
          
          const starContent = new TextDisplayBuilder().setContent(starSummary);
          container.addTextDisplayComponents(starContent);
      });

  await interaction.editReply({
    components: [container],
    flags: [MessageFlags.IsComponentsV2]
  });
}

async function handleDelete(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const playerOption = interaction.options.getUser("player");
  const targetUser = playerOption || interaction.user;

  const player = await prisma.player.findUnique({
    where: { discordId: targetUser.id },
  });

  if (!player) {
    await interaction.editReply({ content: `Player ${targetUser.username} is not registered. Please register with /profile register first.` });
    return;
  }

  const championId = interaction.options.getString("champion");
  const stars = interaction.options.getInteger("stars");
  const rank = interaction.options.getInteger("rank");
  const isAscended = interaction.options.getBoolean("is_ascended");

  if (!championId && !stars && !rank && isAscended === null) {
      const row = new ActionRowBuilder<ButtonBuilder>()
          .addComponents(
              new ButtonBuilder()
                  .setCustomId(`roster_delete_all_confirm:${player.id}`)
                  .setLabel('Yes, delete all')
                  .setStyle(ButtonStyle.Danger),
              new ButtonBuilder()
                  .setCustomId('roster_delete_all_cancel')
                  .setLabel('Cancel')
                  .setStyle(ButtonStyle.Secondary),
          );

      await interaction.editReply({ 
          content: `Are you sure you want to delete the entire roster for ${player.ingameName}? This action cannot be undone.`,
          components: [row],
      });
  } else {
      const where: Prisma.RosterWhereInput = {
          playerId: player.id,
      };
      if (championId) {
          where.championId = parseInt(championId, 10);
      }
      if (stars) {
          where.stars = stars;
      }
      if (rank) {
          where.rank = rank;
      }
      if (isAscended !== null) {
          where.isAscended = isAscended;
      }
      const result = await deleteRoster(where);
      await interaction.editReply({ content: `${result} for ${player.ingameName}.` });
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("roster")
    .setDescription("Manage your MCOC roster.")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Update your roster from one or more screenshots.")
        .addIntegerOption((option) => option.setName("stars").setDescription("The star level of the champions in the screenshot.").setRequired(true).setMinValue(1).setMaxValue(7))
        .addIntegerOption((option) => option.setName("rank").setDescription("The rank of the champions in the screenshot.").setRequired(true).setMinValue(1).setMaxValue(5))
        .addAttachmentOption((option) => option.setName("image1").setDescription("A screenshot of your champion roster.").setRequired(true))
        .addBooleanOption((option) => option.setName("is_ascended").setDescription("Whether the champions are ascended.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image2").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image3").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image4").setDescription("Another screenshot.").setRequired(false))
        .addAttachmentOption((option) => option.setName("image5").setDescription("Another screenshot.").setRequired(false))
        .addUserOption((option) => option.setName("player").setDescription("The player to update the roster for (defaults to you).").setRequired(false))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("view")
        .setDescription("View a player's roster.")
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("Filter by star level.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(7)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("Filter by rank.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addBooleanOption((option) =>
          option
            .setName("is_ascended")
            .setDescription("Filter by ascended status.")
            .setRequired(false)
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to view (defaults to you).")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("delete")
        .setDescription("Delete a player's roster, or parts of it.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to delete (defaults to you).")
            .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('champion')
                .setDescription('The champion to delete.')
                .setRequired(false)
                .setAutocomplete(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("stars")
            .setDescription("Filter by star level.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(7)
        )
        .addIntegerOption((option) =>
          option
            .setName("rank")
            .setDescription("Filter by rank.")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(5)
        )
        .addBooleanOption((option) =>
          option
            .setName("is_ascended")
            .setDescription("Filter by ascended status.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("summary")
        .setDescription("Display a summary of a player's roster.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to summarize (defaults to you).")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("export")
        .setDescription("Export a player's roster to a CSV file.")
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("The player whose roster to export (defaults to you).")
            .setRequired(false)
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focusedValue = interaction.options.getFocused();
    const player = await prisma.player.findUnique({
        where: { discordId: interaction.user.id },
    });

    if (!player) {
        await interaction.respond([]);
        return;
    }

    const roster = await prisma.roster.findMany({
        where: {
            playerId: player.id,
            champion: {
                name: {
                    contains: focusedValue,
                    mode: 'insensitive',
                }
            }
        },
        include: { champion: true },
        take: 25,
    });

    await interaction.respond(
        roster.map(entry => ({ name: `${entry.champion.name} ${entry.stars}* R${entry.rank}`, value: entry.championId.toString() }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    if (subcommand === "update") {
      await handleUpdate(interaction);
    } else if (subcommand === "view") {
      await handleView(interaction);
    } else if (subcommand === "delete") {
      await handleDelete(interaction);
    } else if (subcommand === "summary") {
      await handleSummary(interaction);
    } else if (subcommand === "export") {
      await handleExport(interaction);
    }
  },
};