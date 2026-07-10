#!/bin/bash

################################################################################
# AWS EC2 Instance Setup Script
#
# Runs on the EC2 instance (via SSM Session Manager or Instance Connect)
# Installs Docker, clones the repo, sets up environment, and starts the app
#
# Usage:
#   On your local machine:
#     1. Deploy instance: ./scripts/deploy-aws.sh
#     2. Connect: aws ssm start-session --target <instance-id>
#     3. Run this script: ./setup-instance.sh
#
################################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== School Portal Deployment Setup ===${NC}"
echo ""

# Detect if running on EC2 / Ubuntu
if ! command -v lsb_release &> /dev/null; then
  echo -e "${RED}ERROR: This script requires Ubuntu/Debian${NC}"
  exit 1
fi

UBUNTU_VERSION=$(lsb_release -rs)
echo "Ubuntu version: $UBUNTU_VERSION"

# Update system packages
echo -e "${YELLOW}[1/7] Updating system packages...${NC}"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# Install Docker
echo -e "${YELLOW}[2/7] Installing Docker...${NC}"
if command -v docker &> /dev/null; then
  echo "Docker already installed: $(docker --version)"
else
  # Install Docker from official repository
  sudo apt-get install -y -qq \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

  # Add Docker GPG key
  sudo mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

  # Add Docker repository
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

  # Install Docker and Docker Compose
  sudo apt-get update -qq
  sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin

  # Start Docker service
  sudo systemctl start docker
  sudo systemctl enable docker

  # Add current user to docker group (avoid sudo for docker commands)
  sudo usermod -aG docker $USER
  newgrp docker <<EOF
  echo "Docker user added: $(docker ps -q 2>/dev/null || echo 'Restart shell to use docker without sudo')"
EOF
fi

# Install Docker Compose (standalone if not already installed)
echo -e "${YELLOW}[3/7] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE_VERSION="v2.24.0"
  sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
    -o /usr/local/bin/docker-compose
  sudo chmod +x /usr/local/bin/docker-compose
fi
echo "Docker Compose: $(docker-compose --version)"

# Install Node.js (optional, only if app needs to be built on instance)
echo -e "${YELLOW}[4/7] Installing Node.js and Git...${NC}"
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
echo "Node.js: $(node --version)"

sudo apt-get install -y -qq git

# Create app directory
echo -e "${YELLOW}[5/7] Cloning repository...${NC}"
APP_DIR="/home/$USER/concentrate-quiz"

if [ -d "$APP_DIR" ]; then
  echo "App directory already exists: $APP_DIR"
else
  # Option 1: Clone from GitHub (update the URL if needed)
  # git clone https://github.com/your-org/concentrate-quiz.git $APP_DIR

  # Option 2: Get code from local machine via SSM (for now, manual clone/git init expected)
  mkdir -p "$APP_DIR"
  echo "Created app directory: $APP_DIR"
  echo "TODO: Clone/push code to this directory, or use:"
  echo "  git clone <repo-url> $APP_DIR"
fi

cd "$APP_DIR"

# Create .env file with production defaults
echo -e "${YELLOW}[6/7] Setting up environment...${NC}"
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<'ENVFILE'
# Production Environment
NODE_ENV=production

# JWT Configuration - CHANGE THIS IN PRODUCTION
JWT_SECRET=$(head -c 32 /dev/urandom | base64)

# PostgreSQL Database
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=$(head -c 16 /dev/urandom | base64)
DB_NAME=concentrate-quiz

# Redis Cache
REDIS_URL=redis://redis:6379

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
ENVFILE

  echo "Created .env file: $ENV_FILE"
  echo "IMPORTANT: Review and customize .env with actual secrets"
else
  echo ".env already exists, skipping creation"
fi

# Create docker-compose.yml (if not already present)
echo -e "${YELLOW}[6/7] Setting up Docker Compose configuration...${NC}"
DOCKER_COMPOSE_FILE="$APP_DIR/docker-compose.production.yml"

if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
  cat > "$DOCKER_COMPOSE_FILE" <<'DOCKERCOMPOSE'
version: '3.8'

