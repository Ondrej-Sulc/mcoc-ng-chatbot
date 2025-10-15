import { ButtonInteraction, MessageFlags } from "discord.js";
import { registerButtonHandler } from "../../utils/buttonHandlerRegistry";
import { getState, SectionKey, setState } from "./state";
import { updateAqMessage } from "./view";

async function handleTogglePath(
  interaction: ButtonInteraction,
  section: SectionKey
) {
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  const channelId = interaction.channelId as string;
  const userId = interaction.user.id as string;
  const state = await getState(channelId);
  if (!state || state.status !== "active") {
    await interaction.followUp({
      content: "This AQ tracker is not active.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }
  const player = state.players[section][userId];
  if (!player) {
    await interaction.followUp({
      content: "You are not registered for this AQ.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }
  state.players[section][userId].done = !state.players[section][userId].done;
  await setState(channelId, state);
  await updateAqMessage(interaction, channelId);
  await interaction.followUp({
    content: `Your progress for Section ${section.slice(1)} has been updated.`,
    flags: [MessageFlags.Ephemeral],
  });
}

async function handleSectionClear(
  interaction: ButtonInteraction,
  section: 1 | 2 | 3,
  which: string
) {
  const channelId = interaction.channelId as string;
  const state = await getState(channelId);
  if (!state || state.status !== "active") {
    await interaction.reply({
      content: "This AQ tracker is not active.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  await interaction.deferUpdate();

  const targetChannel = state.threadId
    ? await interaction.client.channels.fetch(state.threadId)
    : interaction.channel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    console.error("Cannot send message to non-text-based guild channel.");
    return;
  }

  const roleMention = `<@&${state.roleId}>`;
  if (section < 3) {
    await (targetChannel as any).send({
      content: `${roleMention} ${
        interaction.user
      } defeated the Section ${section} ${which}! Section ${
        section + 1
      } is now open.`,
    });
    state.mapStatus = `Section ${section + 1} in Progress`;
  } else {
    await (targetChannel as any).send({
      content: `${roleMention} ${interaction.user} defeated the ${which}!`,
    });
  }
  await setState(channelId, state);
  await updateAqMessage(interaction, channelId);
}

async function handleMapClear(interaction: ButtonInteraction) {
  const channelId = interaction.channelId as string;
  const state = await getState(channelId);
  if (!state || state.status !== "active") {
    await interaction.reply({
      content: "No active AQ tracker in that channel.",
      flags: [MessageFlags.Ephemeral],
    });
    return;
  }

  await interaction.deferUpdate();

  const targetChannel = state.threadId
    ? await interaction.client.channels.fetch(state.threadId)
    : interaction.channel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    console.error("Cannot send message to non-text-based guild channel.");
    return;
  }

  state.status = "completed";
  state.mapStatus = "✅ MAP COMPLETE";
  await setState(channelId, state);
  const roleMention = `<@&${state.roleId}>`;
  await (targetChannel as any).send({
    content: `🎉 ${roleMention} The map is 100% complete! Great work, everyone!`,
  });
  await updateAqMessage(interaction, channelId);

  if (state.threadId) {
    try {
      const thread = await interaction.client.channels.fetch(state.threadId);
      if (thread && thread.isThread()) {
        await thread.setLocked(true);
      }
    } catch (e) {
      console.error("Failed to lock thread:", e);
    }
  }
}

// Register button handlers (prefix-based)
registerButtonHandler("aq:path:s1", async (i: ButtonInteraction) =>
  handleTogglePath(i, "s1")
);
registerButtonHandler("aq:path:s2", async (i: ButtonInteraction) =>
  handleTogglePath(i, "s2")
);
registerButtonHandler("aq:path:s3", async (i: ButtonInteraction) =>
  handleTogglePath(i, "s3")
);
registerButtonHandler("aq:boss:s1", async (i: ButtonInteraction) =>
  handleSectionClear(i, 1, "Miniboss")
);
registerButtonHandler("aq:boss:s2", async (i: ButtonInteraction) =>
  handleSectionClear(i, 2, "Miniboss")
);
registerButtonHandler("aq:map_clear", async (i: ButtonInteraction) =>
  handleMapClear(i)
);
