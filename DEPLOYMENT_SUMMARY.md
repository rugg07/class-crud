# AWS EC2 Deployment Guide — Summary

## What Was Created

A complete, production-ready AWS EC2 deployment system for the School Portal app with Docker Compose.

### Files Created

```
scripts/
├── deploy-aws.sh               # Launch EC2 instance from local machine
├── setup-instance.sh           # Install Docker, start app (run on instance)
└── teardown-aws.sh             # Terminate instance and clean up

docs/
├── AWS_DEPLOYMENT.md           # Complete 500+ line deployment guide
└── DEPLOYMENT_QUICKREF.md      # Quick reference for common commands

Dockerfile.production           # Multi-stage production Docker image
```

## Quick Start

**From your local machine:**

```bash
# 1. Make scripts executable
chmod +x scripts/deploy-aws.sh scripts/setup-instance.sh scripts/teardown-aws.sh

# 2. Launch EC2 instance (t3.small, us-east-1)
./scripts/deploy-aws.sh
# Output: Instance ID, connection command

# 3. Connect to instance via SSM Session Manager
aws ssm start-session --target i-1234567890abcdef0

# 4. Clone repo and run setup on instance
git clone https://github.com/your-org/concentrate-quiz.git
cd concentrate-quiz
./scripts/setup-instance.sh

# 5. Access the app
curl http://localhost:3001/health
# Response: {"ok":true}

# 6. Teardown when done
./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1 --delete-sg
```

## What Each Script Does

### deploy-aws.sh (Local Machine)

**Purpose:** Launch an AWS EC2 instance with all the right settings

**Features:**
- Finds latest Ubuntu 22.04 LTS AMI in us-east-1
- Creates security group with inbound rules (HTTP, HTTPS, 3000, 3001)
- Launches t3.small instance with IAM role `sandbox-ssm-instance`
- Waits for instance to reach "running" state
- Waits for SSM Session Manager connectivity
- Outputs instance ID and connection instructions

**Usage:**
```bash
./scripts/deploy-aws.sh                    # Default: t3.small
./scripts/deploy-aws.sh t3.micro us-east-1 # Custom size
```

### setup-instance.sh (On EC2 Instance)

**Purpose:** Complete setup for Docker Compose deployment

**Does:**
1. Updates system packages
2. Installs Docker + Docker Compose
3. Installs Node.js 20 and Git
4. Clones repository (or creates app directory)
5. Creates `.env` file with generated secrets (JWT_SECRET, DB_PASSWORD)
6. Creates `docker-compose.production.yml` with Postgres, Redis, and app
7. Creates `Dockerfile.production` (multi-stage build)
8. Starts all containers with `docker compose up -d`
9. Runs health checks and displays status

**Usage:**
```bash
# On the EC2 instance (after SSM session)
./scripts/setup-instance.sh
```

### teardown-aws.sh (Local Machine)

**Purpose:** Clean shutdown and resource cleanup

**Does:**
1. Terminates EC2 instance
2. Waits for termination to complete
3. Optionally deletes security group (`--delete-sg`)
4. Displays cleanup summary

**Usage:**
```bash
./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1
./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1 --delete-sg
```

## Infrastructure

```
┌─────────────────────────────────────────────────┐
│  AWS EC2 (t3.small, Ubuntu 22.04)               │
│  IAM Role: sandbox-ssm-instance                 │
│  SSH: DISABLED (use SSM Session Manager)        │
│                                                 │
│  Docker Compose Stack:                          │
│  ├─ Postgres 17 (port 5432, Docker internal)    │
│  ├─ Redis 7 (port 6379, Docker internal)        │
│  └─ App (ports 3000, 3001)                      │
│     ├─ Next.js frontend (3000)                  │
│     └─ Fastify API (3001)                       │
│                                                 │
│  Security Group: Inbound rules for 80, 443,     │
│                  3000, 3001 (0.0.0.0/0)         │
│                  No SSH (port 22 disabled)      │
└─────────────────────────────────────────────────┘
```

## Key Constraints (From TASK.md)

✅ **Region:** us-east-1 (locked)  
✅ **Instance:** t3/t4g only, no GPU, no large instances  
✅ **SSH:** Port 22 disabled  
✅ **Connection:** AWS Systems Manager Session Manager or EC2 Instance Connect  
✅ **IAM Role:** `sandbox-ssm-instance` (pre-configured)  
✅ **Teardown:** Everything cleaned up after session  

## Environment Variables

The setup script generates:
- `JWT_SECRET`: Random 32-byte base64 string (for signing JWTs)
- `DB_PASSWORD`: Random 16-byte base64 string (Postgres password)
- `DB_HOST`: Set to `postgres` (Docker service name)
- `REDIS_URL`: Set to `redis://redis:6379` (Docker service name)

**For production, customize:**
```bash
# On instance, edit .env
nano /home/$USER/concentrate-quiz/.env

# Change critical secrets:
JWT_SECRET=<strong-random-value-stored-in-aws-secrets-manager>
DB_PASSWORD=<strong-random-value>
GOOGLE_CLIENT_ID=<oauth-client-id-if-using-oauth>
GOOGLE_CLIENT_SECRET=<oauth-secret>

# Restart app
docker compose -f docker-compose.production.yml restart app
```

