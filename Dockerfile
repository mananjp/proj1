# ── Multi-stage Dockerfile: Frontend (Vite) + Backend (Node.js) + Embedded Local MongoDB ──
# Produces a 100% self-contained container that stores data locally without MongoDB Atlas.

# ── Stage 1: Build Frontend ───────────────────────────────────────────────────
FROM node:20-bookworm-slim AS frontend-builder

WORKDIR /app

# Install all dependencies (needed for Vite build tooling)
COPY package*.json ./
RUN npm ci

# Copy frontend source files
COPY index.html vite.config.js ./
COPY public ./public
COPY src ./src

# Same-origin relative URLs (/api/...) for unified deployment
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

# Build static assets into /app/dist
RUN npm run build

# ── Stage 2: Production Runtime with Local MongoDB ────────────────────────────
FROM node:20-bookworm-slim

WORKDIR /app

# Install MongoDB 7.0 Community Server & dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    ca-certificates \
    procps \
  && curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg \
  && echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/debian bookworm/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    mongodb-org-server \
    mongodb-mongosh \
  && rm -rf /var/lib/apt/lists/*

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY server ./server

# Copy compiled frontend from builder stage
COPY --from=frontend-builder /app/dist ./dist

# Create directories for local database storage, CSV exports, and logs
RUN mkdir -p /data/db /app/server/exports /var/log/mongodb

# Copy entrypoint startup script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Default environment configuration
ENV NODE_ENV=production
ENV PORT=5000
ENV MONGODB_URI=mongodb://127.0.0.1:27017/taskdb

# Expose app port
EXPOSE 5000

# Healthcheck against backend health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://127.0.0.1:${PORT:-5000}/api/health || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "server/index.js"]
