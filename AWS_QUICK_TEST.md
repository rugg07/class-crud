# AWS Deployment Quick Test Guide

Quick verification that your AWS EC2 deployment is complete and working.

---

## ✅ **Phase 1: Verify Instance is Running** (Local Machine)

Run from your local terminal:

```bash
# Get instance ID (from deploy-aws.sh output or):
INSTANCE_ID="i-0abc123def456"

# Check instance status
aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text
# Expected: running

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)
echo "Instance IP: $PUBLIC_IP"
```

---

## ✅ **Phase 2: Connect to Instance & Verify Docker Setup** (Via SSM)

```bash
# Connect to instance
aws ssm start-session --target $INSTANCE_ID

# Once connected (you'll have a bash shell), run:
```

On the **instance shell**, run these commands:

```bash
# 1. Check Docker is installed
docker --version
# Expected: Docker version 20.10+ or higher

# 2. Check Docker Compose is installed  
docker-compose --version
# Expected: Docker Compose version 2.0+

# 3. Check containers are running
docker compose ps
# Expected output:
#   NAME             STATUS
#   postgres         Up X minutes
#   redis            Up X minutes
#   app              Up X minutes (or similar)

# 4. Check Docker networks
docker network ls
# Expected: concentrate-hiring-quiz_default network exists
```

---

## ✅ **Phase 3: Verify Database Setup**

On the **instance shell**:

```bash
# 1. Test PostgreSQL connectivity
docker compose exec postgres psql -U postgres -d concentrate-quiz -c "SELECT 1;"
# Expected: 1 (row with value 1)

# 2. Check if tables exist
docker compose exec postgres psql -U postgres -d concentrate-quiz -c "\dt"
# Expected: List of tables (users, classes, assignments, etc.)

# 3. Check if seed data exists
docker compose exec postgres psql -U postgres -d concentrate-quiz -c "SELECT COUNT(*) FROM users;"
# Expected: 8 (the 8 seed users)

# 4. Test Redis connectivity
docker compose exec redis redis-cli ping
# Expected: PONG
```

---

## ✅ **Phase 4: Verify App Health** (On Instance)

On the **instance shell**:

```bash
# 1. Check Next.js frontend
curl http://localhost:3000/health
# Expected: (might hang or timeout if frontend not serving)

# 2. Check Fastify backend
curl http://localhost:3001/health
# Expected: {"ok":true}

# 3. View app logs (last 20 lines)
docker compose logs --tail=20 app
# Expected: See startup logs, migrations ran, no errors

# 4. Check environment variables loaded
docker compose exec app env | grep DB_HOST
# Expected: DB_HOST=postgres
```

---

## ✅ **Phase 5: Test API Endpoints** (From Local Machine)

Exit the SSM session (type `exit`), then from local machine:

```bash
# Test backend health
curl http://$PUBLIC_IP:3001/health
# Expected: {"ok":true}

# Test login endpoint (create test user first)
# First, on instance, add a test user:
# docker compose exec postgres psql -U postgres -d concentrate-quiz -c \
#   "INSERT INTO users (email, password_hash, name, role, status) VALUES (...)"

# Then test login
curl -X POST http://$PUBLIC_IP:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
# Expected: {"user":{"id":"...","email":"admin@example.com","role":"admin",...},"token":"..."}

# Test frontend (in browser or curl)
curl http://$PUBLIC_IP:3000/
# Expected: HTML response (Next.js page)
```

---

## 🔍 **Phase 6: Troubleshooting Matrix**

| Symptom | Check | Fix |
|---------|-------|-----|
| `docker: command not found` | Docker not installed | Re-run setup script |
| `Connection refused` on ports 3000/3001 | App not running | `docker compose up -d` |
| `postgres: host not found` | Network issue | `docker compose ps` (all up?) |
| `PGTIMEOUT` on psql | DB password wrong | Check `.env` file: `cat .env \| grep DB_` |
| `redis-cli: command not found` | Redis client missing | Install: `sudo apt-get install redis-tools` |
| App logs show errors | Check logs | `docker compose logs app` |
| Port 3000/3001 not accessible from local | Security group | Check AWS security group allows inbound HTTP |
| Login returns 401 | User doesn't exist | Seed user first |

