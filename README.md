# MCOC Next-Gen Chatbot (TypeScript)

A personal, modular Discord bot built with TypeScript, designed for Marvel Contest of Champions (MCOC) related tasks. This bot integrates with Google Sheets for data logging and OpenRouter for AI capabilities, all running on Discord.js v14.

## Key Features

- **Dynamic Command Loading:** Commands in the `src/commands` directory are automatically registered on startup.
- **PostgreSQL Database:** Uses a robust PostgreSQL database managed with Prisma for persistent data storage.
- **Google Sheets Integration:** Utilizes Google Sheets for data storage and retrieval (e.g., for scheduling).
- **Advanced Scheduling:** Schedule commands or custom messages with flexible timing (daily, weekly, custom cron, etc.) via `/schedule`.
- **Centralized Error Handling:** A robust system that provides users with a unique error ID while logging detailed context for debugging.
- **Dockerized Environment:** Fully containerized with Docker Compose for consistent development and easy deployment, including a PostgreSQL database service.
- **AI Capabilities:** Integration with OpenRouter for advanced AI features.
- **Dynamic Thumbnail Generation:** A sophisticated service (`src/utils/thumbnailGenerator.ts`) that generates custom, visually rich thumbnails for champion-related commands. It uses a champion's class to theme the image with unique colors and intricate SVG background patterns. These patterns are highly configurable, allowing for easy adjustments to their scale and opacity to fine-tune the final look.

## Technology Stack

- **Language:** TypeScript (Strict Mode)
- **Framework:** Discord.js v14
- **Database:** PostgreSQL with Prisma ORM
- **APIs:** Google Sheets, OpenRouter
- **Scheduling:** `node-cron`
- **Containerization:** Docker & Docker Compose

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

## Migration

This section outlines the plan and progress for migrating commands from the legacy Python bot to this new TypeScript version.

**Migration Goals & Rules:**

- **Slash Commands Only:** All commands will be implemented as slash commands (`/`).
- **Effective Subcommands:** Use subcommands and subcommand groups to create a clear and intuitive command structure.
- **Modern Components:** Utilize modern Discord UI components (Buttons, Select Menus, Modals) where applicable to improve user experience.
- **Robust Error Handling:** Implement comprehensive error handling for all commands.
- **Database:** Transition from JSON files to a more robust database solution.
- **Code Quality:** Ensure all new code is well-documented, follows the existing project structure, and is written in an idiomatic TypeScript style.

Database Migration & Seeding

The bot now utilizes a PostgreSQL database managed by Prisma for persistent storage of structured game data.

- Schema Definition: The database schema is fully defined in prisma/schema.prisma, modeling entities like Champions, Abilities, Tags, and Attacks.
- Data Seeding: A comprehensive seeding script (prisma/seed.ts) has been created to migrate data from legacy JSON files (legacy/champions_data.json, legacy/glossary.json) into the PostgreSQL database.
  - This script handles the full lifecycle: clearing existing data, creating relational structures (Categories, Tags), and populating Champion data along with its complex relationships (Abilities, Immunities, Attacks).
  - It ensures data integrity and handles potential duplicates in the source JSON.
- Data Sources Migrated: - Glossary Data: Populated into AbilityCategory and Ability tables. - Champion Data: Fully migrated. This includes core champion details, prestige costs, image URLs, tags, normalized attack data (Light, Medium, Heavy, Special attacks and their individual hits), and structured links to abilities and immunities.
  This structured database is now the central source for all champion-related information within the bot.

**Legacy Command Status:**

_This list will be populated to track the migration status of each command._

- **`account.py`**:
  - `/link_account`: Migrated to `/profile register`
  - `/delete_account_link`: To be reviewed
  - `/register_thread`: Not planned for migration (server-specific)
  - `/unregister_thread`: Not planned for migration (server-specific)
- **`admin.py`**:
  - `/update_bot`: Not to be migrated (not necessary anymore)
  - `/sync_commands`: Not to be migrated (not necessary anymore)
  - `/update`: Not to be migrated (not necessary anymore)
- **`aq.py`**:
  - `/aq` (group command): Migrated
    - `/aq start`: Migrated
    - `/aq end`: Migrated
    - `/aq test_ping`: Just migrated for testing then removed
- **`champion_info.py`**:
  - `/full_abilities`: Migrated to `/champion info`
  - `/glossary`: Migrated to `/glossary effect`
  - `/glossary_category`: Migrated to `/glossary category`
  - `/attacks`: Migrated to `/champion attacks`
  - `/search`: Migrated to `/search all`
  - `/my_roster_search`: Migrated to `/search roster`
  - `/roster_search`: Migrated to `/search roster`
  - `/duel`: To be reviewed (requires external data source)
  - `/immunities`: Migrated to `/champion immunities`
  - `/abilities`: Migrated to `/champion abilities`