services:
  postgres:
    image: postgres:17-alpine
    container_name: concentrate-quiz-db
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-concentrate-quiz}
    ports:
      - '127.0.0.1:5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-postgres}']
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: concentrate-quiz-redis
    restart: unless-stopped
    ports:
      - '127.0.0.1:6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile.production
    container_name: concentrate-quiz-app
    restart: unless-stopped
    ports:
      - '127.0.0.1:3000:3000'
      - '127.0.0.1:3001:3001'
    environment:
      NODE_ENV: ${NODE_ENV:-production}
      JWT_SECRET: ${JWT_SECRET}
      DB_HOST: ${DB_HOST:-postgres}
      DB_PORT: ${DB_PORT:-5432}
      DB_USER: ${DB_USER:-postgres}
      DB_PASSWORD: ${DB_PASSWORD:-postgres}
      DB_NAME: ${DB_NAME:-concentrate-quiz}
      REDIS_URL: ${REDIS_URL:-redis://redis:6379}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}
      GOOGLE_CLIENT_SECRET: ${GOOGLE_CLIENT_SECRET}
      GOOGLE_REDIRECT_URI: ${GOOGLE_REDIRECT_URI}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
DOCKERCOMPOSE

  echo "Created docker-compose file: $DOCKER_COMPOSE_FILE"
else
  echo "docker-compose.production.yml already exists"
fi

# Build and start containers
echo -e "${YELLOW}[7/7] Starting Docker containers...${NC}"
cd "$APP_DIR"

# Check if Dockerfile exists
if [ ! -f "Dockerfile" ] && [ ! -f "Dockerfile.production" ]; then
  echo -e "${YELLOW}Creating Dockerfile...${NC}"
  cat > Dockerfile.production <<'DOCKERFILE'
# Production Dockerfile
# Multi-stage: build → runtime
FROM node:20-alpine AS builder

WORKDIR /build

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Build Next.js + backend
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init curl

# Copy from builder
COPY --from=builder /build/node_modules ./node_modules
COPY --from=builder /build/.next ./.next
COPY --from=builder /build/package*.json ./
COPY --from=builder /build/src ./src
COPY --from=builder /build/public ./public

# Expose ports
EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=10s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

# Use dumb-init to handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start app: Next.js + Fastify backend
CMD ["npm", "run", "dev"]
DOCKERFILE
fi

echo "Starting Docker Compose..."
# Use docker compose (V2) or docker-compose (V1)
if command -v docker &> /dev/null && docker compose version &>/dev/null; then
  docker compose -f docker-compose.production.yml up -d
else
  docker-compose -f docker-compose.production.yml up -d
fi

# Wait for services to be healthy
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 10

# Check status
echo ""
echo -e "${GREEN}=== Service Status ===${NC}"
docker ps --filter "label=com.docker.compose.project" --format "table {{.Names}}\t{{.Status}}"

# Get container IDs for health checks
echo ""
echo -e "${GREEN}=== Health Checks ===${NC}"

# Check database
if docker exec concentrate-quiz-db pg_isready -U postgres &>/dev/null; then
  echo "✅ PostgreSQL: OK"
else
  echo "⏳ PostgreSQL: Starting..."
fi

# Check Redis
if docker exec concentrate-quiz-redis redis-cli ping &>/dev/null; then
  echo "✅ Redis: OK"
else
  echo "⏳ Redis: Starting..."
fi

# Check app
sleep 5
if curl -s http://localhost:3001/health &>/dev/null; then
  echo "✅ App (Fastify): OK"
else
  echo "⏳ App: Starting..."
fi

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo "App directory:      $APP_DIR"
echo "Environment file:   $ENV_FILE"
echo ""
echo "Next steps:"
echo ""
echo "1. View logs:"
echo "   docker compose -f docker-compose.production.yml logs -f"
echo ""
echo "2. Run database migrations:"
echo "   docker exec concentrate-quiz-app npm run migrate"
echo ""
echo "3. Access the app:"
echo "   Frontend (Next.js):  http://localhost:3000"
echo "   API (Fastify):       http://localhost:3001"
echo "   Health check:        curl http://localhost:3001/health"
echo ""
echo "4. Stop services:"
echo "   docker compose -f docker-compose.production.yml down"
echo ""
