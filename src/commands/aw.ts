import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AutocompleteInteraction,
  Attachment,
  GuildMember,
} from "discord.js";
import { Command } from "../types/command";
import { getPlayerThread, getAllPlayerThreads } from "../utils/playerService";
import { getWarPlanData } from "../utils/sheetsService";

async function handlePlanSubcommand(interaction: ChatInputCommandInteraction) {
  const member = interaction.member as GuildMember;
  
  await interaction.deferReply({ ephemeral: true });

  const attachment = interaction.options.getAttachment("attachment", true) as Attachment;
  const battlegroupOption = interaction.options.getInteger("battlegroup");
  const playerOption = interaction.options.getUser("player");

  let battlegroup = battlegroupOption;
  if (!battlegroup) {
    const channelName = (interaction.channel as any).name.toLowerCase();
    if (channelName.includes("bg1")) battlegroup = 1;
    else if (channelName.includes("bg2")) battlegroup = 2;
    else if (channelName.includes("bg3")) battlegroup = 3;
  }

  if (!battlegroup) {
    await interaction.editReply(
      "Could not determine battlegroup from channel name. Please specify the `battlegroup` option."
    );
    return;
  }

  try {
    const warPlanData = await getWarPlanData(battlegroup);
    const threads = await getAllPlayerThreads();

    let sentCount = 0;
    for (const playerId in threads) {
      const threadId = threads[playerId];
      const thread = await interaction.client.channels.fetch(threadId);

      if (thread && thread.isTextBased() && "send" in thread) {
        // Filter assignments for the specific player
        const playerAssignments = warPlanData.assignments?.filter(
          (row) => row[2]?.toLowerCase() === playerId.toLowerCase()
        );

        const playerPrefights = warPlanData.prefights?.filter(
          (row) => row[0]?.toLowerCase() === playerId.toLowerCase()
        );

        let messageContent = "";
        if (playerAssignments && playerAssignments.length > 0) {
          messageContent += `### War Plan Assignments for <@${playerId}>:\n`;
          messageContent += playerAssignments
            .map((row) => `- ${row[0]}`)
            .join("\n");
        }

        if (playerPrefights && playerPrefights.length > 0) {
          if (messageContent) messageContent += "\n\n";
          messageContent += `### Pre-Fights for <@${playerId}>:\n`;
          messageContent += playerPrefights
            .map((row) => `- ${row[2]}`)
            .join("\n");
        }

        if (messageContent || attachment) {
          await thread.send({ content: messageContent, files: [attachment] });
          sentCount++;
        }
      }
    }

    await interaction.editReply(`Sent war plan to ${sentCount} players.`);
  } catch (error) {
    console.error(error);
    await interaction.editReply("An error occurred while sending the war plan.");
  }
}

async function handleDetailsSubcommand(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply({ ephemeral: true });

  const player = interaction.user;
  const nodeOption = interaction.options.getInteger("node");

  let battlegroup: number | null = null;
  const channelName = (interaction.channel as any).name.toLowerCase();
  if (channelName.includes("bg1")) battlegroup = 1;
  else if (channelName.includes("bg2")) battlegroup = 2;
  else if (channelName.includes("bg3")) battlegroup = 3;

  if (!battlegroup) {
    await interaction.editReply(
      "Could not determine battlegroup from channel name. Please use this command in a battlegroup channel."
    );
    return;
  }

  try {
    const warPlanData = await getWarPlanData(battlegroup);

    const playerAssignments = warPlanData.assignments?.filter(
      (row) => row[2]?.toLowerCase() === player.username.toLowerCase()
    );

    const playerPrefights = warPlanData.prefights?.filter(
      (row) => row[0]?.toLowerCase() === player.username.toLowerCase()
    );

    let filteredAssignments = playerAssignments;
    if (nodeOption) {
      filteredAssignments = playerAssignments?.filter(
        (row) => row[1] === nodeOption.toString()
      );
    }

    if (!filteredAssignments?.length && !playerPrefights?.length) {
      await interaction.editReply("No assignments found for you.");
      return;
    }

    let messageContent = `### War Details for ${player.username}\n`;

    if (filteredAssignments && filteredAssignments.length > 0) {
      messageContent += "\n**Assignments:**\n";
      messageContent += filteredAssignments
        .map((row) => `- Node ${row[1]}: ${row[0]}`)
        .join("\n");
    }

    if (playerPrefights && playerPrefights.length > 0) {
      messageContent += "\n**Pre-fights:**\n";
      messageContent += playerPrefights.map((row) => `- ${row[2]}`).join("\n");
    }

    await interaction.editReply(messageContent);
  } catch (error) {
    console.error(error);
    await interaction.editReply(
      "An error occurred while fetching your war details."
    );
  }
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aw")
    .setDescription("Commands for Alliance War")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("plan")
        .setDescription("Send the war plan to player threads.")
        .addAttachmentOption((option) =>
          option
            .setName("attachment")
            .setDescription("The war plan image.")
            .setRequired(true)
        )
        .addIntegerOption((option) =>
          option
            .setName("battlegroup")
            .setDescription("The battlegroup number (1, 2, or 3).")
            .setRequired(false)
            .addChoices(
              { name: "BG1", value: 1 },
              { name: "BG2", value: 2 },
              { name: "BG3", value: 3 }
            )
        )
        .addUserOption((option) =>
          option
            .setName("player")
            .setDescription("Send the plan to a specific player.")
            .setRequired(false)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("details")
        .setDescription("Get details about your war assignments.")
        .addIntegerOption((option) =>
          option
            .setName("node")
            .setDescription("The node number to get details for.")
            .setRequired(false)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "plan") {
      await handlePlanSubcommand(interaction);
    } else if (subcommand === "details") {
      await handleDetailsSubcommand(interaction);
    }
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    // Placeholder for future autocomplete logic
  },
};