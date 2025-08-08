import {
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  Collection,
  MessageFlags,
} from "discord.js";
import { config } from "./config";
import { loadCommands, commands } from "./utils/commandHandler";
import { Command } from "./types/command";
import { getButtonHandler } from "./utils/buttonHandlerRegistry";
import { startScheduler } from "./utils/schedulerService";
import http from "http";
import { handleError, safeReply } from "./utils/errorHandler";
import { loadApplicationEmojis } from "./utils/applicationEmojiService";

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
  // Start scheduler after bot is ready
  await startScheduler(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  // Handle button interactions generically
  if (interaction.isButton()) {
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
    await command.execute(interaction);
  } catch (error) {
    const { userMessage, errorId } = handleError(error, {
      location: `command:${interaction.commandName}`,
      userId: interaction.user?.id,
    });
    await safeReply(interaction, userMessage, errorId);
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