# Dockerfile for the Bot Application

# ---- Base Stage ----
# Common setup for both builder and final stages
FROM node:20 AS base
WORKDIR /usr/src/app
# Install pnpm for efficient monorepo support
RUN npm install -g pnpm

# ---- Builder Stage ----
# This stage builds the bot, including shared dependencies
FROM base AS builder
# Copy all package files from the monorepo
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
# Install all dependencies for all workspaces
RUN pnpm install --frozen-lockfile
# Copy the rest of the source code
COPY . .
# Generate Prisma Client (needed by shared code)
RUN pnpm exec prisma generate
# Build the bot's typescript code
RUN pnpm run build

# ---- Final Stage ----
# This is the final, lean image for production deployment
FROM base
WORKDIR /usr/src/app

# Copy over the pnpm lockfile and workspace files for installation.
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

# Copy over package.json files for all workspaces to recreate the structure for pnpm.
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/src/package.json ./src/

# Install ONLY production dependencies for the core package.
RUN pnpm install --prod --filter @cerebro/core

# Copy the already-generated Prisma client from the builder stage.
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copy the compiled application code from the builder stage.
COPY --from=builder /usr/src/app/dist ./dist

# Set correct ownership for the node user.
RUN chown -R node:node .
USER node

# Command to run the application
CMD ["node", "dist/index.js"]
