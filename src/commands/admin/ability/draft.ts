import { CommandInteraction, EmbedBuilder } from "discord.js";
import logger from "../../../services/loggerService";
import { prisma } from "../../../services/prismaService";
import { openRouterService } from "../../../services/openRouterService";
import { buildDraftContainer, pendingDrafts } from "./draftHandler";
import { abilityDraftPrompt } from "../../../prompts/abilityDraft";

export async function handleAbilityDraft(interaction: CommandInteraction) {
    if (!interaction.isChatInputCommand()) return;
    logger.info(
      `Starting champion ability draft process for ${interaction.user.tag}`
    );

    try {
      await interaction.deferReply();
      const championName = interaction.options.getString("champion", true);
      logger.info(`Drafting abilities for champion: ${championName}`);

const embed = new EmbedBuilder()
        .setDescription(`Drafting abilities for **${championName}**...`);

      await interaction.editReply({
        embeds: [embed],
      });

      const champion = await prisma.champion.findUnique({
        where: { name: championName },
      });
      if (!champion || !champion.fullAbilities) {
        await interaction.editReply(
          `Champion **${championName}** not found or has no fullAbilities.`
        );
        return;
      }

      logger.info("Reading ability draft prompt...");
      const systemPrompt = abilityDraftPrompt;
      const userPrompt = `Champion Name: ${championName}\n"full_abilities" JSON:\n\
\`\`\`json
${JSON.stringify(champion.fullAbilities, null, 2)}
\`\`\`

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
            pendingDrafts.set(champion.id.toString(), { draft, initialUserPrompt: userPrompt });
      
            const { embeds, components } = buildDraftContainer(champion.name, champion.id, draft);
      logger.info("Sending confirmation message with drafted abilities.");
      await interaction.editReply({
        embeds,
        components,
      });
    } catch (error) {
      logger.error(error, "An error occurred during champion ability draft");
      await interaction.editReply(
        `An error occurred: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
}
