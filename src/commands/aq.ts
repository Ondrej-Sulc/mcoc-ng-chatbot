import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  MessageFlags,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  AutocompleteInteraction,
  GuildBasedChannel,
} from "discord.js";
import { Command } from "../types/command";
import { handleError, safeReply } from "../utils/errorHandler";
import { registerButtonHandler } from "../utils/buttonHandlerRegistry";
import fs from "node:fs";
import path from "node:path";

type SectionKey = "s1" | "s2" | "s3";

interface PlayerSectionState {
  done: boolean;
}

interface AQState {
  channelId: string;
  messageId: string;
  roleId: string;
  day: number;
  status: "active" | "ended" | "completed" | "ended_manual";
  mapStatus: string;
  players: Record<SectionKey, Record<string, PlayerSectionState>>;
  // timestamps are stored as ISO strings
  startTimeIso: string;
  endTimeIso: string;
}

const DATA_DIR = path.join(process.cwd(), "data");
const STATE_FILE = path.join(DATA_DIR, "aq_state.json");

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAllState(): Record<string, AQState> {
  try {
    if (!fs.existsSync(STATE_FILE)) return {};
    const raw = fs.readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeAllState(state: Record<string, AQState>) {
  ensureDataDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

function getState(channelId: string): AQState | undefined {
  const all = readAllState();
  return all[channelId];
}

function setState(channelId: string, state: AQState | undefined) {
  const all = readAllState();
  if (state) {
    all[channelId] = state;
  } else {
    delete all[channelId];
  }
  writeAllState(all);
}

function buildProgressLines(state: AQState): string {
  const allUserIds = new Set<string>();
  for (const section of ["s1", "s2", "s3"] as SectionKey[]) {
    for (const uid of Object.keys(state.players[section])) allUserIds.add(uid);
  }
  const sorted = Array.from(allUserIds).sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
  if (sorted.length === 0) return "No players registered";

  const lines: string[] = [];
  for (const userId of sorted) {
    const s1 = state.players.s1[userId]?.done ? "✅" : "⏳";
    const s2 = state.players.s2[userId]?.done ? "✅" : "⏳";
    const s3 = state.players.s3[userId]?.done ? "✅" : "⏳";
    lines.push(`${s1} ${s2} ${s3} <@${userId}>`);
  }
  lines.push("\nLegend: ⏳ = In Progress, ✅ = Completed");
  return lines.join("\n");
}

function buildAQContainer(state: AQState): ContainerBuilder {
  const container = new ContainerBuilder();
  const header = new TextDisplayBuilder().setContent(
    `**Alliance Quest – Day ${state.day}**\nStatus: ${state.mapStatus}`
  );
  const endTs = Math.floor(new Date(state.endTimeIso).getTime() / 1000);
  const timing = new TextDisplayBuilder().setContent(`Ends <t:${endTs}:R>`);
  const progress = new TextDisplayBuilder().setContent(buildProgressLines(state));

  container.addTextDisplayComponents(header, timing, progress);

  // Controls
  const row1 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Toggle your path status:")
    )
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:path:s1").setLabel("Path S1").setStyle(ButtonStyle.Secondary)
    );
  const row2 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Path S2")
    )
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:path:s2").setLabel("Path S2").setStyle(ButtonStyle.Secondary)
    );
  const row3 = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Path S3")
    )
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:path:s3").setLabel("Path S3").setStyle(ButtonStyle.Secondary)
    );
  // Section clears header and individual rows (one accessory per section)
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("Section clears:")
  );
  const bossRowS1 = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Mini S1"))
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:boss:s1").setLabel("Mini S1 Down").setStyle(ButtonStyle.Primary)
    );
  const bossRowS2 = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Mini S2"))
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:boss:s2").setLabel("Mini S2 Down").setStyle(ButtonStyle.Primary)
    );
  const bossRowL = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Left Boss"))
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:boss:s3l").setLabel("Boss L Down").setStyle(ButtonStyle.Danger)
    );
  const bossRowR = new SectionBuilder()
    .addTextDisplayComponents(new TextDisplayBuilder().setContent("Right Boss"))
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:boss:s3r").setLabel("Boss R Down").setStyle(ButtonStyle.Danger)
    );

  const clearRow = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Finalize")
    )
    .setButtonAccessory(
      new ButtonBuilder().setCustomId("aq:map_clear").setLabel("MAP CLEAR").setStyle(ButtonStyle.Success)
    );

  container.addSectionComponents(
    row1,
    row2,
    row3,
    bossRowS1,
    bossRowS2,
    bossRowL,
    bossRowR,
    clearRow
  );
  return container;
}

async function updateAqMessage(interaction: { client: any }, channelId: string) {
  const state = getState(channelId);
  if (!state) return;
  try {
    const channel = await interaction.client.channels.fetch(channelId);
    const message = await (channel as any).messages.fetch(state.messageId);
    const container = buildAQContainer(state);
    await message.edit({ components: [container], flags: [MessageFlags.IsComponentsV2] });
  } catch (e) {
    // best-effort update
  }
}