---

## 📋 **Quick Checklist**

Run these in order to validate full setup:

```bash
# From LOCAL MACHINE
INSTANCE_ID="i-0abc123def456"
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

# Phase 1: Instance running?
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].State.Name' --output text
# Expected: running ✅

# Phase 2: Connect and check (via SSM session)
aws ssm start-session --target $INSTANCE_ID
# Then on instance:
docker compose ps  # All should be Up ✅
docker compose exec postgres psql -U postgres -d concentrate-quiz -c "SELECT COUNT(*) FROM users;" # Should be 8 ✅
curl http://localhost:3001/health  # Should be {"ok":true} ✅

# Phase 3: From local machine, check API
curl http://$PUBLIC_IP:3001/health  # Should be {"ok":true} ✅

# Phase 4: Test login
curl -X POST http://$PUBLIC_IP:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password123"}'
# Should return user object with token ✅
```

---

## 🎯 **Success Criteria**

Your AWS setup is **COMPLETE** if all of these are true:

- ✅ EC2 instance is running (State = running)
- ✅ Docker containers are up (`docker compose ps` shows all Up)
- ✅ PostgreSQL is accessible and has data (8 users from seed)
- ✅ Redis is responding (redis-cli ping = PONG)
- ✅ Backend health check passes (`curl http://$IP:3001/health` = `{"ok":true}`)
- ✅ Frontend is accessible (`curl http://$IP:3000/` = HTML)
- ✅ Login API works (POST /auth/login returns token)
- ✅ App logs show no critical errors (`docker compose logs`)

---

## 📞 **If Something Fails**

1. **Check app logs first:**
   ```bash
   aws ssm start-session --target $INSTANCE_ID
   docker compose logs --tail=50 app
   ```

2. **Verify environment variables:**
   ```bash
   cat .env  # Should show all required vars
   docker compose exec app env | grep -E "DB_|REDIS_|JWT"
   ```

3. **Check migrations ran:**
   ```bash
   docker compose logs postgres | grep "migration"
   docker compose exec postgres psql -U postgres -d concentrate-quiz -c "\dt"
   ```

4. **Verify security group:**
   ```bash
   aws ec2 describe-security-groups \
     --filters "Name=group-name,Values=concentrate-*" \
     --query 'SecurityGroups[0].IpPermissions[*].[FromPort,ToPort]'
   # Should allow ports 3000 and 3001
   ```

---

## 🧪 **Manual End-to-End Test**

1. Open browser: `http://<instance-ip>:3000`
2. Login with: `admin@example.com` / `password123`
3. Should redirect to `/admin` dashboard
4. Verify you can see users table
5. Click a user to view details
6. Success! ✅

---

## ⏱️ **Typical Deployment Timeline**

- Instance launch: ~1-2 minutes
- Setup script run: ~3-5 minutes
- Database migrations: ~30 seconds
- First health check: ~5 seconds

**Total time:** 5-10 minutes from launch to fully working

---

## 🛑 **Common Issues & Fixes**

### Issue: "Connection refused" on ports 3000/3001
**Fix:** Check security group allows HTTP (ports 80, 3000, 3001)
```bash
aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id <sg-id> \
  --protocol tcp \
  --port 3001 \
  --cidr 0.0.0.0/0
```

### Issue: Database tables don't exist
**Fix:** Run migrations manually
```bash
aws ssm start-session --target $INSTANCE_ID
docker compose exec app npm run migrate
```

### Issue: Seed data not loaded
**Fix:** Run seed script manually
```bash
docker compose exec app npm run seed
```

### Issue: App container keeps restarting
**Fix:** Check logs and fix environment variables
```bash
docker compose logs app  # See error
# Fix .env file if needed
docker compose restart app
```

---

**Need more help?** See `DEPLOYMENT_GUIDE.md` for detailed setup instructions.
