# Dockerfile for the Web Application

# ---- Base ----
# Sets up Node.js, pnpm, and gosu for user switching.
FROM node:20 AS base
RUN npm install -g pnpm
# Install gosu for entrypoint permission handling
RUN apt-get update && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*
WORKDIR /usr/src/app

# ---- Dependencies ----
# Creates a layer with all monorepo dependencies installed.
FROM base AS dependencies
COPY pnpm-workspace.yaml ./
COPY package.json pnpm-lock.yaml ./
COPY src/package.json ./src/
COPY web/package.json ./web/
RUN pnpm install --frozen-lockfile

# ---- Builder ----
# A stage that includes source code and can be used for development or production builds.
FROM dependencies AS builder
USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*
# Create assets directory and set permissions before switching user
RUN mkdir -p /usr/src/app/assets/fonts && \
    chown -R node:node /usr/src/app
USER node
# Now that the directory exists and has correct ownership, copy code and download fonts
COPY --chown=node:node . .
RUN curl -L -o assets/fonts/BebasNeue-Regular.ttf https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf && \
    curl -L -o assets/fonts/BebasNeue-Regular.woff2 https://fonts.gstatic.com/s/bebasneue/v10/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2
RUN pnpm exec prisma generate

# ---- Development ----
# This stage is for local development with hot-reloading.
FROM builder AS development
USER root
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
WORKDIR /usr/src/app/web
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]

# ---- Production Builder ----
# This stage builds the app and uses pnpm deploy with a custom .npmignore
# to ensure build artifacts are included.
FROM builder AS production-builder
# 1. Build the Next.js app
RUN pnpm --filter web run build
# 2. Create a temporary .npmignore in the web workspace to override .gitignore.
#    This ensures that the .next directory is included by `pnpm deploy`.
RUN echo '!/.next' > /usr/src/app/web/.npmignore
# 3. Deploy the web workspace using pnpm deploy. It will correctly prune
#    node_modules and handle workspace dependencies.
RUN pnpm deploy --legacy --prod --filter web /usr/src/app/deploy

# 4. Manually generate Prisma client in the final deploy directory
WORKDIR /usr/src/app/deploy
# The node_modules from `pnpm deploy` is problematic. Remove it.
RUN rm -rf node_modules
# Copy config files needed for a clean install
COPY --from=builder /usr/src/app/pnpm-lock.yaml .
COPY --from=builder /usr/src/app/.npmrc .
# Install fresh production node_modules. CI=true is required in non-interactive envs.
RUN CI=true pnpm install --prod

# Now add prisma, generate the client, and remove it
COPY --from=builder /usr/src/app/prisma ./prisma
RUN pnpm add prisma --prod
RUN pnpm exec prisma generate
RUN pnpm remove prisma
WORKDIR /usr/src/app

# ---- Final Production Image ----
FROM base AS production
USER root
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
USER node
WORKDIR /usr/src/app
# Copy the cleanly deployed application from the production-builder stage
COPY --chown=node:node --from=production-builder /usr/src/app/deploy .
EXPOSE 3000
# pnpm deploy sets up the package.json and node_modules so this works
CMD ["pnpm", "start"]
