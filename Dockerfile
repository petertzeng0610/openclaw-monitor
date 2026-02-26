# OpenClaw Monitor Dashboard - Docker Image (Nova AI Platform)
# ==========================================

# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Copy all web files needed for build
COPY web/package*.json ./web/
COPY web/vite.config.js ./
COPY web/index.html ./web/
COPY web/src ./web/src

# Install frontend dependencies
RUN cd web && npm install

# Build React app
RUN cd web && npm run build

# Stage 2: Build backend
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Production stage
FROM node:20-alpine

# Install runtime dependencies
RUN apk add --no-cache curl wget

# Create non-root user
RUN addgroup -g 1001 -S openclaw && \
    adduser -u 1001 -S openclaw -G openclaw

WORKDIR /home/openclaw

# Copy node_modules
COPY --from=builder --chown=openclaw:openclaw /app/node_modules ./node_modules

# Copy application files
COPY --chown=openclaw:openclaw package*.json ./
COPY --chown=openclaw:openclaw src/ ./src/

# Copy React build (from frontend-builder)
COPY --from=frontend-builder --chown=openclaw:openclaw /frontend/web/dist ./web/dist

# Create data directory
RUN mkdir -p /home/openclaw/data && chown -R openclaw:openclaw /home/openclaw

EXPOSE 3847

ENV NODE_ENV=production
ENV PORT=3847
ENV OPENCLAW_PATH=/home/openclaw/.openclaw

USER openclaw

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3847/api/health || exit 1

CMD ["node", "src/server.js"]
