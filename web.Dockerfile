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

# ---- Deploy Stage ----
# This stage creates the clean production deployment in a separate directory
FROM base AS deploy-stage
WORKDIR /tmp
# Copy the necessary files from the builder stage
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/src ./src
COPY --from=builder /usr/src/app/web ./web
# Deploy the web app to a clean directory named 'app'
RUN pnpm deploy --prod --filter web --legacy ./app
# Explicitly copy the .next build output into the deployed web app
COPY --from=builder /usr/src/app/web/.next ./app/web/.next

# ---- Final Stage ----
# This is the final, lean image
FROM base
WORKDIR /usr/src/app
# Copy the deployed app from the deploy-stage
COPY --from=deploy-stage /tmp/app .
USER node
WORKDIR /usr/src/app/web
CMD ["pnpm", "start"]
