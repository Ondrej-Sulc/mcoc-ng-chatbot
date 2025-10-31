import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  TextDisplayBuilder,
} from "discord.js";
import { prisma } from "../../../services/prismaService";
import { DAY_OPTIONS } from "./utils";
import { convertUtcToUserTime } from "../../../utils/time";

export async function buildOverviewContainer(
  interaction: ChatInputCommandInteraction | any
) {
  const { guildId, user } = interaction;
  const container = new ContainerBuilder();

  const alliance = await prisma.alliance.findUnique({
    where: { guildId },
    include: {
      aqSchedules: true,
      aqSkip: true,
      members: { where: { discordId: user.id, isActive: true } },
      aqReminderSettings: true,
    },
  });

  if (!alliance) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        "This server is not registered as an alliance."
      )
    );
    return container;
  }

  const player = alliance.members[0];
  const timezone = player?.timezone || "UTC";
  const { aqSchedules, aqSkip, aqReminderSettings } = alliance;

  let time = "Not Set";
  let timeSuffix = "";
  if (aqSchedules.length > 0) {
    const firstTime = aqSchedules[0].time;
    if (aqSchedules.every((s) => s.time === firstTime)) {
      time = convertUtcToUserTime(firstTime, timezone);
      timeSuffix = timezone;
    } else {
      time = "Mixed";
    }
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `# 🗓️ AQ Schedule Overview for ${alliance.name}`
    )
  );

  // Battlegroup Sections first
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
          return sched ? `**${label.slice(0, 3)}** *(D${sched.aqDay})*` : null;
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

  container.addSeparatorComponents(new SeparatorBuilder());

  const timeSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Start Time:** 🕒 \`${time} ${timeSuffix}\``
      )
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
          `**Reminders skipped until:** ⏩ <t:${skipEnd}:F>`
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
        new TextDisplayBuilder().setContent("**Reminders are active.**")
      )
      .setButtonAccessory(
        new ButtonBuilder()
          .setCustomId("interactive:aq-schedule:skip")
          .setLabel("Skip Reminders")
          .setStyle(ButtonStyle.Secondary)
      );
  }
  skipSection.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "_Temporarily disable AQ reminders, e.g., for off-season._"
    )
  );

  const createThreadSection = new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**Create AQ Thread:** ${alliance.createAqThread ? "✅ Enabled" : "❌ Disabled"}`
      ),
      new TextDisplayBuilder().setContent(
        "_Automatically create a thread for each AQ day's tracker._"
      )
    )
    .setButtonAccessory(
      new ButtonBuilder()
        .setCustomId("interactive:aq-schedule:toggle-thread")
        .setLabel("Toggle")
        .setStyle(ButtonStyle.Secondary)
    );

      const reminderSettingsSection = new SectionBuilder()

        .addTextDisplayComponents(

            new TextDisplayBuilder().setContent("**Reminders**")

        )

        .setButtonAccessory(

          new ButtonBuilder()

            .setCustomId("interactive:aq-schedule:edit-reminders")

            .setLabel("Reminder Settings")

            .setStyle(ButtonStyle.Secondary)

        );

  container.addSectionComponents(
    timeSection,
    skipSection,
    createThreadSection,
    reminderSettingsSection
  );

  return container;
}