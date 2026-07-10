# AWS Deployment Quick Reference

**For the complete guide, see `AWS_DEPLOYMENT.md`**

## TL;DR - Deploy in 3 Steps

```bash
# 1. Launch instance (from local machine)
./scripts/deploy-aws.sh
# Output: Instance ID and connection command

# 2. Connect and setup (on EC2 instance)
aws ssm start-session --target <INSTANCE_ID>
./scripts/setup-instance.sh

# 3. Access app
curl http://localhost:3001/health
```

## Common Commands

### Local Machine (deployment)

```bash
# Launch instance (t3.small, us-east-1 default)
./scripts/deploy-aws.sh

# Launch with custom size
./scripts/deploy-aws.sh t4g.small us-east-1

# Connect to instance
aws ssm start-session --target i-xxxxx --region us-east-1

# View instance details
aws ec2 describe-instances --instance-ids i-xxxxx --region us-east-1

# Teardown (stops + deletes instance + security group)
./scripts/teardown-aws.sh i-xxxxx us-east-1 --delete-sg
```

### On EC2 Instance (setup + operations)

```bash
# Clone repo
git clone https://github.com/your-org/concentrate-quiz.git
cd concentrate-quiz

# Run initial setup (installs Docker, starts services)
./scripts/setup-instance.sh

# View service logs (real-time)
docker compose -f docker-compose.production.yml logs -f

# View specific service logs
docker compose -f docker-compose.production.yml logs app
docker compose -f docker-compose.production.yml logs postgres

# Run database migrations
docker exec concentrate-quiz-app npm run migrate

# Check health
curl http://localhost:3001/health

# View all running containers
docker ps

# Stop services
docker compose -f docker-compose.production.yml down

# Restart services
docker compose -f docker-compose.production.yml restart

# Access Postgres database directly
docker exec -it concentrate-quiz-db psql -U postgres -d concentrate-quiz

# Access Redis CLI
docker exec -it concentrate-quiz-redis redis-cli

# Rebuild and restart app (after code changes)
docker compose -f docker-compose.production.yml build --no-cache app
docker compose -f docker-compose.production.yml up -d app

# View environment variables
docker exec concentrate-quiz-app env | grep -E "JWT|DB|REDIS"

# Check disk usage
df -h
du -sh ~/concentrate-quiz

# Clean up Docker (remove unused images, containers, volumes)
docker system prune -a
```

## Environment Setup

### On Instance - Edit `.env`

```bash
# Critical secrets for production
JWT_SECRET=<generate-32-char-random-string>
DB_PASSWORD=<generate-strong-random>
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
```

**Generate secrets:**

```bash
# 32-byte random JWT secret
openssl rand -base64 32

# 16-byte random DB password
openssl rand -base64 16

# Or use /dev/urandom
head -c 32 /dev/urandom | base64
```

## Monitoring & Health Checks

```bash
# API health
curl http://localhost:3001/health

# Next.js frontend
curl http://localhost:3000

# Container status
docker compose -f docker-compose.production.yml ps

# Service logs (last 100 lines)
docker compose -f docker-compose.production.yml logs --tail 100

# Database connectivity
docker exec concentrate-quiz-db pg_isready -U postgres

# Redis connectivity
docker exec concentrate-quiz-redis redis-cli ping

# Check app resource usage
docker stats concentrate-quiz-app
```

## Troubleshooting

### "Instance not found" error
- Verify instance ID is correct: `aws ec2 describe-instances --instance-ids i-xxxxx`
- Check region matches

### "SSM Session failed"
- Wait 1-2 minutes after instance launch
- Verify IAM role `sandbox-ssm-instance` exists

### "Port already in use"
```bash
# Kill conflicting process
lsof -i :3001
kill -9 <PID>

# Or restart containers
docker compose -f docker-compose.production.yml restart
```

### Postgres not responding
```bash
# Check health
docker exec concentrate-quiz-db pg_isready -U postgres

# View logs
docker logs concentrate-quiz-db

# Restart
docker compose -f docker-compose.production.yml restart postgres
```

### App crashing after start
```bash
# View logs
docker logs concentrate-quiz-app

# Manual migration run
docker exec concentrate-quiz-app npm run migrate

# Restart
docker compose -f docker-compose.production.yml restart app
```

## Costs

| Service | t3.small | t3.micro |
|---------|----------|----------|
| EC2 instance/month | ~$10 | ~$5 |
| Data transfer/month | ~$10 | ~$10 |
| Free tier eligible | ✅ (12 mo) | ✅ (12 mo) |

**Stop instance when not in use:**
```bash
aws ec2 stop-instances --instance-ids i-xxxxx
aws ec2 start-instances --instance-ids i-xxxxx
```

## Production Checklist

- [ ] Use strong `JWT_SECRET` (32+ chars, stored in AWS Secrets Manager)
- [ ] Use strong `DB_PASSWORD` (20+ chars, random)
- [ ] Restrict security group to your IP (not 0.0.0.0/0)
- [ ] Set up HTTPS with Certbot + Nginx
- [ ] Use custom domain (DNS via Route53)
- [ ] Enable CloudWatch monitoring
- [ ] Backup Postgres data (daily snapshots)
- [ ] Use RDS for Postgres instead of container (optional)
- [ ] Implement rate limiting
- [ ] Enable audit logging

## Links

- Full guide: `docs/AWS_DEPLOYMENT.md`
- Project structure: `BE-HANDOFF.md`
- API endpoints: `BE-HANDOFF.md` → "API Routes"
- Database schema: `BE-HANDOFF.md` → "Database Schema"
