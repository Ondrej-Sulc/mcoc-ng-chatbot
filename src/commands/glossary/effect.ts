import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from "discord.js";
import { AbilityCategory, Champion, ChampionAbilityLink } from "@prisma/client";
import { prisma } from "../../services/prismaService";
import { CommandResult } from "../../types/command";
import { glossaryColors } from "./index";

export async function handleEffect(
  name: string,
  resolveEmoji: (text: string) => string,
  userId: string,
  categoryName?: string // for the back button
): Promise<CommandResult> {
  const effect = await prisma.ability.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    include: {
      categories: true,
      champions: {
        include: {
          champion: true,
        },
      },
    },
  });

  const player = await prisma.player.findFirst({
    where: { discordId: userId },
    include: { roster: true },
  });

  const container = new ContainerBuilder();
  container.setAccentColor(glossaryColors.containers.effect);

  if (!effect) {
    const notFound = new TextDisplayBuilder().setContent(
      `Effect "${name}" not found.`
    );
    container.addTextDisplayComponents(notFound);
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
  }

  const typedChampions = effect.champions as (ChampionAbilityLink & {
    champion: Champion;
  })[];

  const abilityChamps = [
    ...new Map(
      typedChampions
        .filter((c) => c.type === "ABILITY")
        .map((item) => [item.championId, item])
    ).values(),
  ].sort((a, b) => a.champion.name.localeCompare(b.champion.name));

  const immunityChamps = [
    ...new Map(
      typedChampions
        .filter((c) => c.type === "IMMUNITY")
        .map((item) => [item.championId, item])
    ).values(),
  ].sort((a, b) => a.champion.name.localeCompare(b.champion.name));

  const title = new TextDisplayBuilder().setContent(
    `# ${effect.emoji ? `${resolveEmoji(effect.emoji)} ` : ""}${effect.name}`
  );
  container.addTextDisplayComponents(title);

  if (effect.description) {
    const description = new TextDisplayBuilder().setContent(
      `## *${effect.description}*`
    );
    container.addTextDisplayComponents(description);
  } else {
    const noDescription = new TextDisplayBuilder().setContent(
      "No description available."
    );
    container.addTextDisplayComponents(noDescription);
  }

  if (effect.champions.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const displayChampionEmojis = (
      champions: (ChampionAbilityLink & { champion: Champion })[],
      container: ContainerBuilder,
      resolveEmoji: (text: string) => string
    ) => {
      const championEmojis = champions
        .map((link) => resolveEmoji(link.champion.discordEmoji || ""))
        .filter(Boolean);

      if (championEmojis.length > 0) {
        const limit = 50;
        let emojiContent = "## " + championEmojis.slice(0, limit).join(" ");

        if (championEmojis.length > limit) {
          emojiContent += `\n*...and ${
            championEmojis.length - limit
          } more. Use the search button to see all.*`;
        }
        const emojiDisplay = new TextDisplayBuilder().setContent(emojiContent);
        container.addTextDisplayComponents(emojiDisplay);
      }
    };

    if (abilityChamps.length > 0) {
      const championsTitle = new TextDisplayBuilder().setContent(
        "## Champions with this effect"
      );
      container.addTextDisplayComponents(championsTitle);
      displayChampionEmojis(abilityChamps, container, resolveEmoji);

      const searchButtons = new ActionRowBuilder<ButtonBuilder>();
      searchButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`glossary_search_ability_${effect.name}`)
          .setLabel("🔍 Search for this ability")
          .setStyle(glossaryColors.buttons.search)
      );
      if (player && player.roster.length > 0) {
        searchButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`glossary_roster_search_ability_${effect.name}`)
            .setLabel("🔍 Search in my Roster")
            .setStyle(glossaryColors.buttons.search)
        );
      }
      container.addActionRowComponents(searchButtons);
    }

    if (immunityChamps.length > 0) {
      if (abilityChamps.length > 0) {
        container.addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
      }
      const immunitiesTitle = new TextDisplayBuilder().setContent(
        "## Champions immune to this effect"
      );
      container.addTextDisplayComponents(immunitiesTitle);
      displayChampionEmojis(immunityChamps, container, resolveEmoji);

      const searchImmunitiesButtons = new ActionRowBuilder<ButtonBuilder>();
      searchImmunitiesButtons.addComponents(
        new ButtonBuilder()
          .setCustomId(`glossary_search_immunity_${effect.name}`)
          .setLabel("🔍 Search for this immunity")
          .setStyle(glossaryColors.buttons.search)
      );
      if (player && player.roster.length > 0) {
        searchImmunitiesButtons.addComponents(
          new ButtonBuilder()
            .setCustomId(`glossary_roster_search_immunity_${effect.name}`)
            .setLabel("🔍 Search in my Roster")
            .setStyle(glossaryColors.buttons.search)
        );
      }
      container.addActionRowComponents(searchImmunitiesButtons);
    }
  }

  if (effect.categories.length > 0) {
      container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
      );
      const categoriesTitle = new TextDisplayBuilder().setContent("## Categories");
      container.addTextDisplayComponents(categoriesTitle);

      for (const category of effect.categories as AbilityCategory[]) {
        const catDesc = new TextDisplayBuilder().setContent(
          `*${category.description || "No description available."}*`
        );
        container.addTextDisplayComponents(catDesc);
        
        const button = new ButtonBuilder()
          .setCustomId(`glossary_category_${category.name}`)
          .setLabel(category.name)
          .setStyle(glossaryColors.buttons.category);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
        container.addActionRowComponents(row);

      }
    }

  const backButtonBuilder = new ButtonBuilder().setStyle(
    glossaryColors.buttons.navigation
  );

  if (categoryName) {
    backButtonBuilder
      .setCustomId(`glossary_back_category_${categoryName}`)
      .setLabel(`Back to ${categoryName}`);
  } else {
    backButtonBuilder
      .setCustomId("glossary_list_back")
      .setLabel("Go to Category List");
  }

  const backButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    backButtonBuilder
  );

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addActionRowComponents(backButton);

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
