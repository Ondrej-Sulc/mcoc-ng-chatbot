
import { SlashCommandBuilder } from "discord.js";
import { Command } from "../types/command";
import { createWorker } from "tesseract.js";

export const prestigeCommand: Command = {
  data: new SlashCommandBuilder()
    .setName("prestige")
    .setDescription("Parses prestige from an image.")
    .addAttachmentOption((option) =>
      option
        .setName("image")
        .setDescription("The image to parse prestige from.")
        .setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const attachment = interaction.options.getAttachment("image", true);

    if (!attachment.contentType?.startsWith("image")) {
      await interaction.editReply("Please provide a valid image file.");
      return;
    }

    try {
      const worker = await createWorker("eng");
      const ret = await worker.recognize(attachment.url);
      await worker.terminate();

      const text = ret.data.text;

      const summonerPrestigeMatch = text.match(/SUMMONER PRESTIGE\s*(\d+)/i);
      const championPrestigeMatch = text.match(/CHAMPION PRESTIGE\s*(\d+)/i);
      const relicPrestigeMatch = text.match(/RELIC PRESTIGE\s*(\d+)/i);

      const summonerPrestige = summonerPrestigeMatch ? parseInt(summonerPrestigeMatch[1], 10) : null;
      const championPrestige = championPrestigeMatch ? parseInt(championPrestigeMatch[1], 10) : null;
      const relicPrestige = relicPrestigeMatch ? parseInt(relicPrestigeMatch[1], 10) : null;

      if (summonerPrestige && championPrestige && relicPrestige) {
        const calculatedPrestige = championPrestige + relicPrestige;
        const verification = summonerPrestige === calculatedPrestige ? "Verified" : "Verification Failed";

        await interaction.editReply(
          `Summoner Prestige: ${summonerPrestige}\n` +
          `Champion Prestige: ${championPrestige}\n` +
          `Relic Prestige: ${relicPrestige}\n` +
          `Verification: ${verification}`
        );
      } else {
        await interaction.editReply(
          "Could not parse all prestige values from the image. Please ensure the image is clear and contains all three prestige values."
        );
      }
    } catch (error) {
      console.error(error);
      await interaction.editReply("An error occurred while parsing the image.");
    }
  },
};

export default prestigeCommand;
