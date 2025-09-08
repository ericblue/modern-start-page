# Build stage
FROM node:23.11.0-slim as builder

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
RUN npm install

# Copy source files and build the app
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Production stage
FROM node:lts-slim

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Environment variables
ENV NODE_ENV=production
ENV ASTRO_TELEMETRY_DISABLED=1
ENV HOST=0.0.0.0
ENV PORT=4000

# Install minimal debugging tools
RUN apt-get update && \
    apt-get install -y net-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy built app and dependencies from builder
COPY --from=builder /app /app

# Clean up node_modules bloat (safe version)
RUN find /app/node_modules -type d \( \
    -name "test" -o -name "tests" -o \
    -name "example" -o -name "examples" -o \
\) -exec rm -rf {} + 2>/dev/null || true && \
    find /app/node_modules -type f -name "*.md" -delete && \
    find /app/node_modules -type f -name "*.map" -delete

# Set file ownership
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose application port
EXPOSE 4000

# Temporarily workaround for Astro preview server; issues with static assets serving from entry.mjs or custom express servers

# Start Astro preview server
CMD ["sh", "-c", "npm run preview"]
