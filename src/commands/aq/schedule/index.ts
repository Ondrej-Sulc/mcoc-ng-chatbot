import {
  ChatInputCommandInteraction,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { parseDuration } from "../../../utils/time";
import { buildOverviewContainer } from "./overview";
import { buildEditBgContainer } from "./edit";

export async function handleAqSchedule(
  interaction: ChatInputCommandInteraction
) {
  if (!interaction.guildId) return;
  await interaction.deferReply({ ephemeral: true });

  const showOverview = async (i: ChatInputCommandInteraction | any) => {
    const container = await buildOverviewContainer(interaction.guildId!);
    const method = i.deferred || i.replied ? "editReply" : "update";
    await i[method]({
      components: [container],
      flags: [MessageFlags.IsComponentsV2],
    });
  };

  const message = await interaction.editReply({
    components: [await buildOverviewContainer(interaction.guildId)],
    flags: [MessageFlags.IsComponentsV2],
  });

  const collector = message.createMessageComponentCollector({
    time: 300000, // 5 minutes
  });

  let editState: any = {};

  collector.on("collect", async (i: any) => {
    if (i.user.id !== interaction.user.id) {
      await i.reply({ content: "You cannot use this menu.", ephemeral: true });
      return;
    }

    const customIdParts = i.customId.split(":");
    const action = customIdParts[2];

    if (action === "edit-bg") {
      const bg = parseInt(customIdParts[3], 10);
      const allianceData = await prisma.alliance.findUnique({
        where: { guildId: interaction.guildId! },
        include: { aqSchedules: { where: { battlegroup: bg } } },
      });
      editState = {
        role: allianceData?.aqSchedules[0]?.roleId,
        channel: allianceData?.aqSchedules[0]?.channelId,
        day1: allianceData?.aqSchedules.find((s) => s.aqDay === 1)?.dayOfWeek,
        day2: allianceData?.aqSchedules.find((s) => s.aqDay === 2)?.dayOfWeek,
        day3: allianceData?.aqSchedules.find((s) => s.aqDay === 3)?.dayOfWeek,
        day4: allianceData?.aqSchedules.find((s) => s.aqDay === 4)?.dayOfWeek,
      };
      const editContainer = await buildEditBgContainer(
        interaction,
        bg,
        editState
      );
      await i.update({ components: [editContainer] });
    } else if (action === "back") {
      await showOverview(i);
    } else if (action === "toggle-thread") {
      await i.deferUpdate();
      const allianceToUpdate = await prisma.alliance.findUnique({
        where: { guildId: interaction.guildId! },
      });
      if (allianceToUpdate) {
        await prisma.alliance.update({
          where: { id: allianceToUpdate.id },
          data: { createAqThread: !allianceToUpdate.createAqThread },
        });
      }
      await showOverview(i);
    } else if (action === "save") {
      await i.deferUpdate();
      const bg = parseInt(customIdParts[3], 10);
      const allianceToSave = await prisma.alliance.findUnique({
        where: { guildId: interaction.guildId! },
      });
      if (!allianceToSave) return;

      const { role, channel } = editState;
      const time =
        (
          await prisma.aQSchedule.findFirst({
            where: { allianceId: allianceToSave.id },
          })
        )?.time || "15:00";

      for (const dayKey of ["day1", "day2", "day3", "day4"]) {
        const aqDay = parseInt(dayKey.replace("day", ""), 10);
        const dayOfWeek = editState[dayKey];
        const existing = await prisma.aQSchedule.findFirst({
          where: { allianceId: allianceToSave.id, battlegroup: bg, aqDay },
        });

        if (dayOfWeek !== undefined && dayOfWeek !== null && dayOfWeek != -1) {
          if (existing) {
            await prisma.aQSchedule.update({
              where: { id: existing.id },
              data: {
                dayOfWeek: parseInt(dayOfWeek),
                roleId: role,
                channelId: channel,
              },
            });
          } else {
            await prisma.aQSchedule.create({
              data: {
                allianceId: allianceToSave.id,
                battlegroup: bg,
                aqDay,
                dayOfWeek: parseInt(dayOfWeek),
                roleId: role,
                channelId: channel,
                time,
              },
            });
          }
        } else {
          if (existing) {
            await prisma.aQSchedule.delete({ where: { id: existing.id } });
          }
        }
      }
      await showOverview(i);
    } else if (i.isStringSelectMenu()) {
      const selectAction = customIdParts[2];
      const entity = customIdParts[3];
      const bg = parseInt(customIdParts[4], 10);
      editState[entity] = i.values[0];
      const editContainer = await buildEditBgContainer(
        interaction,
        bg,
        editState
      );
      await i.update({ components: [editContainer] });
    } else if (i.isButton()) {
      if (action === "edit-time") {
        const modal = new ModalBuilder()
          .setCustomId("interactive:aq-schedule:modal-time")
          .setTitle("Set AQ Start Time")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("time")
                .setLabel("Start Time (HH:mm UTC)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("e.g., 15:00")
            )
          );
        await i.showModal(modal);
        try {
          const submitted = await i.awaitModalSubmit({ time: 60000 });
          if (submitted) {
            await submitted.deferUpdate();
            const time = submitted.fields.getTextInputValue("time");
            const allianceForTime = await prisma.alliance.findUnique({
              where: { guildId: interaction.guildId! },
            });
            if (allianceForTime) {
              await prisma.aQSchedule.updateMany({
                where: { allianceId: allianceForTime.id },
                data: { time },
              });
            }
            await showOverview(submitted);
          }
        } catch (err) {
          // Modal timed out
        }
      } else if (action === "skip") {
        const modal = new ModalBuilder()
          .setCustomId("interactive:aq-schedule:modal-skip")
          .setTitle("Skip AQ Schedule")
          .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
              new TextInputBuilder()
                .setCustomId("duration")
                .setLabel("Duration to skip for")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder("e.g., 7d, 1w, 24h")
            )
          );
        await i.showModal(modal);
        try {
          const submitted = await i.awaitModalSubmit({ time: 60000 });
          if (submitted) {
            await submitted.deferUpdate();
            const durationString =
              submitted.fields.getTextInputValue("duration");
            const durationMs = parseDuration(durationString);
            if (!durationMs) {
              await submitted.followUp({
                content: "Invalid duration format.",
                ephemeral: true,
              });
              return;
            }
            const skipUntil = new Date(Date.now() + durationMs);
            const allianceForSkip = await prisma.alliance.findUnique({
              where: { guildId: interaction.guildId! },
            });
            if (allianceForSkip) {
              await prisma.aQSkip.upsert({
                where: { allianceId: allianceForSkip.id },
                update: { skipUntil },
                create: { allianceId: allianceForSkip.id, skipUntil },
              });
            }
            await showOverview(submitted);
          }
        } catch (err) {
          // Modal timed out
        }
      }
    }
  });

  collector.on("end", async () => {
    const container = new ContainerBuilder().addTextDisplayComponents(
      new TextDisplayBuilder().setContent("Menu has expired.")
    );
    await interaction.editReply({ components: [container] });
  });
}
