import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { AQReminderSettings } from "@prisma/client";
import { convertUtcToUserTime } from "../../../utils/time";

export function buildReminderSettingsContainer(
  settings: AQReminderSettings | null,
  timezone: string
) {
  const container = new ContainerBuilder();

  const s1Enabled = settings?.section1ReminderEnabled ?? true;
  const s1Time = settings?.section1PingTime ?? "11:00";
  const s2Enabled = settings?.section2ReminderEnabled ?? true;
  const s2Time = settings?.section2PingTime ?? "18:00";
  const finalEnabled = settings?.finalReminderEnabled ?? true;
  const finalTime = settings?.finalPingTime ?? "11:00";

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent("# ⚙️ AQ Reminder Settings"),
    new TextDisplayBuilder().setContent(
      "_Configure when and if reminders are sent for each section of Alliance Quest._"
    )
  );

  // Section 1 Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${s1Enabled ? "✅" : "❌"} Section 1 Reminder ${s1Enabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder is sent after the first section of AQ has started._"
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
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:s1")
        .setPlaceholder(`Select time for Section 1 reminder`)
        .setDisabled(!s1Enabled)
        .addOptions(
          Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, "0");
            const time = `${hour}:00`;
            return {
              label: time,
              value: time,
              default: time === convertUtcToUserTime(s1Time, timezone),
            };
          })
        )
    )
  );

  // Section 2 Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${s2Enabled ? "✅" : "❌"} Section 2 Reminder ${s2Enabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder is sent after the second section of AQ has started._"
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
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:s2")
        .setPlaceholder(`Select time for Section 2 reminder`)
        .setDisabled(!s2Enabled)
        .addOptions(
          Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, "0");
            const time = `${hour}:00`;
            return {
              label: time,
              value: time,
              default: time === convertUtcToUserTime(s2Time, timezone),
            };
          })
        )
    )
  );

  // Final Reminder
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`### ${finalEnabled ? "✅" : "❌"} Final Reminder ${finalEnabled ? "(Active)" : "(Inactive)"}`),
    new TextDisplayBuilder().setContent(
      "_This reminder is sent before the end of the Alliance Quest._"
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
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("interactive:aq-reminders:select:final")
        .setPlaceholder(`Select time for final reminder`)
        .setDisabled(!finalEnabled)
        .addOptions(
          Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, "0");
            const time = `${hour}:00`;
            return {
              label: time,
              value: time,
              default: time === convertUtcToUserTime(finalTime, timezone),
            };
          })
        )
    )
  );

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