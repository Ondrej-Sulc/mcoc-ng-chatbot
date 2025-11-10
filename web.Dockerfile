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
RUN pnpm --filter @cerebro/core exec prisma generate --schema=../prisma/schema.prisma
# Build the web app
RUN pnpm --filter web run build

# ---- Final Stage: Production Web ----
# This stage creates the final, lean image for the web app
FROM base AS production-web
WORKDIR /usr/src/app
# Copy only the files needed for deployment from the builder
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/web ./web
# Use pnpm deploy to create a clean production-only build of the web app
RUN pnpm deploy --prod --filter web .
USER node
WORKDIR /usr/src/app/web
CMD ["pnpm", "start"]
