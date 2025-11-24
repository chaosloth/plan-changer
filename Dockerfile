# syntax=docker/dockerfile:1

# Multi-stage build for Next.js application
FROM node:lts-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create data directory for SQLite database (needed during build for page data collection)
RUN mkdir -p /app/data

# Build Next.js application
# This will create .next directory and compile the app
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/package*.json ./

# Create data directory for SQLite database with proper permissions
# The existing 'node' user (UID 1000) matches the host user for volume permissions
RUN mkdir -p /app/data && chown -R 1000:1000 /app/data

# Switch to UID 1000 (node user) which matches host user
USER 1000:1000

# Expose port 3000
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the Next.js application
CMD ["node", "server.js"]
