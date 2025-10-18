import { CommandInteraction } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { openRouterService } from "../../../services/openRouterService";
import {
  buildDraftContainerV2,
  buildDraftErrorContainerV2,
  buildDraftLoadingContainerV2,
} from "./draftUI";
import { abilityDraftPrompt } from "../../../prompts/abilityDraft";

export const pendingDrafts = new Map<string, any>();

export async function handleAbilityDraft(interaction: CommandInteraction) {
  if (!interaction.isChatInputCommand()) return;
  logger.info(
    `Starting champion ability draft process for ${interaction.user.tag}`
  );

  try {
    await interaction.deferReply();
    const championName = interaction.options.getString("champion", true);
    logger.info(`Drafting abilities for champion: ${championName}`);

    const loadingContainer = buildDraftLoadingContainerV2(championName);
    await interaction.editReply(loadingContainer);

    const champion = await prisma.champion.findUnique({
      where: { name: championName },
    });
    if (!champion || !champion.fullAbilities) {
      const errorContainer = buildDraftErrorContainerV2(
        `Champion **${championName}** not found or has no fullAbilities.`
      );
      await interaction.editReply(errorContainer);
      return;
    }

    logger.info("Reading ability draft prompt...");
    const systemPrompt = abilityDraftPrompt;
    const userPrompt = `Champion Name: ${championName}\n"full_abilities" JSON:\n'''json\n${JSON.stringify(
      champion.fullAbilities,
      null,
      2
    )}
'''

**Generate ONLY the JSON object for this new champion, strictly following all rules and examples provided.**`;

    const model =
      interaction.options.getString("model") ?? "google/gemini-2.5-pro";
    logger.info("Sending ability draft request to LLM...");
    const response = await openRouterService.chat({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    });
    logger.info("Received ability draft response from LLM.");

    const draft = JSON.parse(response.choices[0].message.content);
    logger.info({ draft }, "Parsed ability draft from LLM response");
    pendingDrafts.set(champion.id.toString(), {
      draft,
      initialUserPrompt: userPrompt,
    });

    const draftContainer = buildDraftContainerV2(
      champion.name,
      champion.id,
      draft
    );
    logger.info("Sending confirmation message with drafted abilities.");
    await interaction.editReply(draftContainer);
  } catch (error) {
    logger.error(error, "An error occurred during champion ability draft");
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorContainer = buildDraftErrorContainerV2(errorMessage);
    await interaction.editReply(errorContainer);
  }
}