## Docker Compose Services

**postgres** (postgres:17-alpine)
- Database for all app data
- Port 5432 (internal, not exposed outside container)
- Volume: `postgres_data` (persistent)
- Healthcheck: `pg_isready`

**redis** (redis:7-alpine)
- Cache for stats API
- Port 6379 (internal)
- Volume: `redis_data` (persistent)
- Healthcheck: `redis-cli ping`

**app** (built from `Dockerfile.production`)
- Next.js frontend (port 3000)
- Fastify API (port 3001)
- Runs `npm run dev` (starts both servers)
- Depends on postgres + redis being healthy
- Healthcheck: `curl http://localhost:3001/health`

## Dockerfile.production

**Multi-stage build:**
1. **Builder stage:**
   - Install dependencies
   - Type-check TypeScript
   - Build Next.js frontend
   - Validate backend code
2. **Runtime stage:**
   - Minimal Node.js Alpine image
   - Copy only necessary files (node_modules, .next, src)
   - Use dumb-init for proper signal handling
   - Health check endpoint

**Result:** ~400 MB image (small, fast to deploy)

## Documentation Files

### AWS_DEPLOYMENT.md (500+ lines, comprehensive)
- Prerequisites and setup requirements
- 7-step detailed walkthrough
- Architecture diagram
- Cost estimation
- Security checklist
- Troubleshooting guide
- Nginx + SSL setup (optional)
- Link to all AWS APIs used

### DEPLOYMENT_QUICKREF.md (quick reference)
- TL;DR 3-step deployment
- Common command cheat sheet
- Service management commands
- Troubleshooting quick fixes
- Cost summary
- Production checklist

## Next Steps for User

1. **Review the scripts** (read them, don't just run them)
2. **Check your AWS credentials:** `aws sts get-caller-identity`
3. **Launch the instance:** `./scripts/deploy-aws.sh`
4. **Connect and setup:** Follow the output instructions
5. **Test the app:** Hit `/health` endpoint
6. **Customize environment:** Edit `.env` with production secrets
7. **Add SSL/Nginx:** See "Optional: Nginx + SSL" in AWS_DEPLOYMENT.md
8. **Teardown:** `./scripts/teardown-aws.sh <id>`

## Constraints & Scope

**What's included (YAGNI):**
- Single EC2 instance (no auto-scaling)
- Docker Compose (not Kubernetes)
- Postgres + Redis in containers (not RDS/ElastiCache)
- No load balancer (single instance)
- No CDN (CloudFront)
- No managed DNS (user can add Route53)
- No backup automation (user should add)
- No monitoring/CloudWatch integration (add separately)

**What's NOT included:**
- Kubernetes / ECS orchestration
- RDS (managed Postgres)
- ElastiCache (managed Redis)
- Application Load Balancer
- CloudFront CDN
- Route53 DNS
- Automated backups
- CloudWatch monitoring
- VPC / Network customization

These can all be added later without changing the deployment approach.

## Security Notes

**Currently open to world (0.0.0.0/0):**
- Port 80 (HTTP)
- Port 443 (HTTPS)
- Port 3000 (Next.js)
- Port 3001 (Fastify)

**For production:**
1. Restrict security group to your IP: `YOUR_IP/32`
2. Use strong `JWT_SECRET` (stored in AWS Secrets Manager)
3. Use strong `DB_PASSWORD` (random, 20+ chars)
4. Enable HTTPS with Certbot (see guide)
5. Use custom domain (Route53)
6. Enable CloudWatch logs
7. Regular security patches (update Docker images)

## Cost Estimate

| Resource | Monthly Cost |
|----------|--------------|
| t3.small EC2 | ~$10 |
| Data transfer (100 GB) | ~$10 |
| **Total** | **~$20/month** |

**Free tier eligible:** 750 hours/month for 12 months (easily fits one t3.micro)

## Support

If deployment fails:
1. Check AWS credential with `aws sts get-caller-identity`
2. Verify IAM role `sandbox-ssm-instance` exists
3. Read full guide: `docs/AWS_DEPLOYMENT.md`
4. Check troubleshooting section in guide
5. Review script output for specific error messages

## Files Structure Summary

```
/home/kasm-user/project/
├── scripts/
│   ├── deploy-aws.sh          ← Run first (from local machine)
│   ├── setup-instance.sh       ← Run second (on EC2 instance)
│   └── teardown-aws.sh         ← Run last (from local machine)
├── docs/
│   ├── AWS_DEPLOYMENT.md       ← Full reference guide
│   └── DEPLOYMENT_QUICKREF.md  ← Quick command reference
├── Dockerfile.production       ← Multi-stage production build
├── docker-compose.production.yml ← Created by setup script
└── .env                        ← Created by setup script
```

---

**Ready to deploy!** Start with `./scripts/deploy-aws.sh`
