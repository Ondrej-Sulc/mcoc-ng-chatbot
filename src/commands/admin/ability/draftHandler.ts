import { prisma } from "../../../services/prismaService";
import { ButtonInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, ButtonStyle, ButtonBuilder, EmbedBuilder } from "discord.js";
import logger from "../../../services/loggerService";
import { openRouterService } from "../../../services/openRouterService";
import { registerButtonHandler } from "../../../utils/buttonHandlerRegistry";
import { registerModalHandler } from "../../../utils/modalHandlerRegistry";

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

    const embed = new EmbedBuilder()
        .setDescription("Drafted abilities have been added to the champion.");

    await interaction.editReply({
      embeds: [embed],
      components: [],
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



export function buildDraftContainer(
  championName: string,
  championId: number,
  draft: any
): { embeds: EmbedBuilder[], components: ActionRowBuilder<ButtonBuilder>[] } {
  const embed = new EmbedBuilder()
    .setTitle(`Drafted Abilities for ${championName}`)
    .setDescription("Please review the drafted abilities below.");

  if (draft.abilities?.length > 0) {
    let abilities = draft.abilities
      .map((a: any) => `**${a.name}**: ${a.source || "-"}`)
      .join("\n");
    if (abilities.length > 1024) {
        abilities = abilities.substring(0, 1020) + "...";
    }
    embed.addFields({ name: "Abilities", value: abilities });
  }

  if (draft.immunities?.length > 0) {
    let immunities = draft.immunities
      .map((i: any) => `**${i.name}**: ${i.source || "-"}`)
      .join("\n");
    if (immunities.length > 1024) {
        immunities = immunities.substring(0, 1020) + "...";
    }
    embed.addFields({ name: "Immunities", value: immunities });
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

  return { embeds: [embed], components: [row] };
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
\
${JSON.stringify(originalDraft, null, 2)}\
\
User Suggestions:${suggestions}\n\
Return only the updated JSON object.`;

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

const newContainer = buildDraftContainer(
    champion.name,
    champion.id,
    newDraft
  );

  if (interaction.channel && "send" in interaction.channel) {
    await interaction.channel.send({
      embeds: newContainer.embeds,
      components: newContainer.components,
    });
  }

  await interaction.message?.delete();

  await interaction.editReply("Draft updated with your suggestions.");
}

registerButtonHandler("confirm-ability-draft_", handleConfirmAbilityDraft);
registerButtonHandler("cancel-ability-draft", handleCancelAbilityDraft);
registerButtonHandler("suggest-ability-draft_", handleSuggestEdits);
registerModalHandler("suggest-ability-modal_", handleSuggestEditsModal);
