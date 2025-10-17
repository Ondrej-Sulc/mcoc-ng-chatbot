import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { AttackType } from "@prisma/client";

export async function showAttackModal(
  interaction: ChatInputCommandInteraction,
  championName: string
) {
  const modal = new ModalBuilder()
    .setCustomId(`admin_attack_add_${championName}`)
    .setTitle(`Add Attack for ${championName}`);

  const attackTypeInput = new TextInputBuilder()
    .setCustomId("attackType")
    .setLabel("Attack Type(s) (comma-separated)")
    .setPlaceholder(`e.g., L1, L2, M1, M2`)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const hitsInput = new TextInputBuilder()
    .setCustomId("hits")
    .setLabel("Hits (One per line)")
    .setPlaceholder(
      "Example:\nContact Physical\nEnergy"
    )
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    attackTypeInput
  );
  const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(
    hitsInput
  );

  modal.addComponents(firstActionRow, secondActionRow);

  await interaction.showModal(modal);
}
