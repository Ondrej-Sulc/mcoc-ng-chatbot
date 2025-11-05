# Set Bun and Node version
ARG BUN_VERSION=1.1.13
ARG NODE_VERSION=20.12.2
FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-slim as base

# Set production environment
ENV NODE_ENV="production"

# Bun app lives here
WORKDIR /app

# Install system dependencies required by sharp and libvips.
RUN apt-get update && apt-get install -y \
    libvips-dev \
    build-essential \
    pkg-config \
    fontconfig \
    fonts-roboto \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

# Update font cache after installing fonts.
RUN fc-cache -fv

# Fetch display fonts (Bebas Neue) so runtime doesn't need external network
USER root
RUN apt-get update && apt-get install -y ca-certificates && \
    apt-get install -y --no-install-recommends curl && \
    mkdir -p assets/fonts && \
    curl -L -o assets/fonts/BebasNeue-Regular.ttf https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/bebasneue/BebasNeue-Regular.ttf && \
    curl -L -o assets/fonts/BebasNeue-Regular.woff2 https://fonts.gstatic.com/s/bebasneue/v10/JTUSjIg69CK48gW7PXoo9Wlhyw.woff2 && \
    rm -rf /var/lib/apt/lists/*

# Install fonts for image generation
RUN apt-get update && apt-get install -y fonts-dejavu-core fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*

# Copy package.json and bun.lockb first to leverage Docker's build cache.
COPY package.json ./

# Install node modules
RUN bun install --frozen-lockfile

# Copy the prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN bunx prisma generate

# Copy the rest of your application code.
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN bun run build

# Stage 2: Production / Runtime
FROM imbios/bun-node:${BUN_VERSION}-${NODE_VERSION}-slim as release

WORKDIR /app

# Copy fonts and font configuration from the build stage if your application
# uses sharp for text rendering or needs specific fonts.
COPY --from=base /usr/share/fonts /usr/share/fonts
COPY --from=base /etc/fonts /etc/fonts

# Copy only the necessary files from the build stage to the final image.
COPY --from=base /app/node_modules node_modules
COPY --from=base /app/package.json package.json
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma/client ./node_modules/@prisma/client

# If you had a build step (e.g., 'dist' folder), copy that:
COPY --from=base /app/dist dist
COPY --from=base /app/assets assets

# Create temp directory and set ownership for bun user
RUN mkdir -p /app/temp && chown -R bun:bun /app/temp

# Set the user to 'bun' for security best practices, avoiding running as root.
USER bun

# Expose the port your Bun application listens on (e.g., 3000).
EXPOSE 8080

# Define the command to run your application when the container starts.
CMD ["bun", "run", "dist/index.js"]
