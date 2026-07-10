# Hiring Quiz

Welcome! This is a hiring assessment for full-stack engineering positions at Concentrate.

## Overview

**Read the full specifications in [SPECS.md](./SPECS.md)**

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose

### Installation

1. Use this template to create your own repository
2. Clone your repository locally
3. Install dependencies:

```bash
npm install
```

4. Start the database and Redis:

```bash
docker-compose up -d
```

5. Set up your project structure and begin implementation

## Development Scripts

```bash
npm run dev          # Start Next.js dev server
npm run server:dev   # Start Fastify server (development mode)
npm run build        # Build Next.js for production
npm run type-check   # Type-check all TypeScript files
npm run lint         # Run ESLint
npm run test         # Run tests with Vitest
npm run migrate      # Run pending database migrations
npm run seed         # Seed the database with sample data
```

## Docker Deployment

### Build the Docker Image

```bash
docker build -t school-portal .
```

### Run the Container Locally

```bash
docker run -p 3000:3000 -p 3001:3001 \
  -e NODE_ENV=production \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=concentrate-quiz \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=your-secret-key-at-least-32-characters-long-for-production \
  school-portal
```

### Run with Docker Compose (Full Stack)

To run the app with PostgreSQL and Redis in Docker:

```bash
# Build the app image
docker build -t school-portal .

# Create a docker-compose override for production-like setup
# docker-compose.prod.yml (add app service alongside db/redis)
```

### Production Environment Variables

Required at runtime (do NOT bake into image):

```
NODE_ENV=production
JWT_SECRET=<your-secret-key-at-least-32-characters>
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<secure-password>
DB_NAME=concentrate-quiz
REDIS_URL=redis://redis:6379
GOOGLE_CLIENT_ID=<optional-oauth-client-id>
GOOGLE_CLIENT_SECRET=<optional-oauth-client-secret>
GOOGLE_REDIRECT_URI=https://<production-domain>/auth/google/callback
```

## Continuous Integration

GitHub Actions runs on every push to `main` and pull request:

- **Lint**: ESLint validation
- **Type Check**: TypeScript compilation check
- **Test**: Backend tests (`src/server/__tests__/`)
- **Build**: Next.js production build verification
- **Docker Build**: Multi-stage Docker image build (cached)

See [.github/workflows/ci.yml](./.github/workflows/ci.yml) for details.

## What's Provided

This starter includes:

- **package.json** - All required dependencies from the tech stack
- **.prettierrc** - Code formatting configuration
- **.eslintrc.json** - Linting rules (enforces no `any` types)
- **docker-compose.yml** - PostgreSQL and Redis services
- **SPECS.md** - Complete project requirements

## Submission

Submit a **5-10 minute video** walking through your application and highlighting key features. Upload to Google Drive and share with **jobs@concentrate.ai**.

Your video should cover:
- Application walkthrough (UI and features)
- Architecture decisions
- Testing approach
- Deployment setup

## Questions?

If you have any questions about the requirements, please reach out to jobs@concentrate.ai.
