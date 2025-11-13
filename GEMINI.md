# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand the CereBro project.

## Project Overview

This is a TypeScript-based Discord bot for the mobile game Marvel Contest of Champions (MCOC). It provides a variety of features to server members, including:

*   **Champion Information:** Users can query for information about champions, including their abilities, attacks, and immunities.
*   **Champion Administration:** A powerful admin command to add or update champions in the database.
*   **Prestige Tracking:** Users can update and view their prestige values.
*   **Roster Management:** Users can manage their MCOC rosters.
*   **Scheduling:** The bot can be used to schedule reminders and other events.
*   **AQ Management:** The bot has features to help with Alliance Quest (AQ) management.

### War Videos Database & Planning

The bot features a sophisticated system for tracking Alliance War performance by linking war plans to video uploads.

*   **Normalized Data Model:** The system is built on a normalized, three-model schema in Prisma:
    *   `War`: Represents a top-level war event, containing metadata like season, tier, and the enemy alliance.
    *   `WarFight`: The core model, representing a single fight (attacker, defender, node) and linking it to a `War`, a `Player`, and optionally, a `WarVideo`.
    *   `WarVideo`: A lean model that represents the video asset itself, containing the video URL and a link to one or more `WarFight` records.

*   **Plan-to-Upload Workflow:**
    1.  The `/aw plan` command reads war plan data from a Google Sheet.
    2.  It then `upserts` `War` and `WarFight` records into the database, creating a persistent record of the war plan.
    3.  A message is sent to each player's private thread containing their assignments and a button labeled "Upload Video(s)".
    4.  When a player clicks the button, the bot generates a temporary, single-use `UploadSession` token that corresponds to that player's list of fights for that war.
    5.  The bot replies with a private link to the web UI, containing the session token.
    6.  The web UI uses the token to fetch the fight data and pre-fills the video upload form, creating a seamless user experience.
    7.  The user can then upload a single video for all their fights or one video per fight. The backend API handles the creation of the `WarVideo` record(s) and links them to the correct `WarFight`(s).

The bot is built with a modern tech stack, including:

*   **Language:** TypeScript
*   **Framework:** Discord.js v14
*   **Database:** PostgreSQL with Prisma ORM
*   **APIs:** Google Sheets, OpenRouter, Google Cloud Storage, PostHog
*   **Containerization:** Docker and Docker Compose

The project is well-structured, with a clear separation of concerns. Commands are organized into their own directories, each containing sub-files for subcommands, handlers, and other related logic. This modular approach is demonstrated in the `roster`, `search`, and `aq` commands. The bot also includes a robust error handling system and a dynamic command loading mechanism.

## Hosting

