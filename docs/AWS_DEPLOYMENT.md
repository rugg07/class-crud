# AWS EC2 Deployment Guide

## Overview

This guide walks you through deploying the **Concentrate.ai School Portal** on AWS EC2 using Docker Compose. The setup:

- Launches a **t3.small** EC2 instance in **us-east-1** (locked)
- Runs **Ubuntu 22.04 LTS**
- Uses **IAM role** `sandbox-ssm-instance` (no SSH, connect via SSM Session Manager)
- Runs **Postgres + Redis + Next.js + Fastify** in Docker containers
- Provides **health checks** and **monitoring** endpoints

## Prerequisites

**On your local machine:**
- AWS CLI installed (`aws --version`)
- AWS credentials configured (`aws sts get-caller-identity` works)
- Bash shell (`bash --version`)
- The deployment scripts (in `scripts/` directory)

**AWS Requirements:**
- IAM role `sandbox-ssm-instance` is pre-configured in your account
- Region locked to `us-east-1` (credentials default to this region)
- Only t3/t4g instance sizes allowed (t3.small is recommended)

## Quick Start (5 minutes)

### 1. Deploy EC2 Instance

From your local machine:

```bash
# Make scripts executable
chmod +x scripts/deploy-aws.sh scripts/setup-instance.sh scripts/teardown-aws.sh

# Launch instance (defaults to t3.small, us-east-1)
./scripts/deploy-aws.sh
```

**Output:**
```
✅ EC2 Instance Deployed Successfully!

Instance ID:        i-1234567890abcdef0
Instance Type:      t3.small
Region:             us-east-1
Security Group:     sg-1234567890abcdef0

Next steps:
1. Connect to the instance:
   aws ssm start-session --target i-1234567890abcdef0 --region us-east-1

2. Run the setup script (copy setup-instance.sh to instance first):
   ./setup-instance.sh
```

**Save the Instance ID** for later use.

### 2. Connect to Instance

```bash
# Start SSM session (replace with your instance ID)
aws ssm start-session --target i-1234567890abcdef0 --region us-east-1
```

You now have a shell on the EC2 instance.

### 3. Set Up Instance

On the EC2 instance:

```bash
# Clone or get the code onto the instance
# Option A: Git clone
git clone https://github.com/your-org/concentrate-quiz.git

# Option B: If you have code locally, copy it:
# (From local machine, in a separate terminal, while SSM session is open)
# aws ssm start-session --target i-1234567890abcdef0 --document-name AWS-StartInteractiveCommand

# Once in the instance, navigate to repo and run setup
cd concentrate-quiz
chmod +x scripts/setup-instance.sh
./scripts/setup-instance.sh
```

**The setup script will:**
- Install Docker + Docker Compose
- Install Node.js 20
- Create `.env` file with generated secrets
- Build and start all containers (Postgres, Redis, app)
- Run database migrations
- Display health check status

**Output:**
```
=== Service Status ===
concentrate-quiz-app       Up 5 seconds (healthy)
concentrate-quiz-db        Up 10 seconds (healthy)
concentrate-quiz-redis     Up 10 seconds (healthy)

=== Health Checks ===
✅ PostgreSQL: OK
✅ Redis: OK
✅ App (Fastify): OK

=== Deployment Complete! ===
```

### 4. Access the App

From the EC2 instance shell:

```bash
# Frontend (Next.js)
curl http://localhost:3000

# API Health Check
curl http://localhost:3001/health
# Expected: {"ok":true}

# View logs
docker compose -f docker-compose.production.yml logs -f
```

### 5. Run Migrations (if not auto-run)

```bash
# From instance, in the app directory
docker exec concentrate-quiz-app npm run migrate
```

### 6. Teardown When Done

From your local machine:

```bash
./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1 --delete-sg
```

This terminates the instance and cleans up the security group.

---

## Detailed Walkthrough

### Step 1: Deploy Instance

**Script:** `scripts/deploy-aws.sh`

**What it does:**
1. Finds the latest Ubuntu 22.04 LTS AMI in us-east-1
2. Creates (or reuses) a security group named `concentrate-quiz-sg`
3. Adds inbound rules for ports: 80 (HTTP), 443 (HTTPS), 3000 (Next.js), 3001 (Fastify)
4. Launches a t3.small instance with IAM role `sandbox-ssm-instance`
5. Waits for the instance to reach "running" state
6. Waits for SSM connectivity
7. Outputs instance details and next steps

