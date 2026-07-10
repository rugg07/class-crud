# AWS Deployment Testing Guide

**Last updated:** July 9, 2026

## Overview

This guide explains how to verify that your EC2 deployment is complete and working correctly. It includes:

- **Automated testing** via `scripts/test-aws-deployment.sh` (runs from local machine)
- **Manual verification steps** you can run on the instance or from your local machine
- **Troubleshooting matrix** for common issues
- **Expected outcomes** for each test

---

## Quick Test (2 minutes)

### For the Impatient

If you just want a quick check:

```bash
# From your local machine
./scripts/test-aws-deployment.sh i-1234567890abcdef0
```

This runs 15+ automated checks and reports results in ~30 seconds.

**Expected output:**
```
=== Test Summary ===
Results:
  Passed: 15
  Failed: 0

✅ All critical tests passed!
```

---

## Automated Test Suite

### What It Tests

The `test-aws-deployment.sh` script validates:

| Phase | Tests | Run From |
|-------|-------|----------|
| **Connectivity** | Instance running, SSM reachable, public IP | Local machine |
| **Services** | Docker running, containers up, databases healthy | Local machine (via SSM) |
| **Network** | Ports 3000/3001 accessible, SSH disabled | Local machine + SSM |
| **Database** | Migrations ran, tables exist, schema valid | Local machine (via SSM) |
| **Logs** | No critical errors, disk space OK | Local machine (via SSM) |

### Running the Test

**Prerequisites:**
- AWS CLI installed and configured
- Instance ID from `deploy-aws.sh` output
- Instance running and SSM-ready (wait 1-2 minutes after launch)

**Command:**
```bash
./scripts/test-aws-deployment.sh <INSTANCE_ID> [REGION]
```

**Example:**
```bash
./scripts/test-aws-deployment.sh i-0a1b2c3d4e5f6g7h8
./scripts/test-aws-deployment.sh i-0a1b2c3d4e5f6g7h8 us-east-1
```

**Output:**
- Color-coded results (✅ pass, ❌ fail, ⚠️ warn)
- Summary showing X/Y tests passed
- Exit code 0 on success, 1 on failure
- Detailed info for each test

**Notes:**
- Some tests take 5-10 seconds (waiting for containers to respond)
- If app is still starting up, you may see warnings — wait 30 seconds and retry
- SSM commands may take 3-5 seconds to execute

---

## Manual Verification Steps

### Phase 1: Instance Health (from local machine)

#### 1.1 Check Instance Status
```bash
aws ec2 describe-instances \
  --instance-ids i-0a1b2c3d4e5f6g7h8 \
  --region us-east-1 \
  --query 'Reservations[0].Instances[0].[State.Name,InstanceType,PublicIpAddress]' \
  --output table
```

**Expected output:**
```
|  running  |  t3.small  |  10.0.1.2  |
```

#### 1.2 Check SSM Connectivity
```bash
aws ssm describe-instance-information \
  --instance-information-filter-list "key=InstanceIds,valueSet=i-0a1b2c3d4e5f6g7h8" \
  --region us-east-1 \
  --query 'InstanceInformationList[0].[InstanceId,PingStatus]' \
  --output table
```

**Expected output:**
```
|  i-0a1b2c3d4e5f6g7h8  |  Online  |
```

**If you see "NoResponse" or "ConnectionLost":**
- Wait 1-2 more minutes (SSM agent takes time to start)
- Verify IAM role `sandbox-ssm-instance` exists
- Check AWS Systems Manager → Fleet Manager for the instance

### Phase 2: Docker Services (run on instance via SSM)

#### 2.1 Start an SSM Session
```bash
aws ssm start-session --target i-0a1b2c3d4e5f6g7h8 --region us-east-1
```

You'll get a shell prompt on the instance. Now run the following commands:

#### 2.2 Check Docker Installation
```bash
docker --version
docker compose --version
```

**Expected:**
```
Docker version 27.0.1, build 6d37db3
Docker Compose version v2.27.0
```

#### 2.3 Check Running Containers
```bash
docker ps
```