The production environment for both the bot and its PostgreSQL database is hosted on [Railway](https://railway.app/). This provides a seamless deployment and scaling solution.

## Guiding Principles

*   **Code Quality:** The highest priority is to maintain a clean, readable, and well-organized codebase.
*   **Modularity:** Commands and features should be modular and self-contained to the extent possible. As demonstrated with the `roster`, `search`, and `aq` commands, the preferred structure is to have a directory for each command, with sub-files for subcommands, handlers, and other related logic.
*   **Type Safety:** The project uses TypeScript in strict mode. Avoid using `any` and ensure all new code is type-safe.
*   **Refactoring:** Proactively refactor code to improve its structure and maintainability.
*   **Discord UI Components:** Prioritize the use of Discord UI Components V2 (e.g., `ContainerBuilder`, `TextDisplayBuilder`, `ActionRowBuilder`) over traditional embeds for rich, interactive, and consistent user interfaces. Always ensure the `MessageFlags.IsComponentsV2` flag is set when using these components.

## Web Interface

The project includes a modern, visually appealing web interface built with Next.js and hosted at `/web`. This interface serves as a landing page for the bot, showcasing its features, commands, and providing an FAQ section. It is styled with Tailwind CSS and uses shadcn/ui for its component library.

## Building and Running

The project is fully containerized with Docker, so the easiest way to get started is with Docker Compose.

### Prerequisites

*   Node.js v18+
*   Docker and Docker Compose
*   A Discord Bot application
*   API keys for Google, OpenRouter, and PostHog

### 1. Set Up Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in the values in the `.env` file. This includes your Discord bot token, API keys, the connection details for your PostgreSQL database, the `GCS_BUCKET_NAME` for champion image uploads, and the `POSTHOG_API_KEY` and `POSTHOG_HOST` for product analytics.

### 2. Run the Bot

Use Docker Compose to build the images and start the containers (bot and database). The `docker-compose.yaml` is configured for development with hot-reloading.

```bash
docker-compose up --build
```

The bot should now be running and connected to Discord and the database.

### Other Useful Commands

*   **Build the project:** `npm run build`
*   **Generate Prisma client:** `npm run prisma:generate`
*   **Run database migrations:** `npm run prisma:migrate`
*   **Seed the database:** `npm run prisma:seed`

## Development Conventions

*   **Slash Commands:** All commands are implemented as slash commands.
*   **Subcommands:** Subcommands and subcommand groups are used to create a clear and intuitive command structure.
*   **Modern Components:** Modern Discord UI components (Buttons, Select Menus, Modals) are used to improve user experience.
*   **Error Handling:** A centralized error handling system is used to provide users with a unique error ID while logging detailed context for debugging.
*   **Database:** Prisma is used to manage the PostgreSQL database. The schema is defined in `prisma/schema.prisma`.
*   **Code Style:** The project follows standard TypeScript and Prettier conventions.
*   **Logging:** For consistency and performance, all logging should be done using the `pino` logger, which is available through the `loggerService`. This provides structured, leveled logging. Avoid using `console.log` for any persistent or important logging.
*   **Documentation Maintenance:** Command documentation is managed via a "Single Source of Truth" system. All descriptions, groups, and other metadata are defined in a `help` property within each command's main source file (e.g., `src/commands/somecommand/index.ts`). The `npm run build` command executes a script that automatically generates a master `commands.json` file from this data. This file is then used by both the in-bot `/help` command and the `/web` interface, ensuring all documentation is consistent and automatically updated with code changes. To update documentation, edit the `help` block in the relevant command file.
*   **Services vs. Utils:**
    *   `src/services`: For modules that connect to external APIs or manage stateful business logic.
*   **`src/utils`: For generic, stateless helper functions and internal application logic handlers.

## Important Note on Discord.js Ephemeral Replies

**NEVER** use `ephemeral: true` in Discord.js interaction replies or deferrals. This option is deprecated and can lead to `InteractionAlreadyReplied` errors and other unexpected behavior. Always use `flags: MessageFlags.Ephemeral` instead to ensure correct and consistent ephemeral messaging.

## Docker, PNPM Monorepo, and Deployment Strategy

This project uses a sophisticated Docker setup to manage the `pnpm` monorepo for both local development and production deployments on Railway. The following is a summary of the key configurations and learnings.

### Production Deployment on Railway

The `bot` and `web` services use separate, multi-stage `Dockerfile`s optimized for production.

**Web Service (`web.Dockerfile`):**
The web app deployment uses a simplified and robust multi-stage build process. The previous strategy involving `pnpm deploy` and `pnpm prune` proved to be unreliable and caused numerous build and runtime errors related to Prisma client generation and dependency management.

The new, more standard approach is as follows:
- **`dependencies` stage:** All dependencies (including `devDependencies`) are installed in a cached layer.
- **`production` stage:** This final stage copies the source code and the full `node_modules` directory from the `dependencies` stage, then runs `prisma generate` and `pnpm --filter web run build`. A `chown` command is used to grant the `node` user proper permissions to the `node_modules` directory, which is required for the `prisma generate` step.
- **No Pruning:** The `pnpm prune` step is intentionally omitted. While this results in a larger final image (as `devDependencies` are included), it guarantees a stable and working build by avoiding the bugs and complexities encountered with pruning in this monorepo setup.
- **Next.js 16 Type Error:** The `next.config.ts` file has `typescript: { ignoreBuildErrors: true }` enabled. This is a necessary workaround for a persistent build-time type error related to the new Next.js 16 release, which allows the deployment to succeed.

**Bot Service (`Dockerfile`):**
The bot's production build uses a manual packaging strategy, as `pnpm deploy` was found to ignore the compiled `dist` directory (due to `.gitignore` rules).
- **Manual `cp`:** The `production-builder` stage runs `pnpm run build` and then manually copies the required artifacts (`./dist`, `src/package.json`, `./assets`, `./node_modules`) into a clean `deploy` directory, which is then used for the final image.

### Local Development (`docker-compose.yaml`)

The local development environment is designed for a smooth, hot-reloading workflow while accurately mirroring the containerized setup.
- **`development` Target:** The `docker-compose.yaml` file builds and runs the `development` target of each service's Dockerfile.
- **Anonymous Volumes:** To prevent host-mounted source code from overwriting necessary files generated within the container, several anonymous volumes are used:
    - `/usr/src/app/node_modules` (for both services)
    - `/usr/src/app/src/node_modules` (for the bot)
    - `/usr/src/app/web/node_modules` (for the web app)
    - `/usr/src/app/web/.next` (for the web app's build cache)
- **Entrypoint for Permissions:** The `web` service uses a `docker-entrypoint.sh` script. This script runs as `root` on container startup to `chown` the volume-mounted directories (`.next`, `node_modules`) to the `node` user before stepping down and executing the main application. This solves runtime permission errors caused by mismatched host/container user IDs.