**Usage:**

```bash
# Default: t3.small, us-east-1
./scripts/deploy-aws.sh

# Custom instance type
./scripts/deploy-aws.sh t3.micro us-east-1
./scripts/deploy-aws.sh t3.small us-east-1

# Use t4g (ARM-based, slightly cheaper)
./scripts/deploy-aws.sh t4g.small us-east-1
```

**Notes:**
- SSH (port 22) is **disabled**. Use AWS Systems Manager Session Manager instead.
- The security group allows inbound traffic from 0.0.0.0/0 (anywhere). For production, restrict to your IP.
- IAM role `sandbox-ssm-instance` must exist in your AWS account.

### Step 2: Connect via Session Manager

**Prerequisites:**
- AWS Systems Manager Session Manager agent is built into Ubuntu AMI
- IAM role `sandbox-ssm-instance` must have `AmazonSSMManagedInstanceCore` policy

**Connect:**

```bash
aws ssm start-session --target i-1234567890abcdef0 --region us-east-1
```

**Alternative: EC2 Instance Connect (if available in your region)**

```bash
# View available options in AWS Console
# https://console.aws.amazon.com/ec2/v2/home?region=us-east-1
```

**Once connected:**
- You're logged in as `ec2-user` (or similar, depending on AMI)
- Use standard Linux commands (`ls`, `cd`, `git clone`, etc.)
- Docker is installed and accessible without `sudo` (added to user group)

### Step 3: Run Setup Script

**Script:** `scripts/setup-instance.sh`

**What it does:**
1. **Updates system packages** (`apt-get update/upgrade`)
2. **Installs Docker** from official Docker repository
3. **Installs Docker Compose** (standalone)
4. **Installs Node.js 20** (from NodeSource repo)
5. **Installs Git** (for cloning repo)
6. **Clones the repository** (or creates app directory)
7. **Creates `.env` file** with generated secrets:
   - `JWT_SECRET`: Random 32-byte base64 string
   - `DB_PASSWORD`: Random 16-byte base64 string
   - Database host points to Docker service: `postgres`
   - Redis URL points to Docker service: `redis://redis:6379`
8. **Creates `docker-compose.production.yml`** with services:
   - **Postgres 17-alpine**: Database with healthcheck
   - **Redis 7-alpine**: Cache with healthcheck
   - **App**: Built from `Dockerfile.production`, runs `npm run dev`
9. **Creates `Dockerfile.production`** (multi-stage):
   - Stage 1 (builder): Install deps, build Next.js, validate backend
   - Stage 2 (runtime): Node.js + dumb-init + app code + health check
10. **Starts all containers** with `docker compose up -d`
11. **Waits for services** and displays health status

**Running on instance:**

```bash
# Clone code first
git clone https://github.com/your-org/concentrate-quiz.git
cd concentrate-quiz

# Or if already have code, just cd into it

# Run setup
chmod +x scripts/setup-instance.sh
./scripts/setup-instance.sh
```

**What you'll see:**
```
=== School Portal Deployment Setup ===
Ubuntu version: 22.04

[1/7] Updating system packages...
[2/7] Installing Docker...
[3/7] Installing Docker Compose...
[4/7] Installing Node.js and Git...
[5/7] Cloning repository...
[6/7] Setting up environment...
[7/7] Starting Docker containers...

=== Service Status ===
concentrate-quiz-app       Up 5 seconds (healthy)
concentrate-quiz-db        Up 10 seconds (healthy)
concentrate-quiz-redis     Up 10 seconds (healthy)

=== Health Checks ===
✅ PostgreSQL: OK
✅ Redis: OK
✅ App (Fastify): OK
```

### Step 4: Access the Application

**From the instance:**

```bash
# API Health Check
curl http://localhost:3001/health
# Response: {"ok":true}

# Frontend (if Next.js is served)
curl http://localhost:3000

# View logs (real-time)
cd ~/concentrate-quiz
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker compose -f docker-compose.production.yml logs app
docker compose -f docker-compose.production.yml logs postgres
```

