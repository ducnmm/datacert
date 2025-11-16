# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Install OpenSSL for Prisma and curl for Walrus CLI
RUN apt-get update -y && \
    apt-get install -y openssl curl && \
    rm -rf /var/lib/apt/lists/*

# Install Walrus CLI
RUN curl -fsSL https://storage.googleapis.com/mysten-walrus-binaries/walrus-testnet-latest-ubuntu-x86_64 -o /usr/local/bin/walrus && \
    chmod +x /usr/local/bin/walrus

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copy Walrus setup script
COPY scripts/setup-walrus.sh /app/scripts/setup-walrus.sh
RUN chmod +x /app/scripts/setup-walrus.sh

# Create logs directory
RUN mkdir -p /app/logs

# Expose port
EXPOSE 4000

# Run setup script then start the application
CMD ["/bin/sh", "-c", "/app/scripts/setup-walrus.sh && node dist/server.js"]
