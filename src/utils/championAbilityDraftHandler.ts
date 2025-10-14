import { prisma } from "../services/prismaService";
import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags, ButtonStyle, ButtonBuilder } from "discord.js";
import logger from "../services/loggerService";
import { openRouterService } from "../services/openRouterService";
import { registerButtonHandler } from "./buttonHandlerRegistry";
import { registerModalHandler } from "./modalHandlerRegistry";

export const pendingDrafts = new Map<string, any>();

export async function handleConfirmAbilityDraft(
  interaction: ButtonInteraction
) {
  try {
    const championId = parseInt(interaction.customId.split("_")[1]);
    const draft = pendingDrafts.get(championId.toString());

    if (!draft) {
      await interaction.reply({
        content: "Could not find the draft.",
        ephemeral: true,
      });
      return;
    }

    const abilities = draft.abilities.map((a: any) => ({
      ...a,
      type: "ABILITY",
    }));
    const immunities = draft.immunities.map((i: any) => ({
      ...i,
      type: "IMMUNITY",
    }));

    const allLinks = [...abilities, ...immunities];

    await interaction.deferUpdate();

    for (const link of allLinks) {
      const ability = await prisma.ability.upsert({
        where: { name: link.name },
        update: { name: link.name },
        create: { name: link.name, description: "" },
      });

      await prisma.championAbilityLink.upsert({
        where: {
          championId_abilityId_type_source: {
            championId: championId,
            abilityId: ability.id,
            type: link.type as any,
            source: link.source,
          },
        },
        update: {},
        create: {
          championId: championId,
          abilityId: ability.id,
          type: link.type as any,
          source: link.source,
        },
      });
    }

    const successContainer = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "Drafted abilities have been added to the champion."
      )
    );
    await interaction.editReply({
      components: [successContainer],
      flags: [MessageFlags.IsComponentsV2],
    });
    const champion = await prisma.champion.findUnique({
      where: { id: championId },
    });
    logger.info(
      `Added drafted abilities for champion ${champion?.name || championId}`
    );
    pendingDrafts.delete(championId.toString());
  } catch (error) {
    logger.error(error, "An error occurred while confirming ability draft");
    await interaction.followUp({
      content: `An error occurred: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
      ephemeral: true,
    });
  }
}

export async function handleCancelAbilityDraft(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];
  if (championId) {
    pendingDrafts.delete(championId);
  }
  await interaction.message.delete();
}

export function _buildDraftContainer(
  championName: string,
  championId: number,
  draft: any
): ContainerBuilder {
  const container = new ContainerBuilder();

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "Please review the drafted abilities below."
    )
  );

  const title = new TextDisplayBuilder().setContent(
    `## Drafted Abilities for ${championName}`
  );
  container.addTextDisplayComponents(title);

  if (draft.abilities?.length > 0) {
    const abilities = draft.abilities
      .map((a: any) => `**${a.name}**: ${a.source || "-"}`)
      .join("\n");
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### Abilities")
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(abilities)
    );
  }

  if (draft.immunities?.length > 0) {
    const immunities = draft.immunities
      .map((i: any) => `**${i.name}**: ${i.source || "-"}`)
      .join("\n");
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent("### Immunities")
    );
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(immunities)
    );
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm-ability-draft_${championId}`)
      .setLabel("Confirm")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`suggest-ability-draft_${championId}`)
      .setLabel("Suggest Edits")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("cancel-ability-draft")
      .setLabel("Cancel")
      .setStyle(ButtonStyle.Danger)
  );

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(row);

  return container;
}

export async function handleSuggestEdits(interaction: ButtonInteraction) {
  const championId = interaction.customId.split("_")[1];
  if (!championId) {
    await interaction.reply({
      content: "Invalid champion ID.",
      ephemeral: true,
    });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`suggest-ability-modal_${championId}`)
    .setTitle("Suggest Edits");

  const suggestionsInput = new TextInputBuilder()
    .setCustomId("suggestions")
    .setLabel("What would you like to change?")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    suggestionsInput
  );

  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

export async function handleSuggestEditsModal(
  interaction: ModalSubmitInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const championId = parseInt(interaction.customId.split("_")[1]);
  logger.info(`Handling suggest edits modal for champion ${championId}`);

  const suggestions = interaction.fields.getTextInputValue("suggestions");
  logger.info({ suggestions }, "User suggestions");

  const originalDraft = pendingDrafts.get(championId.toString());
  if (!originalDraft) {
    await interaction.editReply("Could not find the original draft.");
    return;
  }

  const champion = await prisma.champion.findUnique({
    where: { id: championId },
  });
  if (!champion) {
    await interaction.editReply("Champion not found.");
    return;
  }

  const systemPrompt = `You are an expert MCOC assistant. You will be provided with a JSON object representing a champion's abilities and immunities, and a user's suggestion for edits. Your task is to return a new JSON object with the suggested edits applied. Make sure to only return the JSON object.`;

  const userPrompt = `Original JSON:\n\
\`\`\`json\n${JSON.stringify(originalDraft, null, 2)}
\
\`\`\`\n\nUser Suggestions:\n${suggestions}\n\nReturn only the updated JSON object.`;

  logger.info("Sending request to LLM for draft update.");
  const response = await openRouterService.chat({
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });
  logger.info("Received response from LLM for draft update.");

  const newDraft = JSON.parse(response.choices[0].message.content);
  logger.info({ newDraft }, "Parsed new draft from LLM response");
  pendingDrafts.set(championId.toString(), newDraft);

  const newContainer = _buildDraftContainer(
    champion.name,
    champion.id,
    newDraft
  );

  if (interaction.channel && "send" in interaction.channel) {
    await interaction.channel.send({
      components: [newContainer],
      flags: [MessageFlags.IsComponentsV2],
    });
  }

  await interaction.message?.delete();

  await interaction.editReply("Draft updated with your suggestions.");
}

registerButtonHandler("confirm-ability-draft_", handleConfirmAbilityDraft);
registerButtonHandler("cancel-ability-draft", handleCancelAbilityDraft);
registerButtonHandler("suggest-ability-draft_", handleSuggestEdits);
registerModalHandler("suggest-ability-modal_", handleSuggestEditsModal);
