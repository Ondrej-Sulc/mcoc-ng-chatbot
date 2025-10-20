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
        distinct: ["championId"],
      },
    },
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

  if (effect.categories.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    const categoriesTitle = new TextDisplayBuilder().setContent("## Categories");
    container.addTextDisplayComponents(categoriesTitle);

    for (const category of effect.categories as AbilityCategory[]) {
      const button = new ButtonBuilder()
        .setCustomId(`glossary_category_${category.name}`)
        .setLabel(category.name.substring(0, 40))
        .setStyle(glossaryColors.buttons.category);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);
      container.addActionRowComponents(row);

      const catDesc = new TextDisplayBuilder().setContent(
        `*${category.description || "No description available."}*`
      );
      container.addTextDisplayComponents(catDesc);
    }
  }

  if (effect.champions.length > 0) {
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
    const championsTitle = new TextDisplayBuilder().setContent("## Champions");
    container.addTextDisplayComponents(championsTitle);

    const championEmojis = (effect.champions as (ChampionAbilityLink & { champion: Champion })[])
      .map((link) => resolveEmoji(link.champion.discordEmoji || ""))
      .filter(Boolean);
    
    if (championEmojis.length > 0) {
        const limit = 100;
        let emojiContent = championEmojis.slice(0, limit).join(" ");

        if (championEmojis.length > limit) {
            emojiContent += `\n*...and ${championEmojis.length - limit} more. Use the search button to see all.*`;
        }
        const emojiDisplay = new TextDisplayBuilder().setContent(emojiContent);
        container.addTextDisplayComponents(emojiDisplay);
    }
  }

  const buttons = new ActionRowBuilder<ButtonBuilder>();
  // if (categoryName) {
  //     buttons.addComponents(
  //         new ButtonBuilder()
  //             .setCustomId(`glossary_back_category_${categoryName}`)
  //             .setLabel("Back to Category")
  //             .setStyle(glossaryColors.buttons.navigation)
  //     );
  // }
  buttons.addComponents(
    new ButtonBuilder()
      .setCustomId(`glossary_search_${effect.name}`)
      .setLabel("Search Champions")
      .setStyle(ButtonStyle.Primary)
  );
  buttons.addComponents(
    new ButtonBuilder()
      .setCustomId("glossary_list_back")
      .setLabel("Back to List")
      .setStyle(glossaryColors.buttons.navigation)
  );
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addActionRowComponents(buttons);

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
