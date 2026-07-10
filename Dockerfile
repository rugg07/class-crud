# Multi-stage build for Next.js + Fastify monorepo
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY package*.json ./
COPY tsconfig.json ./
COPY src ./src
COPY public ./public 2>/dev/null || true
COPY .eslintrc.json ./

# Build Next.js frontend
RUN npm run build

# Type-check the entire project
RUN npm run type-check

# Stage 3: Runtime
FROM node:20-alpine
WORKDIR /app

# Install curl for health checks and dumb-init for proper signal handling
RUN apk add --no-cache curl dumb-init

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built Next.js app from build stage
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public 2>/dev/null || true

# Copy necessary files
COPY package*.json ./
COPY src ./src
COPY tsconfig.json ./

# Set environment variables (can be overridden at runtime)
ENV NODE_ENV=production

# Expose both frontend (3000) and backend (3001) ports
EXPOSE 3000 3001

# Health check: verify Fastify backend is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start both Next.js (port 3000) and Fastify (port 3001) servers
CMD ["sh", "-c", "npm run server:dev & next start"]