- **`general.py`**:
  - `/summarize`: Migrated
  - `/hello`: Not to be migrated (redundant)
- **`prestige.py`**:
  - `/prestige_list`: Migrated to `/prestige leaderboard`
  - `/prestige`: Migrated to `/prestige update`
- **`remind.py`**:
  - `/remind`: Not to be migrated (replaced by new scheduler)
  - `/remind_mute`: Not to be migrated (replaced by new scheduler)
  - `/remind_list`: Not to be migrated (replaced by new scheduler)
  - `/remind_delete`: Not to be migrated (replaced by new scheduler)
- **`roster.py`**:
  - `$roster` (text command, needs migration to slash): Migrated to `/roster update` and `/roster view`
  - `/roster_clear_cache`: Obsolete
  - `/roster_add`: Obsolete
  - `/roster_delete`: Migrated to `/roster delete`
  - `/roster_convert`: Obsolete
- **`war.py`**:
  - `/aw_plan`: Migrated
  - `/aw_details`: Migrated

### Roster Command Overhaul

The legacy `$roster` text command has been completely migrated and overhauled into a powerful and flexible `/roster` slash command with multiple subcommands.

-   **`/roster update`**:
    -   **Ascended Status**: Now supports an `is_ascended` flag to correctly log ascended champions.
    -   **Parallel Processing**: Processes multiple screenshots concurrently, significantly speeding up large roster updates.
    -   **Modern UI**: Displays results in a clean, modern UI using Discord's V2 components, including a gallery of the processed images.
    -   **Improved Error Handling**: Collects all errors from image processing and presents them in a single, clean summary.

-   **`/roster view`**:
    -   **Pagination**: Large rosters are now displayed in a paginated embed, navigable with interactive buttons. Pages are cached for 15 minutes for quick access.
    -   **Filtering**: Supports filtering the roster by `stars`, `rank`, and the new `is_ascended` status.

-   **`/roster summary` (New)**:
    -   Provides a detailed breakdown of the roster, showing champion counts per star level, with further details on rank and class distribution.

-   **`/roster export` (New)**:
    -   Generates and sends a complete CSV file of the player's roster, including the `isAscended` status.

-   **`/roster delete`**:
    -   Migrated from the legacy bot, this command now supports filtering by `champion`, `stars`, `rank`, and `is_ascended` status for precise deletions.

-   **Database Resilience**:
    -   Work is in progress to implement a retry mechanism for database operations, making the bot more resilient to transient connection issues.

### Search Command Overhaul

The legacy search commands have been consolidated into a single, powerful `/search` command with subcommands, leveraging the PostgreSQL database for complex queries.

-   **`/search all`**:
    -   Replaces the original `/search` command.
    -   Allows searching all champions in the game based on a combination of criteria, including `abilities`, `immunities`, `tags`, `class`, and even `ability-category`.
    -   Supports complex queries with `and`/`or` logic.

-   **`/search roster`**:
    -   Replaces the `/my_roster_search` and `/roster_search` commands.
    -   Performs the same advanced searches as `/search all`, but filters the results against a specified player's roster (defaults to the user running the command).
    -   Results are paginated and displayed in an easy-to-read embed.

---

## Getting Started (Local Development)

### Prerequisites

- Node.js v18+
- Docker and Docker Compose
- A Discord Bot application
- API keys for Google and OpenRouter

### 1. Clone the Repository

### 2. Set Up Environment Variables

Create a `.env` file by copying the example:

Fill in the values in the `.env` file. This includes your Discord bot token, API keys, and the connection details for your PostgreSQL database.

**Important:** For `GOOGLE_CREDENTIALS_JSON`, you must provide the full JSON content of your service account key, encoded in Base64. You can generate this with the following command:

```bash
# For Windows (in PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("/path/to/your/credentials.json"))
```

Copy the resulting string into the `.env` file.

### 3. Run the Bot

Use Docker Compose to build the images and start the containers (bot and database). The `docker-compose.yaml` is configured for development with hot-reloading.

```bash
docker-compose up --build
```

The bot should now be running and connected to Discord and the database.

---

## Project Structure

mcoc-ng-chatbot/
├── prisma/ # Prisma schema and migration files
│ └── schema.prisma
├── src/
│ ├── commands/ # Each file or directory is a slash command
│ │ └── search/ # Example of a command with sub-files
│ │   ├── index.ts # Main command logic
│ │   └── utils.ts # Command-specific helpers
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
    -   *Examples*: `errorHandler.ts`, `emojiResolver.ts`, `commandHandler.ts`, `aqState.ts`, `aqView.ts`.
