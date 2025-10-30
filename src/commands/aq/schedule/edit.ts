import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  ContainerBuilder,
  GuildChannel,
  Role,
  SeparatorBuilder,
  StringSelectMenuBuilder,
  TextDisplayBuilder,
} from "discord.js";
import { DAY_OPTIONS } from "./utils";

export interface SelectOption {
  label: string;
  value: string;
  default: boolean;
}

export async function buildEditBgContainer(
  interaction: ChatInputCommandInteraction | any,
  bg: number,
  state: any
) {
  const container = new ContainerBuilder();
  const { guild } = interaction;

  const roles = await guild.roles.fetch();
  const channels = await guild.channels.fetch();

  const roleOptions: SelectOption[] = roles
    .filter((r: Role) => !r.managed && r.name !== "@everyone")
    .map((r: Role) => ({
      label: r.name,
      value: r.id,
      default: r.id === state.role,
    }));
  const channelOptions: SelectOption[] = channels
    .filter((c: GuildChannel) => c.type === 0)
    .map((c: GuildChannel) => ({
      label: `#${c.name}`,
      value: c.id,
      default: c.id === state.channel,
    }));

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `## ✏️ Editing Schedule for Battlegroup ${bg}`
    ),
    new TextDisplayBuilder().setContent(
      "### Select the role to ping and the channel to post the AQ tracker in."
    )
  );

  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`interactive:aq-schedule:select:role:${bg}`)
        .setPlaceholder("Select a role")
        .addOptions(
          roleOptions.map((o: SelectOption) => ({
            label: o.label,
            value: o.value,
            default: o.default,
          }))
        )
    )
  );
  container.addActionRowComponents(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`interactive:aq-schedule:select:channel:${bg}`)
        .setPlaceholder("Select a channel")
        .addOptions(
          channelOptions.map((o: SelectOption) => ({
            label: o.label,
            value: o.value,
            default: o.default,
          }))
        )
    )
  );

  container.addSeparatorComponents(new SeparatorBuilder());

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      "### For each AQ day, select the day of the week it will run."
    )
  );

  for (let day = 1; day <= 4; day++) {
    const dayOfWeek = state[`day${day}`];
    const dayOptions = DAY_OPTIONS.map((d) => ({
      ...d,
      default:
        dayOfWeek !== null && dayOfWeek !== undefined
          ? dayOfWeek.toString() === d.value
          : false,
    }));
    container.addActionRowComponents(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`interactive:aq-schedule:select:day${day}:${bg}`)
          .setPlaceholder(`AQ Day ${day}`)
          .addOptions(dayOptions)
      )
    );
  }
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addActionRowComponents(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`interactive:aq-schedule:save:${bg}`)
        .setLabel("Save")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`interactive:aq-schedule:back`)
        .setLabel("Back")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}
