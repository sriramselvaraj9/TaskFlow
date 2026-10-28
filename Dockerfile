# ==========================================
# TaskFlow Frontend Production Dockerfile
# Multi-stage optimized build for Next.js
# ==========================================

# Stage 1: Dependencies cache
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./ 
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder 
WORKDIR /app 
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment for Next.js build
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Build-time argument for server-side Next.js rewrites and SSR proxying
ARG BACKEND_URL=http://backend:8000
ENV BACKEND_URL=$BACKEND_URL

# Build-time argument for browser-accessible API endpoint
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Create a non-root system user and group for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy build artifacts and dependencies
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.js ./next.config.js

USER nextjs

EXPOSE 3000

# Start Next.js production server
CMD ["npm", "run", "start"]
