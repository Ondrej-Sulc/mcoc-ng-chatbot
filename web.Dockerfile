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
COPY . .
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
# This stage builds the final, lean production image.
FROM builder AS production-builder
RUN pnpm --filter web run build
RUN pnpm deploy --legacy --prod --filter web /usr/src/app/deploy

# ---- Final Production Image ----
FROM base AS production
USER root
RUN apt-get update && apt-get install -y --no-install-recommends openssl && \
    rm -rf /var/lib/apt/lists/*
USER node
WORKDIR /usr/src/app
COPY --chown=node:node --from=production-builder /usr/src/app/deploy .
WORKDIR /usr/src/app/web
EXPOSE 3000
CMD ["pnpm", "start"]
