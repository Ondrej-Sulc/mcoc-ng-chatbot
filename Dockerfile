# Dockerfile for the Bot Application

# ---- Base Stage ----
# Common setup for both builder and final stages
FROM node:20 AS base
# Install pnpm for efficient monorepo support
RUN npm install -g pnpm
WORKDIR /usr/src/app

# ---- Builder Stage ----
# This stage builds the bot, including shared dependencies
FROM base AS builder

# First, as root, install OS packages needed for the build
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Copy dependency manifests first to leverage Docker cache
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/

# Grant ownership of all the copied files to the node user
RUN chown -R node:node /usr/src/app

# Switch to non-root user for security
USER node

# Install all dependencies for all workspaces
RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Fetch display fonts (Bebas Neue)
RUN mkdir -p assets/fonts && \
    curl -L -o assets/fonts/BebasNeue-Regular.ttf https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf && \
    curl -L -o assets/fonts/BebasNeue-Regular.woff2 https://fonts.gstatic.com/s/bebasneue/v10/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2

# Generate Prisma Client (needed by shared code)
RUN pnpm exec prisma generate
# Build the bot's typescript code
RUN pnpm run build

# ---- Final Stage ----
# This is the final, lean image for production deployment
FROM base AS final

# Install production OS dependencies as root
USER root
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core fonts-noto-color-emoji && \
    rm -rf /var/lib/apt/lists/*

# Create app directory and grant ownership to node user
RUN mkdir -p /usr/src/app && chown -R node:node /usr/src/app

# Switch to non-root user
USER node
WORKDIR /usr/src/app

# Copy dependency manifests from builder
COPY --chown=node:node --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --chown=node:node --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --chown=node:node --from=builder /usr/src/app/package.json ./
COPY --chown=node:node --from=builder /usr/src/app/src/package.json ./src/

# Install ONLY production dependencies for the core package.
RUN pnpm install --prod --filter @cerebro/core

# Copy the compiled application code and assets from the builder stage.
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/assets ./assets

# Command to run the application
CMD ["node", "dist/index.js"]
