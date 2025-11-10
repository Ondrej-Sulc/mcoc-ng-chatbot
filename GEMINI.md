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
*   **War Videos Database:** Users can upload Marvel Contest of Champions (MCOC) Alliance War videos via a web interface. These videos are stored and managed by the bot, providing a centralized database for war strategies and analysis.

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

## Web Application Deployment on Railway

Deploying the Next.js web application (`/web`) to Railway requires a specific setup due to the `pnpm` monorepo structure. The following are key learnings and configuration requirements:

*   **Monorepo Setup:** The project is a `pnpm` monorepo. The web app (`web`) depends on the bot's code (`src`), which is referenced as a workspace dependency.
*   **`pnpm-workspace.yaml`:** This file is essential for `pnpm` to identify the workspaces and must be present at the project root.
*   **`pnpm-lock.yaml`:** The lockfile is the single source of truth for dependencies. It **must** be kept up-to-date by running `pnpm install` locally and committing the changes after any modification to a `package.json` file. Failure to do so will cause the build to fail with an `ERR_PNPM_OUTDATED_LOCKFILE` error in CI/CD environments.
*   **`web.Dockerfile`:** A dedicated, multi-stage `web.Dockerfile` in the project root is used to build and deploy the web service.
*   **Node.js Version:** Next.js has specific Node.js version requirements (e.g., Node 20+). This must be set as the base image in the Dockerfile (e.g., `FROM node:20 AS base`).
*   **Prisma Generation:** When running `prisma generate` from a workspace subdirectory, the `--schema` flag is required to point to the correct location of the schema file (e.g., `RUN pnpm --filter @cerebro/core exec prisma generate --schema=../prisma/schema.prisma`).
*   **`pnpm` Command Syntax:** The correct syntax for running a script in a specific workspace is `pnpm --filter <workspace> <command>` (e.g., `pnpm --filter web run build`).
*   **Runtime Dependencies in `next.config.ts`:** Any packages imported and used by `next.config.ts` (e.g., `typescript`, `tsconfig-paths-webpack-plugin`) must be listed as regular `dependencies`, not `devDependencies`. This is because Next.js processes this file at runtime, and production builds prune `devDependencies`.
*   **`pnpm deploy` Nuances:** This is the idiomatic way to create a production-ready build for a `pnpm` workspace, but it has several requirements:
    *   **`--legacy` flag:** This flag is required for workspaces that do not use the `inject-workspace-packages=true` setting.
    *   **Empty Target Directory:** The command requires the target directory to be empty. The Dockerfile handles this by using an intermediate `deploy-stage` with an empty target directory.
    *   **Build Artifacts (`.next`):** `pnpm deploy` does **not** copy build artifacts by default. The `.next` directory must be explicitly copied from the `builder` stage into the deployed application.
    *   **File Structure:** `pnpm deploy` creates a flat file structure in the target directory, copying the *contents* of the workspace package. `COPY` paths and the final `WORKDIR` must be adjusted to match this flat structure.