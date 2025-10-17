import { ModalSubmitInteraction } from "discord.js";
import { prisma } from "../../../services/prismaService";
import { getChampionByName } from "../../../services/championService";
import { AttackType } from "@prisma/client";
import logger from "../../../services/loggerService";

import { registerModalHandler } from "../../../utils/modalHandlerRegistry";

export async function handleAttackAddModal(
  interaction: ModalSubmitInteraction
) {
  await interaction.deferReply({ ephemeral: true });

  const championName = interaction.customId.split("_")[3];
  const champion = getChampionByName(championName);

  if (!champion) {
    await interaction.editReply(`Champion "${championName}" not found.`);
    return;
  }

  const attackTypesRaw = interaction.fields.getTextInputValue("attackType");
  const hitsRaw = interaction.fields.getTextInputValue("hits");

  // 1. Parse and validate attack types
  const attackTypeStrings = attackTypesRaw
    .split(",")
    .map((t) => t.trim().toUpperCase());
  const validTypes: AttackType[] = [];
  const invalidTypes: string[] = [];

  for (const typeStr of attackTypeStrings) {
    if (Object.values(AttackType).includes(typeStr as any)) {
      validTypes.push(typeStr as AttackType);
    } else {
      invalidTypes.push(typeStr);
    }
  }

  if (invalidTypes.length > 0) {
    await interaction.editReply(
      `Invalid Attack Type(s): ${invalidTypes.join(", ")}. Valid types are: ${Object.values(
        AttackType
      ).join(", ")}`
    );
    return;
  }

  if (validTypes.length === 0) {
    await interaction.editReply(`You must provide at least one valid attack type.`);
    return;
  }

  // 2. Parse hits
  const hitsProperties = hitsRaw
    .split("\n")
    .map((line) =>
      line
        .trim()
        .split(" ")
        .filter((p) => p)
    )
    .filter((arr) => arr.length > 0);

  if (hitsProperties.length === 0) {
    await interaction.editReply("You must provide at least one hit.");
    return;
  }

  try {
    // 3. Loop and create attacks
    const createdAttacks: string[] = [];
    const skippedAttacks: string[] = [];

    for (const attackType of validTypes) {
      const existingAttack = await prisma.attack.findUnique({
        where: {
          championId_type: { championId: champion.id, type: attackType },
        },
      });

      if (existingAttack) {
        skippedAttacks.push(attackType);
      } else {
        await prisma.attack.create({
          data: {
            championId: champion.id,
            type: attackType,
            hits: {
              create: hitsProperties.map((properties) => ({ properties })),
            },
          },
        });
        createdAttacks.push(attackType);
      }
    }

    // 4. Formulate response
    let response = "";
    if (createdAttacks.length > 0) {
      response += `Successfully added attacks: ${createdAttacks.join(", ")}. `;
    }
    if (skippedAttacks.length > 0) {
      response += `Skipped existing attacks: ${skippedAttacks.join(", ")}.`;
    }
    if (response === "") {
      response = "No new attacks were added.";
    }

    logger.info(
      `User ${interaction.user.username} processed attacks for ${champion.name}. Added: [${createdAttacks}], Skipped: [${skippedAttacks}]`
    );

    await interaction.editReply(response.trim());
  } catch (error) {
    logger.error({ error }, "Error adding attack(s)");
    await interaction.editReply("An error occurred while adding the attack(s).");
  }
}

registerModalHandler("admin_attack_add_", handleAttackAddModal);
