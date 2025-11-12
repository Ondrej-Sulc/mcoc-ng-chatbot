# Dockerfile for the Web Application

# ---- Base Stage ----
# Common setup for both builder and final stages
FROM node:20 AS base
WORKDIR /usr/src/app
# Install pnpm for efficient monorepo support
RUN npm install -g pnpm

# ---- Builder Stage ----
# This stage builds the web app, including shared dependencies
FROM base AS builder

# Grant ownership to node user before switching
USER root
RUN chown -R node:node /usr/src/app
USER node

# Copy all package files from the monorepo
COPY --chown=node:node pnpm-workspace.yaml ./
COPY --chown=node:node package.json pnpm-lock.yaml ./
COPY --chown=node:node src/package.json ./src/
COPY --chown=node:node web/package.json ./web/

# Install all dependencies for all workspaces
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY --chown=node:node . .

# Generate Prisma Client (needed by shared code)
RUN pnpm exec prisma generate
# Build the web app
RUN pnpm --filter web run build

# ---- Final Stage ----
# This is the final, lean image that will be deployed.
FROM base AS final

# Install OS dependencies as root
USER root
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Create and set ownership for the app directory
RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

# Switch to non-root user
USER node
WORKDIR /usr/src/app

# Copy dependency manifests from builder
COPY --chown=node:node --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --chown=node:node --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/src/package.json ./src/
COPY --chown=node:node --from=builder /usr/src/app/web/package.json ./web/

# Copy prisma schema for runtime
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma

# Install ONLY production dependencies.
RUN pnpm install --prod --filter web...

# Copy the built Next.js application and other necessary files
COPY --chown=node:node --from=builder /usr/src/app/web/.next ./web/.next
COPY --chown=node:node --from=builder /usr/src/app/web/public ./web/public
COPY --chown=node:node --from=builder /usr/src/app/web/next.config.ts ./web/next.config.ts
COPY --chown=node:node --from=builder /usr/src/app/src ./src

# Set the working directory to the web app
WORKDIR /usr/src/app/web

# Expose port and define start command
EXPOSE 3000
CMD ["pnpm", "start"]