async function handleTogglePath(interaction: any, section: SectionKey) {
  try {
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
  } catch {}
  const channelId = interaction.channelId as string;
  const userId = interaction.user.id as string;
  const state = getState(channelId);
  if (!state || state.status !== "active") {
    await interaction.followUp({ content: "This AQ tracker is not active.", flags: [MessageFlags.Ephemeral] });
    return;
  }
  const player = state.players[section][userId];
  if (!player) {
    await interaction.followUp({ content: "You are not registered for this AQ.", flags: [MessageFlags.Ephemeral] });
    return;
  }
  state.players[section][userId].done = !state.players[section][userId].done;
  setState(channelId, state);
  await updateAqMessage(interaction, channelId);
  await interaction.followUp({ content: `Your progress for Section ${section.slice(1)} has been updated.`, flags: [MessageFlags.Ephemeral] });
}

async function handleSectionClear(interaction: any, section: 1 | 2 | 3, which: string) {
  const channelId = interaction.channelId as string;
  const state = getState(channelId);
  if (!state || state.status !== "active") return;

  const roleMention = `<@&${state.roleId}>`;
  if (section < 3) {
    await interaction.channel.send({ content: `${roleMention} ${interaction.user} defeated the Section ${section} ${which}! Section ${section + 1} is now open.` });
    state.mapStatus = `Section ${section + 1} in Progress`;
  } else {
    await interaction.channel.send({ content: `${roleMention} ${interaction.user} defeated the ${which}!` });
  }
  setState(channelId, state);
  await updateAqMessage(interaction, channelId);
}

async function handleMapClear(interaction: any) {
  const channelId = interaction.channelId as string;
  const state = getState(channelId);
  if (!state || state.status !== "active") return;
  state.status = "completed";
  state.mapStatus = "✅ MAP COMPLETE";
  setState(channelId, state);
  const roleMention = `<@&${state.roleId}>`;
  await interaction.channel.send({ content: `🎉 ${roleMention} The map is 100% complete! Great work, everyone!` });
  await updateAqMessage(interaction, channelId);
}

// Register button handlers (prefix-based)
registerButtonHandler("aq:path:s1", async (i) => handleTogglePath(i, "s1"));
registerButtonHandler("aq:path:s2", async (i) => handleTogglePath(i, "s2"));
registerButtonHandler("aq:path:s3", async (i) => handleTogglePath(i, "s3"));
registerButtonHandler("aq:boss:s1", async (i) => handleSectionClear(i, 1, "Miniboss"));
registerButtonHandler("aq:boss:s2", async (i) => handleSectionClear(i, 2, "Miniboss"));
registerButtonHandler("aq:boss:s3l", async (i) => handleSectionClear(i, 3, "Left Boss"));
registerButtonHandler("aq:boss:s3r", async (i) => handleSectionClear(i, 3, "Right Boss"));
registerButtonHandler("aq:map_clear", async (i) => handleMapClear(i));

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
            .setDescription("Current AQ day (1-5)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(5)
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
    const roles = guild.roles.cache
      .filter((r) => !r.managed)
      .filter((r) => r.name.toLowerCase().includes(query))
      .first(25);
    await interaction.respond(
      roles.map((r) => ({ name: r.name, value: r.id }))
    );
  },

  async execute(interaction: ChatInputCommandInteraction) {
    try {
      const sub = interaction.options.getSubcommand();
      if (sub === "start") {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const day = interaction.options.getInteger("day", true);
        const roleId = interaction.options.getString("role", true);
        const targetChannel = (interaction.options.getChannel("channel") || interaction.channel) as GuildBasedChannel | null;
        if (!targetChannel || !("send" in targetChannel)) {
          await interaction.editReply("Please choose a text-based channel.");
          return;
        }

        const channelId = targetChannel.id;
        const existing = getState(channelId);
        if (existing && existing.status === "active") {
          await interaction.editReply("An AQ tracker is already active in that channel.");
          return;
        }

        // Initialize players from selected role
        const guild = interaction.guild;
        if (!guild) {
          await interaction.editReply("This command can only be used in a guild.");
          return;
        }
        const role = guild.roles.cache.get(roleId);
        if (!role) {
          await interaction.editReply("Selected role not found.");
          return;
        }

        const now = new Date();
        const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);

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
        };

        for (const member of role.members.values()) {
          state.players.s1[member.id] = { done: false };
          state.players.s2[member.id] = { done: false };
          state.players.s3[member.id] = { done: false };
        }

        // Send initial container message
        const container = buildAQContainer(state);
        const sent = await (targetChannel as any).send({
          components: [container],
          flags: [MessageFlags.IsComponentsV2],
        });
        state.messageId = sent.id;
        setState(channelId, state);

        await interaction.editReply("AQ Tracker started successfully.");
      } else if (sub === "end") {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const targetChannel = (interaction.options.getChannel("channel") || interaction.channel) as GuildBasedChannel | null;
        if (!targetChannel) {
          await interaction.editReply("Channel not found.");
          return;
        }
        const channelId = targetChannel.id;
        const state = getState(channelId);
        if (!state || state.status !== "active") {
          await interaction.editReply("No active AQ tracker in that channel.");
          return;
        }
        state.status = "ended_manual";
        setState(channelId, state);
        try {
          const message = await (targetChannel as any).messages.fetch(state.messageId);
          await message.edit({ content: `AQ tracker manually ended by ${interaction.user}.`, components: [] });
        } catch {}
        setState(channelId, undefined);
        await interaction.editReply("AQ tracker ended.");
      }
    } catch (error) {
      const { userMessage, errorId } = handleError(error, {
        location: "command:aq",
        userId: interaction.user?.id,
      });
      await safeReply(interaction, userMessage, errorId);
    }
  },
};

export default command;


