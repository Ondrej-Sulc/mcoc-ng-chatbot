import {
  ChatInputCommandInteraction,
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  Colors,
  SeparatorBuilder,
  SeparatorSpacingSize,
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

function formatRosterEntry(entry: RosterWithChampion, includeMarkdownHeader: boolean = false): string {
  const awakened = entry.isAwakened ? "★" : "☆";
  const ascended = entry.isAscended ? "🏆" : "";
  const emoji = entry.champion.discordEmoji || "";
  const prefix = includeMarkdownHeader ? "### " : "";
  return `${prefix}${emoji} **${entry.champion.name}** \`${entry.stars}* R${entry.rank}${ascended} ${awakened}\`\n`;
}

function paginateRoster(roster: RosterWithChampion[]): RosterWithChampion[][] {
  const pages: RosterWithChampion[][] = [];
  let currentPage: RosterWithChampion[] = [];
  let currentLength = 0;
  const limit = 3600; // 10% buffer from 4000 character limit

  roster.forEach((entry) => {
    const line = formatRosterEntry(entry, false);
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
    const errorContainer = new ContainerBuilder().setAccentColor(Colors.Red);
    const errorText = new TextDisplayBuilder().setContent(
      "This roster view has expired. Please use the command again."
    );
    errorContainer.addTextDisplayComponents(errorText);

    if (interaction instanceof ButtonInteraction) {
      await interaction.update({ components: [errorContainer] });
    } else {
      await interaction.editReply({
        components: [errorContainer],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }
    return;
  }

  const { player, pages } = cached;
  const currentPageData = pages[page - 1];

  const resolveEmojis = createEmojiResolver(interaction.client);
  let response = "";
  currentPageData.forEach((entry: RosterWithChampion) => {
    response += formatRosterEntry(entry, false);
  });

  const container = new ContainerBuilder();

  const title = new TextDisplayBuilder().setContent(
    `# Roster for ${player.ingameName}`
  );
  container.addTextDisplayComponents(title);

  const rosterContent = new TextDisplayBuilder().setContent(
    resolveEmojis(response)
  );
  container.addTextDisplayComponents(rosterContent);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  const pageIndicator = new TextDisplayBuilder().setContent(
    `*Page ${page} of ${pages.length}*`
  );
  container.addTextDisplayComponents(pageIndicator);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`roster_view:prev:${viewId}:${page}`)
      .setLabel("< Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 1),
    new ButtonBuilder()
      .setCustomId(`roster_view:next:${viewId}:${page}`)
      .setLabel("Next >")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === pages.length)
  );
  container.addActionRowComponents(row);

  if (interaction instanceof ButtonInteraction) {
    await interaction.update({ components: [container] });
  } else {
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
    });
  }
}

async function handleRosterViewPagination(interaction: ButtonInteraction) {
  const [_, direction, viewId, currentPageStr] = interaction.customId.split(":");
  const currentPage = parseInt(currentPageStr, 10);
  const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;

  await sendRosterPage(interaction, viewId, newPage);
}

registerButtonHandler("roster_view", handleRosterViewPagination);

export function setupRosterView(
  roster: RosterWithChampion[],
  player: Player
): string {
  const pages = paginateRoster(roster);
  const viewId = crypto.randomUUID();
  rosterViewCache.set(viewId, { player, pages });
  setTimeout(() => rosterViewCache.delete(viewId), 15 * 60 * 1000); // 15 min expiry
  return viewId;
}
