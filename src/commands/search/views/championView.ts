import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Guild,
} from "discord.js";
import { createEmojiResolver } from "../../../utils/emojiResolver";
import {
  ChampionWithRelations,
  SearchCoreParams,
} from "../../../types/search";
import { parseAndOrConditions } from "../queryBuilder";
import { getChampionDetailsString, getCriteriaString, CLASS_EMOJIS } from "./common";
import { CommandResult } from "../../../types/command";

export async function generateChampionResponse(
  client: Client,
  guild: Guild | null,
  champions: ChampionWithRelations[],
  searchCriteria: Omit<SearchCoreParams, "userId" | "page" | "searchId">,
  totalChampions: number,
  currentPage: number,
  totalPages: number,
  searchId: string
): Promise<CommandResult> {
  const resolveEmoji = createEmojiResolver(client);
  const container = new ContainerBuilder();

  const parsedSearchCriteria = {
    abilities: parseAndOrConditions(searchCriteria.abilities).conditions.map(
      (c) => c.toLowerCase()
    ),
    immunities: parseAndOrConditions(searchCriteria.immunities).conditions.map(
      (c) => c.toLowerCase()
    ),
    tags: parseAndOrConditions(searchCriteria.tags).conditions.map((c) =>
      c.toLowerCase()
    ),
    abilityCategory: parseAndOrConditions(
      searchCriteria.abilityCategory
    ).conditions.map((c) => c.toLowerCase()),
    attackType: parseAndOrConditions(searchCriteria.attackType).conditions.map(
      (c) => c.toLowerCase()
    ),
  };

  const criteriaString = getCriteriaString(searchCriteria);
  const header = `Found **${totalChampions}** champion(s) matching your criteria.\n${ 
    criteriaString ? `\n${criteriaString}` : ""
  }`;

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(header));
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

  let totalChampString = "";
  champions.forEach(champion => {
    const classEmoji = CLASS_EMOJIS[champion.class];
    const championEmoji = champion.discordEmoji
      ? resolveEmoji(champion.discordEmoji)
      : "";
    let champString = `### ${championEmoji} ${champion.name} ${classEmoji}`;
    const details = getChampionDetailsString(champion, parsedSearchCriteria);
    if (details) {
      champString += `\n${details}`;
    }
    totalChampString += champString + "\n";
  });
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(totalChampString));

  if (totalPages > 1) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`search:prev:${searchId}:${currentPage}`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1),
      new ButtonBuilder()
        .setCustomId(`search:next:${searchId}:${currentPage}`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages)
    );
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
    container.addActionRowComponents(row);
  }

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
