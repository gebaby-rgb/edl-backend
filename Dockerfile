# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — Builder
#   Install all dependencies, generate Prisma client, compile TypeScript
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first to leverage Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Generate Prisma client for the target platform
RUN npx prisma generate

# Copy source and compile
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# Prune to production-only dependencies for the final image
RUN npm ci --omit=dev


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — Production Image
#   Minimal runtime image — no TypeScript toolchain, no devDependencies
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Security: run as non-root user
RUN addgroup -S edl && adduser -S edl -G edl
WORKDIR /app

# Copy compiled output + production node_modules + Prisma schema
COPY --from=builder /app/dist        ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma      ./prisma

# Set non-root ownership
RUN chown -R edl:edl /app
USER edl

# Application listens on this port (matches PORT env var default)
EXPOSE 4000

# Health check so Docker Compose knows when the API is ready
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/v1/health || exit 1

# On start: run migrations first, then launch the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
