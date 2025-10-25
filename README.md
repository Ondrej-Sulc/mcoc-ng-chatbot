# NG Bot for MCOC

*This bot is an unofficial fan-made tool and is not affiliated with, endorsed, or sponsored by Marvel or Kabam. All game content and materials are trademarks and copyrights of their respective owners.*

A personal, modular Discord bot built with TypeScript, designed for Marvel Contest of Champions (MCOC) related tasks. This bot integrates with Google Sheets for data logging and OpenRouter for AI capabilities, all running on Discord.js v14.

## Key Features

- **Dynamic Command Loading:** Commands in the `src/commands` directory are automatically registered on startup.
- **Champion Administration:** A powerful admin command to add or update champions, abilities, attacks, and glossary entries in the database. The champion creation process is handled through a user-friendly, two-part interactive modal, and the image update command features autocomplete for champion names. This command automates the entire process, including:
    - **Image Processing:** Downloads champion images, resizes them to multiple dimensions (256, 128, 64, 32), and applies a subtle blur to smaller sizes.
    - **Cloud Storage:** Uploads the processed images to a Google Cloud Storage bucket.
    - **AI Tag Extraction:** Uses an AI model (via OpenRouter) to analyze a provided image and extract a champion's tags.
    - **AI Ability Drafting:** Leverages AI to draft abilities and immunities for champions based on their full abilities JSON.
    - **Application Emoji Creation:** Automatically creates a new application emoji for the champion.
    - **Database Integration:** Upserts the champion data into the PostgreSQL database, ensuring no duplicates are created.
- **Roster Management:** A comprehensive `/roster` command that allows users to manage their personal champion rosters. It includes subcommands to `update` (via OCR from screenshots), `view`, `delete`, `summary`, and `export` champions, providing a full suite of tools for roster maintenance.
- **Advanced Search:** A powerful `/search` command with two main subcommands:
    - `/search all`: Performs a global search across all champions in the database based on a wide range of criteria, including abilities, immunities, tags, classes, ability categories, and attack types.
    - `/search roster`: Allows users to search within their own personal roster, making it easy to find specific champions they own.
- **AQ Management:** An interactive `/aq` command to manage Alliance Quest (AQ) trackers. Users can `start` and `end` trackers, and progress is updated through interactive buttons, providing a real-time view of the AQ status.
- **PostgreSQL Database:** Uses a robust PostgreSQL database managed with Prisma for persistent data storage.
- **Google Sheets Integration:** Utilizes Google Sheets for data storage and retrieval (e.g., for scheduling).
- **Advanced Scheduling:** Schedule commands or custom messages with flexible timing (daily, weekly, monthly, custom cron, etc.) via `/schedule`.
- **Centralized Error Handling:** A robust system that provides users with a unique error ID while logging detailed context for debugging.
- **Dockerized Environment:** Fully containerized with Docker Compose for consistent development and easy deployment, including a PostgreSQL database service.
- **AI Capabilities:** Integration with OpenRouter for advanced AI features, including champion ability drafting and tag extraction.
- **Dynamic Thumbnail Generation:** A sophisticated service (`src/utils/thumbnailGenerator.ts`) that generates custom, visually rich thumbnails for champion-related commands. It uses a champion's class to theme the image with unique colors and intricate SVG background patterns. These patterns are highly configurable, allowing for easy adjustments to their scale and opacity to fine-tune the final look.

## Technology Stack

- **Language:** TypeScript (Strict Mode)
- **Framework:** Discord.js v14
- **Database:** PostgreSQL with Prisma ORM
- **APIs:** Google Sheets, OpenRouter, Google Cloud Storage
- **Scheduling:** `node-cron`
- **Containerization:** Docker & Docker Compose

## Commands

