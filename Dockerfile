# OpenClaw Monitor Dashboard - Docker Image
# ==========================================
# This Dockerfile creates a containerized version of the OpenClaw Agent Monitor
# that can run on any Linux or Mac system with Docker installed.

# Use Node.js LTS as base image
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache curl wget

# Create non-root user for security
RUN addgroup -g 1001 -S openclaw && \
    adduser -u 1001 -S openclaw -G openclaw

# Set working directory
WORKDIR /home/openclaw

# Copy installed node_modules from builder
COPY --from=builder --chown=openclaw:openclaw /app/node_modules ./node_modules

# Copy application files
COPY --chown=openclaw:openclaw package*.json ./
COPY --chown=openclaw:openclaw src/ ./src/
COPY --chown=openclaw:openclaw web/ ./web/

# Create data directory
RUN mkdir -p /home/openclaw/data && chown -R openclaw:openclaw /home/openclaw

# Expose the monitoring port
EXPOSE 3847

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3847
ENV OPENCLAW_PATH=/home/openclaw/.openclaw

# Change to non-root user
USER openclaw

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3847/api/health || exit 1

# Start the monitor
CMD ["node", "src/server.js"]
