import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { RosterWithChampion } from "../services/rosterService";
import { Player } from "@prisma/client";
import { createEmojiResolver } from "./emojiResolver";
import { registerButtonHandler } from "./buttonHandlerRegistry";
import crypto from "crypto";

const rosterViewCache = new Map<
  string,
  { player: Player; pages: RosterWithChampion[][] }
>();

function paginateRoster(roster: RosterWithChampion[]): RosterWithChampion[][] {
  const pages: RosterWithChampion[][] = [];
  let currentPage: RosterWithChampion[] = [];
  let currentLength = 0;
  const limit = 4000; // Discord embed description limit is 4096

  roster.forEach((entry) => {
    const awakened = entry.isAwakened ? "★" : "☆";
    const ascended = entry.isAscended ? "+" : "";
    const line = `${entry.champion.discordEmoji || ""} ${entry.champion.name} ${entry.stars}* R${entry.rank}${ascended} ${awakened}\n`;
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

export async function sendRosterPage(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  viewId: string,
  page: number
) {
  const cached = rosterViewCache.get(viewId);
  if (!cached) {
    const errorEmbed = new EmbedBuilder()
      .setTitle("Error")
      .setDescription(
        "This roster view has expired. Please use the command again."
      )
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
    const awakened = entry.isAwakened ? "★" : "☆";
    const ascended = entry.isAscended ? "+" : "";
    const emoji = entry.champion.discordEmoji || "";
    response += `${emoji} ${entry.champion.name} ${entry.stars}* R${entry.rank}${ascended} ${awakened}\n`;
  });

  const embed = new EmbedBuilder()
    .setTitle(`Roster for ${player.ingameName}`)
    .setDescription(resolveEmojis(response))
    .setFooter({ text: `Page ${page} of ${pages.length}` });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
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
  const [_, direction, viewId, currentPageStr] = 
    interaction.customId.split(":");
  const currentPage = parseInt(currentPageStr, 10);
  const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

  await sendRosterPage(interaction, viewId, newPage);
}

registerButtonHandler("roster_view", handleRosterViewPagination);

export function setupRosterView(roster: RosterWithChampion[], player: Player): string {
    const pages = paginateRoster(roster);
    const viewId = crypto.randomUUID();
    rosterViewCache.set(viewId, { player, pages });
    setTimeout(() => rosterViewCache.delete(viewId), 15 * 60 * 1000); // 15 min expiry
    return viewId;
}
