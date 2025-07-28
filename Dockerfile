# Dockerfile

# ---- Stage 1: Builder ----
# This stage builds the TypeScript code
FROM node:18-slim AS builder

WORKDIR /usr/src/app

# Copy package files and install ALL dependencies (including dev)
COPY package*.json ./
RUN npm install

# Copy the rest of the source code
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# ---- Stage 2: Production ----
# This stage creates the final, lean image
FROM node:18-slim AS production

WORKDIR /usr/src/app

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm install --only=production

# Copy the built code from the 'builder' stage
COPY --from=builder /usr/src/app/dist ./dist

# Set the user to a non-root user for better security
USER node

# Command to run the application
CMD ["node", "dist/index.js"]