# Dockerfile for the Web Application

# ---- Base Stage ----
# Common setup for both builder and final stages
FROM node:18 AS base
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
RUN pnpm --filter @cerebro/core exec prisma generate
# Build the web app
RUN pnpm run build --filter web

# ---- Final Stage: Production Web ----
# This stage creates the final, lean image for the web app
FROM base AS production-web
WORKDIR /usr/src/app
# Copy only the necessary production files from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/web/package.json ./web/package.json
COPY --from=builder /usr/src/app/web/.next ./web/.next
COPY --from=builder /usr/src/app/web/public ./web/public
COPY --from=builder /usr/src/app/package.json ./
# Set the user to a non-root user for better security
USER node
# Command to run the application
CMD ["pnpm", "run", "start", "--filter", "web"]
