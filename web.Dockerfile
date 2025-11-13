# Dockerfile for the Web Application - v2 (Simplified)

# ---- Base ----
# Sets up Node.js and pnpm.
FROM node:20 AS base
RUN npm install -g pnpm
WORKDIR /usr/src/app

# ---- Dependencies ----
# Install ALL dependencies in a single layer, including devDependencies.
# This layer is cached as long as package files don't change.
FROM base AS dependencies
COPY .npmrc pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN CI=true pnpm install --frozen-lockfile

# ---- Final Production Image ----
# Build the application and prune dev dependencies.
FROM dependencies AS production
USER root
# Install any runtime OS packages here if needed (e.g., openssl for Prisma)
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
USER node

# Copy all source code from the host machine
COPY --chown=node:node . .

# The node_modules are already here from the 'dependencies' stage.
# Now, we can build and generate code.

# 1. Generate Prisma Client
RUN pnpm exec prisma generate

# 2. Build the Next.js application
RUN pnpm --filter web run build

# 3. Prune dev dependencies to create a lean, production-only node_modules
RUN pnpm prune --prod

EXPOSE 3000
WORKDIR /usr/src/app/web
CMD ["pnpm", "start"]