import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
} from "discord.js";
import { AQReminderSettings } from "@prisma/client";
import { convertUtcToUserTime } from "../../../utils/time";

function generateTimeOptions(
  startTime: string,
  timezone: string,
  selectedUtcTime: string
) {
  const options: { label: string; value: string; default: boolean }[] = [];
  const startHour = parseInt(startTime.split(":")[0], 10);

  // Generate 23 hours of options, starting from 1 hour after AQ start
  for (let i = 1; i <= 23; i++) {
    const hour = (startHour + i) % 24;
    const utcTime = `${hour.toString().padStart(2, "0")}:00`;
    const userTime = convertUtcToUserTime(utcTime, timezone);
    options.push({
      label: userTime,
      value: userTime,
      default: false,
    });
  }

  const selectedUserTime = convertUtcToUserTime(selectedUtcTime, timezone);
  let foundSelected = false;
  for (const option of options) {
    if (option.value === selectedUserTime) {
      option.default = true;
      foundSelected = true;
      break;
    }
  }

  if (!foundSelected) {
    options.unshift({
      label: selectedUserTime,
      value: selectedUserTime,
      default: true,
    });
  }

  return options.slice(0, 25);
}

export function buildReminderSettingsContainer(
  settings: AQReminderSettings | null,
  timezone: string,
  startTime: string
) {
  const container = new ContainerBuilder();

  const s1Enabled = settings?.section1ReminderEnabled ?? true;
  const s1Time = settings?.section1PingTime ?? "11:00";
  const s2Enabled = settings?.section2ReminderEnabled ?? true;
  const s2Time = settings?.section2PingTime ?? "18:00";
  const finalEnabled = settings?.finalReminderEnabled ?? true;
  const finalTime = settings?.finalPingTime ?? "11:00";

  const s1Options = generateTimeOptions(startTime, timezone, s1Time);
  const s2Options = generateTimeOptions(startTime, timezone, s2Time);
  const finalOptions = generateTimeOptions(startTime, timezone, finalTime);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("# ⚙️ AQ Reminder Settings"),
    new TextDisplayBuilder().setContent(
      "_Configure when and if reminders are sent for each section of Alliance Quest._"
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));

  // Section 1 Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${s1Enabled ? "✅" : "❌"} Section 1 Reminder ${s1Enabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder pings players that havent completed the first section of AQ._"
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:s1")
        .setPlaceholder(`Select time for Section 1 reminder`)
        .setDisabled(!s1Enabled)
        .addOptions(s1Options)
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`interactive:aq-reminders:toggle:s1:${s1Enabled ? "disable" : "enable"}`)
        .setLabel(s1Enabled ? "Disable" : "Enable")
        .setStyle(s1Enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));

  // Section 2 Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${s2Enabled ? "✅" : "❌"} Section 2 Reminder ${s2Enabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder pings players that havent completed the second section of AQ._"
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:s2")
        .setPlaceholder(`Select time for Section 2 reminder`)
        .setDisabled(!s2Enabled)
        .addOptions(s2Options)
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`interactive:aq-reminders:toggle:s2:${s2Enabled ? "disable" : "enable"}`)
        .setLabel(s2Enabled ? "Disable" : "Enable")
        .setStyle(s2Enabled ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));

  // Final Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## ${finalEnabled ? "✅" : "❌"} Final Reminder ${finalEnabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder pings players that havent completed the final section of AQ._"
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:final")
        .setPlaceholder(`Select time for final reminder`)
        .setDisabled(!finalEnabled)
        .addOptions(finalOptions)
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`interactive:aq-reminders:toggle:final:${finalEnabled ? "disable" : "enable"}`)
        .setLabel(finalEnabled ? "Disable" : "Enable")
        .setStyle(finalEnabled ? ButtonStyle.Danger : ButtonStyle.Success)
    )
  );
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));

  const saveButton = new ButtonBuilder()
    .setCustomId("interactive:aq-reminders:save")
    .setLabel("Save")
    .setStyle(ButtonStyle.Success);

  const backButton = new ButtonBuilder()
    .setCustomId("interactive:aq-schedule:back")
    .setLabel("Back")
    .setStyle(ButtonStyle.Secondary);

  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(saveButton, backButton)
  );

  return container;
}
