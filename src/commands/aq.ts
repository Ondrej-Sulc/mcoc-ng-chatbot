import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ChannelType,
  AutocompleteInteraction,
  GuildBasedChannel,
  Guild,
  User,
  ButtonInteraction,
  AttachmentBuilder,
} from "discord.js";
import { Command, CommandResult } from "../types/command";
import { registerButtonHandler } from "../utils/buttonHandlerRegistry";
import { AQState, getState, SectionKey, setState } from "../utils/aqState";
import { generateAQHeader } from "../utils/aqHeaderGenerator";
import { buildAQContainer } from "../utils/aqView";

async function updateAqMessage(
  interaction: { client: any },
  channelId: string
) {
  const state = await getState(channelId);
  if (!state) return;
  try {
    const channel = await interaction.client.channels.fetch(channelId);
    const message = await (channel as any).messages.fetch(state.messageId);
    const role = await (channel as any).guild.roles.fetch(state.roleId);
    const container = buildAQContainer(state, channel.name, role.name);
    await message.edit({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  } catch (e) {
    // best-effort update
  }
}

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

interface AQCoreStartParams {
  subcommand: "start";
  day: number;
  roleId: string;
  channel: GuildBasedChannel;
  guild: Guild;
  createThread: boolean;
  channelName: string;
  roleName: string;
}

interface AQCoreEndParams {
  subcommand: "end";
  channel: GuildBasedChannel;
  user: User;
}

type AQCoreParams = AQCoreStartParams | AQCoreEndParams;

export async function core(params: AQCoreParams): Promise<CommandResult> {
  if (params.subcommand === "start") {
    const { day, roleId, channel, guild, createThread, channelName, roleName } =
      params;

    if (!("send" in channel)) {
      return {
        flags: MessageFlags.Ephemeral,
      };
    }

    const channelId = channel.id;
    const existing = await getState(channelId);
    if (existing && existing.status === "active") {
      return {
        content: "An AQ tracker is already active in that channel.",
        flags: MessageFlags.Ephemeral,
      };
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      return {
        content: "Selected role not found.",
        flags: MessageFlags.Ephemeral,
      };
    }

    await guild.members.fetch();

    const now = new Date();
    const end = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1000 * 300); // 24 hours minus 5 minutes

    const state: AQState = {
      channelId,
      messageId: "",
      roleId,
      day,
      status: "active",
      mapStatus: "Section 1 in Progress",
      players: { s1: {}, s2: {}, s3: {} },
      startTimeIso: now.toISOString(),
      endTimeIso: end.toISOString(),
      slackerPingSent: false,
      finalPingSent: false,
    };

    for (const member of role.members.values()) {
      state.players.s1[member.id] = { done: false };
      state.players.s2[member.id] = { done: false };
      state.players.s3[member.id] = { done: false };
    }

    const headerImage = await generateAQHeader({
      day,
      channelName,
      roleName,
    });

    const container = buildAQContainer(state, channelName, roleName);
    const file = new AttachmentBuilder(headerImage).setName("aq_header.png");
    const sent = await (channel as any).send({
      components: [container],
      files: [file],
      flags: [MessageFlags.IsComponentsV2],
    });
    state.messageId = sent.id;

    if (createThread) {
      const thread = await sent.startThread({
        name: `AQ Day ${day} Updates`,
        autoArchiveDuration: 1440, // 24 hours
      });
      state.threadId = thread.id;
    }

    await setState(channelId, state);

    return {
      content: "AQ Tracker started successfully.",
      flags: MessageFlags.Ephemeral,
    };
  } else if (params.subcommand === "end") {
    const { channel, user } = params;
    const channelId = channel.id;
    const state = await getState(channelId);
    if (!state || state.status !== "active") {
      return {
        content: "No active AQ tracker in that channel.",
        flags: MessageFlags.Ephemeral,
      };
    }
    state.status = "ended_manual";
    await setState(channelId, state);
    const message = await (channel as any).messages.fetch(state.messageId);
    await message.edit({
      content: `AQ tracker manually ended by ${user}.`,
      components: [],
    });
    if (state.threadId) {
      const thread = await (channel as any).threads.fetch(state.threadId);
      if (thread) {
        await thread.setLocked(true);
      }
    }
    await setState(channelId, undefined);
    return { content: "AQ tracker ended.", flags: MessageFlags.Ephemeral };
  }
  return { content: "Invalid subcommand.", flags: MessageFlags.Ephemeral };
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName("aq")
    .setDescription("Alliance Quest utilities")
    .addSubcommand((sub) =>
      sub
        .setName("start")
        .setDescription("Start a new AQ tracker")
        .addIntegerOption((o) =>
          o
            .setName("day")
            .setDescription("Current AQ day (1-4)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(4)
        )
        .addStringOption((o) =>
          o
            .setName("role")
            .setDescription("Select the battlegroup role")
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Target channel (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
        .addBooleanOption((o) =>
          o
            .setName("create_thread")
            .setDescription("Create a thread for updates (defaults to false)")
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("end")
        .setDescription("End the active AQ tracker in a channel")
        .addChannelOption((o) =>
          o
            .setName("channel")
            .setDescription("Channel to end (defaults to current)")
            .addChannelTypes(
              ChannelType.GuildText,
              ChannelType.PublicThread,
              ChannelType.PrivateThread
            )
        )
    ),

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name !== "role") return;

    const guild = interaction.guild;
    if (!guild) {
      await interaction.respond([]);
      return;
    }

    const query = String(focused.value || "").toLowerCase();

    // Fetch roles from the guild to ensure we have fresh data
    const rolesCollection = await guild.roles.fetch();

    const filteredRoles = rolesCollection
      .filter(
        (r) =>
          !r.managed &&
          r.name !== "@everyone" &&
          r.name.toLowerCase().includes(query)
      )
      .first(25);

    await interaction.respond(
      filteredRoles.map((r) => ({ name: r.name, value: r.id }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();
    if (sub === "start") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const day = interaction.options.getInteger("day", true);
      const roleId = interaction.options.getString("role", true);
      const createThread =
        interaction.options.getBoolean("create_thread") ?? false;
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Please choose a valid channel.");
        return;
      }

      const guild = interaction.guild;
      if (!guild) {
        await interaction.editReply(
          "This command can only be used in a guild."
        );
        return;
      }

      const role = await guild.roles.fetch(roleId);
      if (!role) {
        await interaction.editReply("Role not found.");
        return;
      }

      const result = await core({
        subcommand: "start",
        day,
        roleId,
        channel: targetChannel,
        guild,
        createThread,
        channelName: targetChannel.name,
        roleName: role.name,
      });
      await interaction.editReply(result);
    } else if (sub === "end") {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
      const targetChannel = (interaction.options.getChannel("channel") ||
        interaction.channel) as GuildBasedChannel | null;
      if (!targetChannel) {
        await interaction.editReply("Channel not found.");
        return;
      }

      const result = await core({
        subcommand: "end",
        channel: targetChannel,
        user: interaction.user,
      });
      await interaction.editReply(result);
    }
  },
};

export default command;