**Expected:**
```
CONTAINER ID   IMAGE                      NAMES                     STATUS
abc123def456   postgres:17-alpine         concentrate-quiz-db       Up 5 minutes (healthy)
def456ghi789   redis:7-alpine             school-portal-redis       Up 5 minutes (healthy)
ghi789jkl012   concentrate-quiz:latest    concentrate-quiz-app      Up 3 minutes (healthy)
```

**If containers are missing or "exited":**
- Run: `docker compose ps -a` (to see all containers)
- Check logs: `docker compose logs`
- Restart: `docker compose down && docker compose up -d`

#### 2.4 Check PostgreSQL
```bash
# Test connectivity
docker exec concentrate-quiz-db pg_isready -U postgres

# Connect to database
docker exec -it concentrate-quiz-db psql -U postgres -d concentrate-quiz

# Inside psql, list tables
\dt

# Exit psql
\q
```

**Expected:**
```
PostgreSQL is accepting connections

                     List of relations
 Schema |               Name                | Type  | Owner
--------+-----------------------------------+-------+----------
 public | enrollment                        | table | postgres
 public | assignments                       | table | postgres
 public | classes                           | table | postgres
 public | users                             | table | postgres
 public | submissions                       | table | postgres
 public | grades                            | table | postgres
(6 rows)
```

**If tables are missing:**
- Migrations didn't run
- Run manually: `docker exec concentrate-quiz-app npm run migrate`
- Check migration logs: `docker logs concentrate-quiz-app | grep -i "migrat"`

#### 2.5 Check Redis
```bash
docker exec school-portal-redis redis-cli ping
```

**Expected:**
```
PONG
```

#### 2.6 Check Application Health
```bash
# Backend health
curl http://localhost:3001/health

# Frontend (should return HTML)
curl http://localhost:3000 | head -20
```

**Expected:**
```
{"ok":true}
```

#### 2.7 View Application Logs
```bash
# Last 50 lines
docker logs concentrate-quiz-app --tail=50

# Real-time logs
docker logs -f concentrate-quiz-app

# Combine all service logs
docker compose logs -f
```

**Look for:**
- No `ERROR` or `FATAL` messages
- Messages like `Listening on 3000` / `Listening on 3001`
- Connection successful to Postgres and Redis

#### 2.8 Check Environment Configuration
```bash
# View environment file
cat ~/concentrate-quiz/.env

# Check specific variables
grep "JWT_SECRET\|DB_PASSWORD\|REDIS_URL" ~/concentrate-quiz/.env
```

**Should show:**
```
JWT_SECRET=<base64-string>
DB_PASSWORD=<password>
REDIS_URL=redis://redis:6379
DB_HOST=postgres
DB_PORT=5432
```

### Phase 3: Network Accessibility (from local machine)

#### 3.1 Get Public IP
```bash
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids i-0a1b2c3d4e5f6g7h8 \
  --region us-east-1 \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

echo "Public IP: $PUBLIC_IP"
```

#### 3.2 Test Frontend (Port 3000)
```bash
curl -I http://$PUBLIC_IP:3000
```

**Expected:**
```
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
```

#### 3.3 Test Backend API (Port 3001)
```bash
curl -I http://$PUBLIC_IP:3001/health
```

**Expected:**
```
HTTP/1.1 200 OK
Content-Type: application/json
```

#### 3.4 Test API Response
```bash
curl http://$PUBLIC_IP:3001/health | jq .
```

**Expected:**
```json
{
  "ok": true
}
```

#### 3.5 Verify SSH is Disabled (Security Check)
```bash
# This should timeout/refuse after 3 seconds
timeout 3 bash -c "cat < /dev/null > /dev/tcp/$PUBLIC_IP/22"
# If connection refused or timeout → ✅ correct (SSH disabled)
# If connection accepted → ⚠️  SSH is open (should not be)
```

### Phase 4: Authentication & API Testing

#### 4.1 Check if Seed Data Exists
```bash
# Connect to database (from instance)
docker exec -it concentrate-quiz-db psql -U postgres -d concentrate-quiz

# Count users
SELECT COUNT(*) FROM users;

# Exit
\q
```

