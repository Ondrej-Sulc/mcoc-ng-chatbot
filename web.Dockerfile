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
RUN pnpm exec prisma generate
# Build the web app
RUN pnpm --filter web run build

# ---- Final Stage ----
# This is the final, lean image that will be deployed.
FROM base
WORKDIR /usr/src/app

# Copy over the pnpm lockfile and workspace files for installation.
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

# Copy over package.json files for all workspaces to recreate the structure for pnpm.
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/src/package.json ./src/
COPY --from=builder /usr/src/app/web/package.json ./web/

# Copy over the prisma schema.
COPY --from=builder /usr/src/app/prisma ./prisma

# Install ONLY production dependencies for the web workspace and its own dependencies.
# This creates a lean node_modules for the final image.
RUN pnpm install --prod --filter web

# Copy the already-generated Prisma client from the builder stage.
# This is the key fix: we use the client that was generated when all devDependencies
# were present, and we avoid running 'generate' again.
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client


# Copy the rest of the application source code needed at runtime.
COPY --from=builder /usr/src/app/src/ ./src/
COPY --from=builder /usr/src/app/web/public ./web/public

# Copy the built Next.js application.
COPY --from=builder /usr/src/app/web/.next ./web/.next

# Set correct ownership for the node user.
RUN chown -R node:node .
USER node

# Set the working directory to the web app and define the start command.
WORKDIR /usr/src/app/web
CMD ["next", "start"]
