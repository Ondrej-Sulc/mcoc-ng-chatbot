# Dockerfile

# ---- Stage 1: Builder ----
# This stage builds the TypeScript code
FROM node:18 AS builder

WORKDIR /usr/src/app

# Copy package files and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# ---- Stage 2: Production ----
# This stage creates the final, lean image
FROM node:18 AS production

WORKDIR /usr/src/app

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the built code from the 'builder' stage
COPY --from=builder /usr/src/app/dist ./dist

# Install fonts for image generation
USER root
RUN apt-get update && apt-get install -y fonts-dejavu-core fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*

# Set the user to a non-root user for better security
USER node

# Command to run the application
CMD ["node", "dist/index.js"]