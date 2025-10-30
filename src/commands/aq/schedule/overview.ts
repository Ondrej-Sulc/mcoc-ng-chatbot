import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { DAY_OPTIONS } from "./utils";

export async function buildOverviewContainer(guildId: string) {
  const container = new ContainerBuilder();

  const alliance = await prisma.alliance.findUnique({
    where: { guildId },
    include: { aqSchedules: true, aqSkip: true },
  });

  if (!alliance) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This server is not registered as an alliance."
      )
    );
    return container;
  }

  const { aqSchedules, aqSkip } = alliance;

  let time = "Not Set";
  if (aqSchedules.length > 0) {
    const firstTime = aqSchedules[0].time;
    if (aqSchedules.every((s) => s.time === firstTime)) {
      time = `${firstTime} UTC`;
    } else {
      time = "Mixed";
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# 🗓️ AQ Schedule Overview for ${alliance.name}`
    )
  );

  const timeSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**Start Time:** 🕒 \`${time}\``)
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:edit-time")
        .setLabel("Set Time")
        .setStyle(ButtonStyle.Primary)
    );

  let skipSection: SectionBuilder;
  if (aqSkip && aqSkip.skipUntil > new Date()) {
    const skipEnd = Math.floor(aqSkip.skipUntil.getTime() / 1000);
    skipSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
          `**Skipping until:** ⏩ <t:${skipEnd}:F>`
        )
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("interactive:aq-schedule:skip")
          .setLabel("Update Skip")
          .setStyle(ButtonStyle.Secondary)
      );
  } else {
    skipSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent("**Schedule is active.**")
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("interactive:aq-schedule:skip")
          .setLabel("Skip Schedule")
          .setStyle(ButtonStyle.Secondary)
      );
  }

  const createThreadSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Create AQ Thread:** ${
          alliance.createAqThread ? "✅ Enabled" : "❌ Disabled"
        }`
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:toggle-thread")
        .setLabel("Toggle")
        .setStyle(ButtonStyle.Secondary)
    );

  container.addSectionComponents(timeSection, skipSection, createThreadSection);

  container.addSeparatorComponents(new SeparatorBuilder());

  for (const bg of [1, 2, 3]) {
    const bgSchedules = aqSchedules.filter((s) => s.battlegroup === bg);
    let content = `### 🛡️ Battlegroup ${bg}\n`;
    if (bgSchedules.length === 0) {
      content += "No schedule set.";
    } else {
      const roleId = bgSchedules[0].roleId;
      const channelId = bgSchedules[0].channelId;
      content += `**Role:** <@&${roleId}>\n**Channel:** <#${channelId}>\n`;
      const days = DAY_OPTIONS.slice(0, 7)
        .map(({ label, value }) => {
          const sched = bgSchedules.find(
            (s) => s.dayOfWeek === parseInt(value)
          );
          return sched ? `**${label.slice(0, 3)}** (D${sched.aqDay})` : null;
        })
        .filter(Boolean)
        .join(", ");
      content += `**Days:** ${days || "None"}`;
    }
    const bgSection = new SectionBuilder()
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(content))
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId(`interactive:aq-schedule:edit-bg:${bg}`)
          .setLabel(`Edit BG ${bg}`)
          .setStyle(ButtonStyle.Secondary)
      );
    container.addSectionComponents(bgSection);
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );
  }

  return container;
}
