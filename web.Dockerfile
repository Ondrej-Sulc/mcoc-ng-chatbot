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

# As root, create and set ownership for the app directory
USER root
RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

# Switch to the non-root user for security
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

# Create a pruned, production-ready deployment directory for the web app
RUN pnpm deploy --legacy --prod --filter web /usr/src/app/deploy

# ---- Final Stage ----
# This is the final, lean image that will be deployed.
FROM base AS final

# As root, install required OS packages
USER root
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*

# Create and set ownership for the app directory
RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

# Switch to the non-root user
USER node
WORKDIR /usr/src/app

# Copy the deployed application from the builder stage.
# This includes production node_modules, the .next folder, public assets, etc.
COPY --chown=node:node --from=builder /usr/src/app/deploy .

# The `pnpm deploy` command structures the output relative to the workspace.
# We need to set the WORKDIR to the web app's directory within the deployed files.
WORKDIR /usr/src/app/web

# Expose port and define start command
EXPOSE 3000
CMD ["pnpm", "start"]