| Command | Description |
| --- | --- |
| `/admin` | Administrative commands for managing champions, abilities, attacks, and the glossary. |
| `/aq` | Alliance Quest (AQ) utilities. |
| `/aw` | Commands for Alliance War planning and details. |
| `/debug` | Debugging commands, restricted to bot administrators. |
| `/glossary` | Look up MCOC effects, buffs, and debuffs. |
| `/champion` | Get detailed information about any champion in the game. |
| `/prestige` | Extract prestige values from an MCOC screenshot or view the leaderboard. |
| `/profile` | Manage your player profile. |
| `/roster` | Manage your MCOC roster. |
| `/schedule` | Manage scheduled tasks. |
| `/search` | Powerful search for champions based on various criteria. |
| `/summarize` | Summarizes recent messages in a channel or thread using AI. |
| `/help` | Displays an interactive help guide for all bot commands. |

---

## Emoji Handling (Application Emojis)

This bot uses application-owned emojis to ensure consistent rendering across production and development bots, even when emoji IDs differ.

- **How it works**: Emojis are referenced by name in stored strings (e.g., `<:Blade:12345>`). At runtime, the bot resolves the name to the current application’s emoji ID and rewrites the markup automatically. Animated vs static is preserved.
- **No guild dependency**: Resolution uses application emojis attached to the bot application (managed in the Dev Portal or via API), not guild emojis. A fallback to guild/client emoji caches exists for legacy cases, but the intended source is application emojis.
- **Name matching required**: Ensure the same emoji NAMES exist in both your prod and dev applications. IDs can differ; names must match.
- **Load timing**: Application emojis are loaded on startup. If you add/remove emojis, restart the bot (or add a reload command later).
- **Troubleshooting**:
  - If emojis don’t render, verify that the application has emojis with the expected names and that the bot has permission to use them.
  - Startup will log a warning if the application emoji list is empty or the response shape is unrecognized.

Manage emojis in: Discord Developer Portal → Your Application → Emojis.

---

## Migration from Legacy Bot

This project is a complete rewrite of a legacy Python-based MCOC bot. The migration is now complete, with all relevant commands having been transitioned to a modern, TypeScript-based slash command architecture utilizing modern Discord UI components, a robust PostgreSQL database, and improved code quality.

## Getting Started (Local Development)

The bot is designed to be run in a Dockerized environment. The `docker-compose.yaml` file is configured for a development environment with hot-reloading.

---

## Project Structure

mcoc-ng-chatbot/
├── prisma/ # Prisma schema and migration files
│ └── schema.prisma
├── src/
│ ├── commands/ # Each directory is a slash command with subcommands
│ │ ├── roster/ # Example of a command with subcommands
│ │ │   ├── index.ts # Main command logic and subcommand router
│ │ │   ├── add.ts # Logic for the 'add' subcommand
│ │ │   └── ... # Other subcommand files
│ │ ├── search/
│ │ └── aq/
│ ├── services/ # Modules for external APIs and business logic
│ ├── types/ # Shared TypeScript interfaces and types
│ ├── utils/ # Generic helpers and internal logic handlers
│ ├── config.ts # Environment variable loading and validation
│ └── index.ts # Bot entry point, client setup, event handlers
├── Dockerfile # Multi-stage build for lean production images
├── docker-compose.yaml # Development environment setup
└── README.md # You are here

### Directory Distinction

To maintain a clean and scalable architecture, the project distinguishes between `services` and `utils`:

-   **`src/services`**: This directory is for modules that connect to external APIs or manage a specific, stateful, or long-running part of the application's business logic. They act as specialized providers of functionality.
    -   *Examples*: `openRouterService.ts`, `sheetsService.ts`, `schedulerService.ts`, `aqReminderService.ts`.

-   **`src/utils`**: This directory contains more generic, often stateless helper functions, formatters, type guards, or internal application logic handlers (like command and error handling). They are broadly reusable across different parts of the application.
    -   *Examples*: `errorHandler.ts`, `emojiResolver.ts`, `commandHandler.ts`.
