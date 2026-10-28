# Multi-stage Dockerfile for Campus Auction (Next.js 15 Standalone)
# Optimized for Render deployment and containerized production

# Stage 1: Install production and build dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the Next.js application
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment arguments (with defaults for static analysis / container builds)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL=https://thecloudcompany.onrender.com
ARG DEMO_MODE=false
ARG SELLER_RESPONSE_HOURS=24
ARG PICKUP_HOURS=48

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder.supabase.co}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-placeholder-anon-key}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-https://thecloudcompany.onrender.com}
ENV DEMO_MODE=${DEMO_MODE}
ENV SELLER_RESPONSE_HOURS=${SELLER_RESPONSE_HOURS}
ENV PICKUP_HOURS=${PICKUP_HOURS}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Stage 3: Production runner (minimal footprint)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Render binds to port 10000 by default or reads the PORT env var
ENV PORT=10000
ENV HOSTNAME="0.0.0.0"

# Non-root security user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Create cache directory with correct permissions
RUN mkdir -p .next && chown nextjs:nodejs .next

# Copy assets and standalone server output from builder
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 10000

CMD ["node", "server.js"]

