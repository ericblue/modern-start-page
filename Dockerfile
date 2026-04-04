# Build stage
FROM node:22-alpine AS builder

LABEL org.opencontainers.image.source="https://github.com/ericblue/modern-start-page"
LABEL org.opencontainers.image.description="A modern, customizable browser start page"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="Modern Start Page"
LABEL org.opencontainers.image.vendor="Eric Blue"
LABEL org.opencontainers.image.authors="Eric Blue <ericblue76@gmail.com>"

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source files and build the app
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:22-alpine

# Create non-root user
RUN addgroup -S appuser && adduser -S appuser -G appuser

# Set working directory
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4000

# Copy package files and install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    rm -f package-lock.json && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Copy built output from builder
COPY --from=builder /app/dist ./dist

# The standalone adapter resolves client assets relative to the SSR chunk
# in dist/server/chunks/, so it looks for ../client from there = dist/server/client/
RUN ln -s /app/dist/client /app/dist/server/client

# Set file ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 4000

# Run the standalone Astro server directly (no need for astro CLI)
CMD ["node", "dist/server/entry.mjs"]