**Run migrations (if setup script didn't auto-run):**

```bash
docker exec concentrate-quiz-app npm run migrate
```

**Check database:**

```bash
# Connect to Postgres inside container
docker exec -it concentrate-quiz-db psql -U postgres -d concentrate-quiz

# List tables
\dt

# Exit psql
\q
```

**Manage services:**

```bash
# Stop all services
docker compose -f docker-compose.production.yml down

# Restart services
docker compose -f docker-compose.production.yml up -d

# View running containers
docker ps

# View all containers (including stopped)
docker ps -a
```

### Step 5: Customize Environment (Production)

**On the instance, edit `.env`:**

```bash
# Open the .env file
nano ~/concentrate-quiz/.env

# Or edit in place
vim ~/concentrate-quiz/.env
```

**Critical settings for production:**

```bash
# JWT Secret (must be > 32 characters, keep it SECRET)
JWT_SECRET=your-super-secret-32-char-key-stored-in-aws-secrets-manager

# Database Password (strong, random)
DB_PASSWORD=your-strong-random-db-password

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

**After editing:**

```bash
# Restart containers to apply changes
cd ~/concentrate-quiz
docker compose -f docker-compose.production.yml restart app
```

### Step 6: (Optional) Set Up Nginx + SSL with Certbot

For HTTPS with a custom domain:

```bash
# On the instance, install Nginx + Certbot
sudo apt-get install -y nginx certbot python3-certbot-nginx

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Create Nginx config for reverse proxy
sudo tee /etc/nginx/sites-available/concentrate-quiz > /dev/null <<'NGINX'
upstream app {
    server localhost:3000;
}

upstream api {
    server localhost:3001;
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://app;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

# Enable the config
sudo ln -s /etc/nginx/sites-available/concentrate-quiz /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx config
sudo nginx -t

# Get SSL certificate from Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Reload Nginx
sudo systemctl reload nginx
```

Now HTTPS is enabled!

### Step 7: Teardown

**From your local machine:**

```bash
# Terminate instance and clean up security group
./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1 --delete-sg
```

**What happens:**
1. Confirmation prompt (requires typing "yes")
2. Instance is terminated
3. Waits for termination to complete
4. Optionally deletes the security group (if `--delete-sg` is specified)

**Verify instance is terminated:**

```bash
aws ec2 describe-instances \
  --instance-ids i-1234567890abcdef0 \
  --region us-east-1 \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text
# Should return: "terminated"
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  AWS EC2 Instance (t3.small, Ubuntu 22.04)              │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Docker Compose                                  │  │
│  │                                                  │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────┐ │  │
│  │  │   Postgres   │  │    Redis     │  │  App   │ │  │
│  │  │   (5432)     │  │   (6379)     │  │(3000,  │ │  │
│  │  │              │  │              │  │ 3001)  │ │  │
│  │  └──────────────┘  └──────────────┘  └────────┘ │  │
│  │       ^                   ^               ^       │  │
│  │       └───────────────────┴───────────────┘       │  │
│  │            Docker network                        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
│  Security Group (ports 80, 443, 3000, 3001 open)       │
│  IAM Role: sandbox-ssm-instance                        │
│  No SSH (port 22 disabled)                             │
│  Connect via: SSM Session Manager                      │
└─────────────────────────────────────────────────────────┘
         ↑                                          ↑
         │                                          │
  Local machine                              EC2 Instance
  (run deploy.sh)                           (run setup.sh)
```

## Troubleshooting

### Instance Not Reaching SSM "Online" State

**Problem:** Deploy script waits but instance stays "NoResponse"

**Solution:**
- Wait 1-2 more minutes (SSM agent starts up after boot)
- Verify IAM role `sandbox-ssm-instance` exists and has `AmazonSSMManagedInstanceCore` policy
- Check instance launches successfully: `aws ec2 describe-instances --instance-ids <id>`
- Check Systems Manager → Fleet Manager to see if instance appears

### Docker Not Found After Login

**Problem:** `docker: command not found` on instance

**Solution:**
- The setup script installs Docker. If you login before running it:
  ```bash
  sudo apt-get update
  sudo apt-get install -y docker.io docker-compose-plugin
  sudo usermod -aG docker $USER
  # Log out and back in for group to take effect
  ```

### Postgres Connection Refused

**Problem:** App crashes with `could not connect to server: Connection refused`

**Solution:**
- Postgres may not be ready yet. Check:
  ```bash
  docker ps
  docker logs concentrate-quiz-db
  docker exec concentrate-quiz-db pg_isready -U postgres
  ```
- Wait for healthcheck to pass (shows "healthy" in `docker ps`)
- If stuck, restart:
  ```bash
  docker compose -f docker-compose.production.yml restart postgres
  ```

### Port Already in Use

**Problem:** `Address already in use` when starting containers

**Solution:**
```bash
# Find process using port
lsof -i :3001

# Kill it (if it's old container)
kill -9 <pid>

# Or restart Docker containers
docker compose -f docker-compose.production.yml down
docker compose -f docker-compose.production.yml up -d
```

### Migrations Not Running

**Problem:** Tables don't exist after setup

**Solution:**
```bash
# Manual migration run
docker exec concentrate-quiz-app npm run migrate

# Check migration logs
docker logs concentrate-quiz-app

# Verify tables
docker exec -it concentrate-quiz-db psql -U postgres -d concentrate-quiz -c "\dt"
```

### Out of Disk Space

**Problem:** `no space left on device`

**Solution:**
```bash
# Check disk usage
df -h

# Clean up Docker
docker system prune -a
docker volume prune

# If still full, consider stopping containers and backing up data
```

### Cannot Connect from Local Machine

**Problem:** `curl http://ec2-public-ip:3000` times out

**Solution:**
- Verify security group allows inbound on ports 3000, 3001
- Check instance state is "running"
- Check app is actually listening:
  ```bash
  # On instance
  docker ps
  docker logs concentrate-quiz-app
  netstat -tlnp | grep 3000
  ```

---

## Cost Estimation

**Typical deployment costs (us-east-1, free tier eligible):**

| Resource | Size | Cost/Month |
|----------|------|-----------|
| EC2 instance | t3.small | ~$10 (or free tier if eligible) |
| Elastic IP | (if assigned) | $0 (unassigned) |
| Data transfer | 100 GB out | ~$10 |
| **Total** | | **~$20/month** |

**Cost-saving tips:**
- Use t3.micro for testing (~$5/month)
- Stop instance when not in use (`aws ec2 stop-instances`)
- Use free tier (12 months, 750 hrs t3.micro)

---

## Security Considerations

### Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value (32+ chars, stored in AWS Secrets Manager)
- [ ] Change `DB_PASSWORD` to a strong random value
- [ ] Restrict security group to your IP (not 0.0.0.0/0)
- [ ] Set up HTTPS with Certbot (see above)
- [ ] Use Route53 + custom domain (not IP address)
- [ ] Enable CloudWatch monitoring and alarms
- [ ] Set up automated backups for Postgres volume
- [ ] Use AWS RDS for Postgres instead of Docker container (optional, but recommended)
- [ ] Enable VPC Flow Logs for network monitoring
- [ ] Regularly update Docker images (`docker pull` latest versions)

### IAM Permissions Required

The deployment scripts use these AWS APIs:
- `ec2:RunInstances` (launch instance)
- `ec2:DescribeInstances` (check instance status)
- `ec2:TerminateInstances` (stop/delete)
- `ec2:DescribeSecurityGroups` (check/create SGs)
- `ec2:AuthorizeSecurityGroupIngress` (add inbound rules)
- `ssm:DescribeInstanceInformation` (check SSM connectivity)

Ensure your IAM user has these permissions.

---

## Manual Alternative: Using EC2 Instance Connect

If SSM Session Manager is unavailable:

1. **Enable EC2 Instance Connect** (some AMIs have it by default)
2. **In AWS Console:**
   - EC2 Dashboard → Instances → Select instance → "Connect" button
   - Choose "EC2 Instance Connect" tab
   - Click "Connect" (opens browser-based terminal)
3. **Run setup script:**
   ```bash
   cd concentrate-quiz
   ./scripts/setup-instance.sh
   ```

---

## Next Steps

After deployment:

1. **Verify app works:** Hit health endpoint, check logs
2. **Add a user:** Use admin API or database seed
3. **Test OAuth:** Configure Google credentials if needed
4. **Enable HTTPS:** Set up Certbot + Nginx (see above)
5. **Set up monitoring:** CloudWatch alarms, automated backups
6. **Load test:** Use Apache Bench or k6 to verify performance
7. **Scale:** If needed, add more instances behind a load balancer (not covered here)

---

## Further Reading

- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Ubuntu on AWS](https://ubuntu.com/aws)
- [Certbot with Nginx](https://certbot.eff.org/instructions?ws=nginx&os=ubuntufocal)
- [AWS EC2 Pricing Calculator](https://calculator.aws/)

---

**Last updated:** July 9, 2026  
**Maintainer:** Claude (Anthropic)
