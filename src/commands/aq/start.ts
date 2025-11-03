import {
  Guild,
  GuildBasedChannel,
  MessageFlags,
  AttachmentBuilder,
} from "discord.js";
import { CommandResult } from "../../types/command";
import { AQState, getState, setState } from "./state";
import { generateAQHeader } from "./header";
import { buildAQContainer } from "./view";
import { prisma } from "../../services/prismaService";
import logger from "../../services/loggerService";

interface AQCoreStartParams {
  day: number;
  roleId: string;
  channel: GuildBasedChannel;
  guild: Guild;
  channelName: string;
  roleName: string;
}

export async function handleStart(
  params: AQCoreStartParams
): Promise<CommandResult> {
  const { day, roleId, channel, guild, channelName, roleName } = params;

  if (!("send" in channel)) {
    return {
      flags: MessageFlags.Ephemeral,
    };
  }

  const alliance = await prisma.alliance.findUnique({
    where: { guildId: guild.id },
  });
  if (!alliance) {
    return {
      content: "This server is not registered as an alliance.",
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
  const end = new Date(now.getTime() + 24 * 60 * 60 * 1000 - 1000 * 600); // 24 hours minus 10 minutes

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
    section2PingSent: false,
    finalPingSent: false,
    allianceId: alliance.id,
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

  if (alliance.createAqThread) {
    try {
      const thread = await sent.startThread({
        name: `AQ Day ${day} Updates`,
        autoArchiveDuration: 1440, // 24 hours
      });
      state.threadId = thread.id;
    } catch (error: any) {
      logger.error({ err: error, guildId: guild.id }, 'Failed to create AQ thread');
      if (error.code === 50001) { // Missing Access
        try {
          await (channel as any).send("I tried to start a thread for AQ updates, but I don't have the required 'Create Public Threads' permission. Please grant it to me if you'd like this feature enabled.");
        } catch (sendMessageError) {
          logger.error({ err: sendMessageError, guildId: guild.id }, 'Failed to send "missing permissions" message for thread creation');
        }
      }
    }
  }

  await setState(channelId, state);

  return {
    content: "AQ Tracker started successfully.",
    flags: MessageFlags.Ephemeral,
  };
}
