import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Collection,
} from "discord.js";
import { config } from "./config";
import { loadCommands, commands } from "./utils/commandHandler";
import { Command } from "./types/command";
import { getButtonHandler } from "./utils/buttonHandlerRegistry";
import { startScheduler } from "./services/schedulerService";
import http from "http";
import { handleError, safeReply } from "./utils/errorHandler";
import { loadApplicationEmojis } from "./services/applicationEmojiService";
import { loadChampions } from "./services/championService";
import { initializeAqReminders } from "./services/aqReminderService.js";
import { getModalHandler } from "./utils/modalHandlerRegistry";
import posthogClient from "./services/posthogService";

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});

client.commands = commands;

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot connected as ${readyClient.user.username}`);

  // We start a minimal HTTP server just for health checks.
  const port = process.env.PORT || 8080;
  http
    .createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Bot is healthy and running!\n");
    })
    .listen(port, () => {
      console.log(`HTTP health check server listening on port ${port}`);
    });

  await loadCommands();
  const commandData = Array.from(client.commands.values()).map((command) =>
    command.data.toJSON()
  );
  try {
    await readyClient.application.commands.set(commandData);
    console.log(
      `🔄 Successfully registered ${commandData.length} global slash command(s).`
    );
  } catch (error) {
    console.error(`❌ Failed to register global slash commands:`, error);
  }
  // Load application emojis once at startup so resolver can reference them
  try {
    await loadApplicationEmojis(client);
    console.log("🎨 Application emojis loaded.");
  } catch (e) {
    console.warn("⚠️ Failed to load application emojis:", e);
  }
  // Load champion data into cache
  try {
    await loadChampions();
  } catch (e) {
    console.warn("⚠️ Failed to load champions:", e);
  }
  // Start scheduler after bot is ready
  await startScheduler(client);
  initializeAqReminders(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions generically
  if (interaction.isButton()) {
    try {
      if (posthogClient) {
        posthogClient.capture({
          distinctId: interaction.user.id,
          event: 'button_clicked',
          properties: {
            custom_id: interaction.customId,
            user_tag: interaction.user.tag,
            guild_id: interaction.guild?.id,
            channel_id: interaction.channel?.id,
            message_id: interaction.message.id,
          },
        });
      }
    } catch (e) {
      console.error("Error capturing PostHog event for button click:", e);
    }

    const handler = getButtonHandler(interaction.customId);
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        const { userMessage, errorId } = handleError(error, {
          location: `button:${interaction.customId}`,
          userId: interaction.user?.id,
        });
        await safeReply(interaction, userMessage, errorId);
      }
    } else {
      await safeReply(interaction, "Unknown button.");
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    try {
      if (posthogClient) {
        const fields = interaction.fields.fields.map((field) => ({
          customId: field.customId,
          value: field.value,
        }));

        posthogClient.capture({
          distinctId: interaction.user.id,
          event: 'modal_submitted',
          properties: {
            custom_id: interaction.customId,
            user_tag: interaction.user.tag,
            guild_id: interaction.guild?.id,
            channel_id: interaction.channel?.id,
            fields: fields,
          },
        });
      }
    } catch (e) {
      console.error("Error capturing PostHog event for modal submission:", e);
    }

    const handler = getModalHandler(interaction.customId);
    if (handler) {
      try {
        await handler(interaction);
      } catch (error) {
        const { userMessage, errorId } = handleError(error, {
          location: `modal:${interaction.customId}`,
          userId: interaction.user?.id,
        });
        await safeReply(interaction, userMessage, errorId);
      }
    } else {
      await safeReply(interaction, "Unknown modal.");
    }
    return;
  }

  // Handle autocomplete interactions
  if (interaction.isAutocomplete()) {
    const command = client.commands.get(interaction.commandName);
    if (command && command.autocomplete) {
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        handleError(error, {
          location: `autocomplete:${interaction.commandName}`,
          userId: interaction.user?.id,
        });
        // No user feedback for autocomplete errors
      }
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);

  if (!command) {
    handleError(
      new Error(`No command matching ${interaction.commandName} was found.`),
      {
        location: `command:${interaction.commandName}`,
        userId: interaction.user?.id,
      }
    );
    return;
  }

  try {
    if (posthogClient) {
      const subcommand = interaction.options.getSubcommand(false);
      const subcommandGroup = interaction.options.getSubcommandGroup(false);

      const properties: Record<string, any> = {
          user_tag: interaction.user.tag,
          guild_id: interaction.guild?.id,
          command: interaction.commandName,
      };
      if (subcommand) properties.subcommand = subcommand;
      if (subcommandGroup) properties.subcommandGroup = subcommandGroup;

      const allOptions = [...interaction.options.data];
      const flatOptions: any[] = [];
      
      function flatten(opts: any[]) {
          for (const opt of opts) {
              if (opt.options) {
                  flatten(opt.options);
              }
              else {
                  flatOptions.push(opt);
              }
          }
      }
      flatten(allOptions);

      for (const opt of flatOptions) {
          properties[`option_${opt.name}`] = opt.value;
      }

      posthogClient.capture({
        distinctId: interaction.user.id,
        event: 'command_executed',
        properties,
      });
    }
  } catch (e) {
    console.error("Error capturing PostHog event:", e);
  }

  try {
    await command.execute(interaction);
  } catch (error) {
    const { userMessage, errorId } = handleError(error, {
      location: `command:${interaction.commandName}`,
      userId: interaction.user?.id,
    });
    await safeReply(interaction, userMessage, errorId);
  }
});

client.on('destroy', async () => {
    if (posthogClient) {
        await posthogClient.shutdown();
    }
});

if (!config.BOT_TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN is not defined in the .env file.");
}
try {
  client.login(config.BOT_TOKEN);
} catch (error) {
  console.error("Failed to login to Discord:", error);
  process.exit(1);
}