**Expected:** At least 1 user (from seed)

#### 4.2 Test Login Endpoint (from local machine)

First, check what seed users exist:

```bash
# From instance, query database
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz -c "SELECT email, password_hash FROM users LIMIT 5;"
```

Then test login:

```bash
curl -X POST http://$PUBLIC_IP:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@example.com","password":"password123"}'
```

**Expected response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "teacher@example.com",
    "role": "teacher",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiI..."
}
```

**If login fails:**
- Check if seed data ran: `docker exec concentrate-quiz-app npm run seed`
- Verify database tables exist: `docker compose exec postgres psql -U postgres -d concentrate-quiz -c "\dt"`

#### 4.3 Test Authenticated Request
```bash
# Use the token from login response
TOKEN="<your-jwt-token>"

curl http://$PUBLIC_IP:3001/api/classes \
  -H "Authorization: Bearer $TOKEN"
```

**Expected:** List of classes (may be empty if no seed data)

### Phase 5: Database Migration Status

#### 5.1 Check Migration History
```bash
# From instance
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz \
  -c "SELECT * FROM \"_migrations\" ORDER BY name DESC LIMIT 10;"
```

**Expected:**
```
          name          | created_at
------------------------+----------------------------
005_add_submission_files| 2024-07-09 12:34:56.789
004_create_assignments | 2024-07-09 12:34:50.123
003_create_classes     | 2024-07-09 12:34:44.456
002_create_teachers    | 2024-07-09 12:34:38.789
001_create_users       | 2024-07-09 12:34:32.012
```

#### 5.2 Verify All Required Tables
```bash
# From instance
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz << 'EOF'
  \d users
  \d classes
  \d assignments
  \d submissions
  \d grades
EOF
```

Each command should show the table schema without errors.

---

## Troubleshooting Matrix

### Issue: App won't start / exits immediately

**Symptoms:**
- `docker ps` shows container as "Exited"
- Port 3001 not responding

**Check:**
```bash
# 1. View logs
docker logs concentrate-quiz-app --tail=100

# 2. Check environment variables
cat ~/concentrate-quiz/.env

# 3. Check database connectivity
docker logs concentrate-quiz-db

# 4. Check migrations
docker logs concentrate-quiz-app | grep -i "migrat"
```

**Solutions:**
| Issue | Fix |
|-------|-----|
| `ECONNREFUSED localhost:5432` | Database not starting. Wait 30 seconds, or: `docker compose up -d postgres && docker compose logs -f postgres` |
| `Error: ENOMEM` | Out of memory. Check: `free -h` |
| `Module not found` | Dependencies not installed. Run: `docker build -f Dockerfile.production -t concentrate-quiz .` |
| `JWT_SECRET not set` | Edit `.env` file or re-run setup script |

---

### Issue: Database connection errors

**Symptoms:**
- App logs show `could not connect to server`
- Login endpoint returns `500 Internal Server Error`

**Check:**
```bash
# 1. Is Postgres running?
docker ps | grep postgres

# 2. Is it healthy?
docker inspect concentrate-quiz-db --format='{{.State.Health.Status}}'

# 3. Can we connect?
docker exec concentrate-quiz-db pg_isready -U postgres

# 4. Check credentials in .env
grep "DB_HOST\|DB_PORT\|DB_USER\|DB_PASSWORD" ~/concentrate-quiz/.env
```

**Solutions:**
| Issue | Fix |
|-------|-----|
| Container exited | `docker logs concentrate-quiz-db` and check available disk space |
| `FATAL: password authentication failed` | Verify `DB_PASSWORD` in `.env` matches Postgres password in `docker-compose.production.yml` |
| `FATAL: database concentrate-quiz does not exist` | Run migrations: `docker exec concentrate-quiz-app npm run migrate` |
| Postgres stuck at "starting" | Restart: `docker compose restart postgres` |

---

### Issue: Ports not responding / security group issue

**Symptoms:**
- `curl http://$PUBLIC_IP:3000` times out
- Port 443 not responding (HTTPS)

