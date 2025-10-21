import {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { CommandResult } from "../../types/command";
import { glossaryColors } from "./index";

export async function handleCategory(
  name: string,
  resolveEmoji: (text: string) => string
): Promise<CommandResult> {
  const category = await prisma.abilityCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive",
      },
    },
    include: {
      abilities: {
        take: 25,
        orderBy: {
          name: "asc",
        },
      },
    },
  });

  const container = new ContainerBuilder();
  container.setAccentColor(glossaryColors.containers.category);

  if (!category) {
    const notFound = new TextDisplayBuilder().setContent(
      `Category "${name}" not found.`
    );
    container.addTextDisplayComponents(notFound);
    return {
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    };
  }

  const title = new TextDisplayBuilder().setContent('# ' + category.name);
  container.addTextDisplayComponents(title);
  if (category.description) {
    const description = new TextDisplayBuilder().setContent(
      `*${category.description}*`
    );
    container.addTextDisplayComponents(description);
  }
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (category.abilities.length > 0) {
    const effectsTitle = new TextDisplayBuilder().setContent("## Effects");
    container.addTextDisplayComponents(effectsTitle);

    const components: ActionRowBuilder<ButtonBuilder>[] = [];
    let actionRow = new ActionRowBuilder<ButtonBuilder>();

    category.abilities.forEach((ability, index) => {
      if (index > 0 && index % 5 === 0) {
        components.push(actionRow);
        actionRow = new ActionRowBuilder<ButtonBuilder>();
      }
      const button = new ButtonBuilder()
        .setCustomId(`glossary_effect_${ability.name}_${category.name}`)
        .setLabel(ability.name.substring(0, 40))
        .setStyle(glossaryColors.buttons.effect);

      if (ability.emoji) {
        const emoji = resolveEmoji(ability.emoji);
        if (emoji) {
          button.setEmoji(emoji);
        }
      }
      actionRow.addComponents(button);
    });
    components.push(actionRow);
    components.forEach((row) => container.addActionRowComponents(row));
  }

  const backButton = new ButtonBuilder()
    .setCustomId("glossary_list_back")
    .setLabel("Back to Category List")
    .setStyle(glossaryColors.buttons.navigation);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );
  container.addActionRowComponents(row);

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
