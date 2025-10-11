# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand the MCOC Next-Gen Chatbot project.

## Project Overview

This is a TypeScript-based Discord bot for the mobile game Marvel Contest of Champions (MCOC). It provides a variety of features to server members, including:

*   **Champion Information:** Users can query for information about champions, including their abilities, attacks, and immunities.
*   **Champion Administration:** A powerful admin command to add or update champions in the database.
*   **Prestige Tracking:** Users can update and view their prestige values.
*   **Roster Management:** Users can manage their MCOC rosters.
*   **Scheduling:** The bot can be used to schedule reminders and other events.
*   **AQ Management:** The bot has features to help with Alliance Quest (AQ) management.

The bot is built with a modern tech stack, including:

*   **Language:** TypeScript
*   **Framework:** Discord.js v14
*   **Database:** PostgreSQL with Prisma ORM
*   **APIs:** Google Sheets, OpenRouter, Google Cloud Storage
*   **Containerization:** Docker and Docker Compose

The project is well-structured, with a clear separation of concerns between commands, services, and utilities. It also includes a robust error handling system and a dynamic command loading mechanism.

## Building and Running

The project is fully containerized with Docker, so the easiest way to get started is with Docker Compose.

### Prerequisites

*   Node.js v18+
*   Docker and Docker Compose
*   A Discord Bot application
*   API keys for Google and OpenRouter

### 1. Set Up Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in the values in the `.env` file. This includes your Discord bot token, API keys, the connection details for your PostgreSQL database, and the `GCS_BUCKET_NAME` for champion image uploads.

### 2. Run the Bot

Use Docker Compose to build the images and start the containers (bot and database). The `docker-compose.yaml` is configured for development with hot-reloading.

```bash
docker-compose up --build
```

The bot should now be running and connected to Discord and the database.

### Other Useful Commands

*   **Run tests:** `npm test`
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
*   **Services vs. Utils:**
    *   `src/services`: For modules that connect to external APIs or manage stateful business logic.
    *   `src/utils`: For generic, stateless helper functions and internal application logic handlers.
*   **Type Checking:** To ensure type safety, run the TypeScript compiler without emitting files:
    ```bash
    npx tsc --noEmit
    ```