**Check:**
```bash
# 1. Is app listening on those ports?
docker exec concentrate-quiz-app netstat -tlnp | grep -E '3000|3001'

# 2. Check security group rules
aws ec2 describe-security-groups \
  --group-ids sg-123abc \
  --query 'SecurityGroups[0].IpPermissions[*].[FromPort,ToPort,IpRanges[*].CidrIp]' \
  --output table

# 3. Check instance has internet
docker run --rm alpine ping -c 1 8.8.8.8
```

**Solutions:**
| Issue | Fix |
|-------|-----|
| Port not in security group | Add inbound rule: `aws ec2 authorize-security-group-ingress --group-id sg-xyz --protocol tcp --port 3000 --cidr 0.0.0.0/0` |
| App not listening | Check `docker logs concentrate-quiz-app` for startup errors |
| Firewall blocking (on your network) | Try from different network or check corporate firewall |

---

### Issue: Seed data didn't load

**Symptoms:**
- Database tables exist but are empty
- Login fails with "user not found"

**Check:**
```bash
# 1. Did seed script run?
docker logs concentrate-quiz-app | grep -i "seed"

# 2. Are there any users?
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz \
  -c "SELECT COUNT(*) FROM users;"

# 3. Check app logs
docker logs concentrate-quiz-app --tail=50
```

**Solutions:**
```bash
# Option 1: Run seed manually
docker exec concentrate-quiz-app npm run seed

# Option 2: Check if seed script exists
docker exec concentrate-quiz-app ls -la src/server/db/seed.ts

# Option 3: Insert test user directly
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz << 'EOF'
  INSERT INTO users (email, password_hash, role)
  VALUES ('teacher@example.com', '\$2a\$10\$...', 'teacher');
EOF
```

---

### Issue: Out of disk space

**Symptoms:**
- Containers can't start
- App crashes with `ENOSPC: no space left on device`

**Check:**
```bash
# 1. Check root filesystem
df -h /

# 2. Check Docker disk usage
docker system df

# 3. Find large files
du -sh /* | sort -hr | head -10
```

**Solutions:**
```bash
# 1. Clean up Docker
docker system prune -a --volumes

# 2. Clean old logs
docker logs concentrate-quiz-app 2>&1 | wc -c  # Check log size
# Consider rotating logs in docker-compose.yml

# 3. Stop containers if absolutely necessary
docker compose down

# 4. Check/backup database volume
docker volume ls
```

---

### Issue: Can't connect via SSM

**Symptoms:**
- `aws ssm start-session` times out
- Instance shows "NoResponse" in Fleet Manager

**Check:**
```bash
# 1. Is instance running?
aws ec2 describe-instances --instance-ids i-xyz --query 'Reservations[0].Instances[0].State.Name'

# 2. Check SSM agent status
aws ssm describe-instance-information \
  --instance-information-filter-list "key=InstanceIds,valueSet=i-xyz" \
  --query 'InstanceInformationList[0].PingStatus'

# 3. Does IAM role have SSM permission?
aws iam list-attached-role-policies --role-name sandbox-ssm-instance
```

**Solutions:**
| Issue | Fix |
|-------|-----|
| "NoResponse" | Wait 2-3 minutes after instance launch (SSM agent starts slowly) |
| Role doesn't have SSM policy | Admin must attach `AmazonSSMManagedInstanceCore` to role |
| Instance in wrong security group | Security group must allow outbound HTTPS (443) for SSM |

---

### Issue: High CPU or memory usage

**Symptoms:**
- App is slow
- Instance becoming unresponsive
- `top` command shows high usage

**Check:**
```bash
# 1. Check resource usage
docker stats

# 2. Check instance metrics
free -h  # Memory
df -h    # Disk
top -b -n 1  # CPU

# 3. Check Redis memory
docker exec school-portal-redis redis-cli info memory
```

