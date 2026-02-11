# ──────────────────────────────────────────────────────
# LogExplain API — Multi-stage Docker Build
# ──────────────────────────────────────────────────────

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production=false

COPY tsconfig*.json nest-cli.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Security: run as non-root
RUN addgroup -g 1001 -S logexplain && \
    adduser -S logexplain -u 1001

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R logexplain:logexplain /app

USER logexplain

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/v1/health || exit 1

CMD ["node", "dist/main"]
