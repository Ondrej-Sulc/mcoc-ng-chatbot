import {
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MessageFlags,
} from "discord.js";
import { prisma } from "../../services/prismaService";
import { CommandResult } from "../../types/command";
import { glossaryColors } from "./index";

export async function handleList(
  resolveEmoji: (text: string) => string
): Promise<CommandResult> {
  const categories = await prisma.abilityCategory.findMany({
    orderBy: {
      name: "asc",
    },
    take: 25,
  });

  const container = new ContainerBuilder();
  container.setAccentColor(glossaryColors.containers.list);

  const title = new TextDisplayBuilder().setContent("## All Effect Categories");
  const description = new TextDisplayBuilder().setContent(
    "Here is a list of all effect categories. Click a button to see the effects in that category."
  );
  container.addTextDisplayComponents(title, description);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  if (categories.length === 0) {
    const noCategories = new TextDisplayBuilder().setContent(
      "No categories found."
    );
    container.addTextDisplayComponents(noCategories);
    return { components: [container], flags: MessageFlags.IsComponentsV2 };
  }

  const components: ActionRowBuilder<ButtonBuilder>[] = [];
  let actionRow = new ActionRowBuilder<ButtonBuilder>();

  categories.forEach((category, index) => {
    if (index > 0 && index % 5 === 0) {
      components.push(actionRow);
      actionRow = new ActionRowBuilder<ButtonBuilder>();
    }
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`glossary_category_${category.name}`)
        .setLabel(category.name.substring(0, 40))
        .setStyle(glossaryColors.buttons.category)
    );
  });
  components.push(actionRow);

  components.forEach((row) => container.addActionRowComponents(row));

  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}
