# ---- Base Stage ----
# Common setup for both builder and final stages
FROM node:18 AS base
WORKDIR /usr/src/app
# Install pnpm
RUN npm install -g pnpm

# ---- Builder Stage ----
# This stage builds both the bot and the web app
FROM base AS builder
# Copy all package files from the monorepo
COPY package.json pnpm-lock.yaml* ./
COPY src/package.json ./src/
COPY web/package.json ./web/
# Install all dependencies for all workspaces
RUN pnpm install --frozen-lockfile
# Copy the rest of the source code
COPY . .
# Generate Prisma Client
RUN pnpm --filter @cerebro/core exec prisma generate
# Build both the bot and the web app
RUN pnpm run build --filter @cerebro/root && pnpm run build --filter web

# ---- Final Stage: Bot ----
# This stage creates the final, lean image for the bot
FROM base AS bot
WORKDIR /usr/src/app
# Copy production dependencies from the builder stage
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/package.json ./
# Copy the prisma schema and generated client
COPY --from=builder /usr/src/app/prisma ./prisma
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /usr/src/app/node_modules/@prisma/client ./node_modules/@prisma/client
# Copy the built bot code
COPY --from=builder /usr/src/app/dist ./dist
# Set the user to a non-root user for better security
USER node
# Command to run the application
CMD ["node", "dist/index.js"]

# ---- Final Stage: Web ----
# This stage creates the final, lean image for the web app
FROM base AS web
WORKDIR /usr/src/app
# Copy only the web app's production dependencies
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/web/package.json ./web/
COPY --from=builder /usr/src/app/web/.next ./web/.next
COPY --from=builder /usr/src/app/web/public ./web/public
# Set the user to a non-root user for better security
USER node
# Command to run the application
CMD ["pnpm", "run", "start", "--filter", "web"]