**Solutions:**
| Issue | Fix |
|-------|-----|
| Database bloated | Vacuum Postgres: `docker exec concentrate-quiz-db vacuumdb -U postgres concentrate-quiz` |
| Redis full | Clear cache: `docker exec school-portal-redis redis-cli FLUSHALL` |
| Node.js memory leak | Restart app: `docker compose restart app` |
| t3.small too small | Upgrade to t3.medium or t3.large |

---

## Quick Checklist (30 seconds)

Copy and paste this into your instance shell:

```bash
#!/bin/bash
echo "=== Concentrate Quiz Deployment Checklist ==="
echo ""
echo "1. Containers running:"
docker ps | grep -E "postgres|redis|app"
echo ""
echo "2. Database ready:"
docker exec concentrate-quiz-db pg_isready -U postgres
echo ""
echo "3. Redis ready:"
docker exec school-portal-redis redis-cli ping
echo ""
echo "4. Backend health:"
curl -s http://localhost:3001/health
echo ""
echo "5. Frontend responding:"
curl -s http://localhost:3000 | head -1
echo ""
echo "6. Disk usage:"
df -h / | tail -1
echo ""
echo "✅ All checks passed!" || echo "❌ See errors above"
```

Save as `health-check.sh`, make executable, and run:
```bash
chmod +x health-check.sh
./health-check.sh
```

---

## What to Check If Tests Fail

| Symptom | First Check | Second Check | Third Check |
|---------|------------|--------------|-------------|
| All tests fail | Instance running? | SSH accessible? | Security group correct? |
| Backend port fails | App logs | Database logs | Restart containers |
| Database fails | Postgres logs | Disk space | Re-run migrations |
| Network fails | Security group rules | Public IP assigned | Network ACLs |
| SSM fails | Wait 2 min | IAM role has policy | Check Fleet Manager |
| Login fails | Seed data exists? | User table populated | Try direct SQL insert |
| Slow response | Check CPU/memory | Clear Redis cache | Upgrade instance type |

---

## Performance Baseline (t3.small)

**Expected performance on t3.small instance:**

| Operation | Expected Time |
|-----------|---------------|
| Container startup | 30-60 seconds |
| Database connection | <100ms |
| Health check | <50ms |
| Login request | 100-300ms |
| List classes | 50-200ms |
| Page load (frontend) | 1-3 seconds |

If significantly slower:
1. Check `docker stats` for CPU/memory usage
2. Check database query performance: `EXPLAIN ANALYZE SELECT ...;`
3. Check Redis memory: `redis-cli info memory`
4. Consider upgrading to t3.medium

---

## Success Criteria

Your deployment is **successful** when:

- [ ] `test-aws-deployment.sh` passes with 0 failures
- [ ] `docker ps` shows 3 healthy containers
- [ ] `curl http://localhost:3001/health` returns `{"ok":true}`
- [ ] `curl http://PUBLIC_IP:3000` returns homepage HTML
- [ ] Login endpoint responds with JWT token
- [ ] Database tables exist and contain seed data
- [ ] No critical errors in `docker logs`
- [ ] Disk usage <80%

---

## Next Steps After Validation

1. **Test functionality:**
   - Log in as a teacher
   - Create a test class
   - Create an assignment
   - Verify student enrollment

2. **Set up monitoring:**
   - CloudWatch alarms for CPU/memory
   - Log aggregation (CloudWatch Logs)
   - Health check endpoint monitoring

3. **Production readiness:**
   - Switch to HTTPS with Certbot
   - Set up custom domain with Route53
   - Configure backups for Postgres
   - Restrict security group to your IP range

4. **Performance tuning:**
   - Profile slowest endpoints
   - Optimize database queries
   - Enable Redis caching
   - Consider read replicas if needed

---

## Further Reference

- **Deployment guide:** `docs/AWS_DEPLOYMENT.md`
- **Quick reference:** `docs/DEPLOYMENT_QUICKREF.md`
- **Test script:** `scripts/test-aws-deployment.sh`
- **AWS Systems Manager:** https://docs.aws.amazon.com/systems-manager/
- **Docker Compose docs:** https://docs.docker.com/compose/

---

**Questions?** Check the troubleshooting section above or review application logs:
```bash
docker compose logs -f
```
