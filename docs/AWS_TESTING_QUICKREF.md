# AWS Deployment Testing - Quick Reference

**Time needed:** 2-5 minutes | **Runs from:** Local machine or EC2 instance

---

## One-Command Test

```bash
./scripts/test-aws-deployment.sh i-YOUR_INSTANCE_ID
```

✅ = pass | ❌ = fail | ⚠️ = warning

Exit code 0 = success, 1 = failure

---

## 10 Essential Verification Commands

Run these to verify your deployment. Expected outputs shown below each command.

### On Local Machine

#### 1. Instance is running
```bash
aws ec2 describe-instances --instance-ids i-YOUR_ID --query 'Reservations[0].Instances[0].State.Name' --output text
```
**Expected:** `running`

#### 2. Get public IP
```bash
aws ec2 describe-instances --instance-ids i-YOUR_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
```
**Expected:** `10.x.x.x` or IP address

#### 3. Frontend accessible
```bash
curl -I http://PUBLIC_IP:3000
```
**Expected:** `HTTP/1.1 200 OK`

#### 4. Backend accessible
```bash
curl http://PUBLIC_IP:3001/health
```
**Expected:** `{"ok":true}`

---

### On EC2 Instance (via SSM)

```bash
aws ssm start-session --target i-YOUR_ID --region us-east-1
# Now you're in instance shell. Run the following:
```

#### 5. Containers running
```bash
docker ps
```
**Expected:** 3 healthy containers (`concentrate-quiz-app`, `concentrate-quiz-db`, `school-portal-redis`)

#### 6. Database ready
```bash
docker exec concentrate-quiz-db pg_isready -U postgres
```
**Expected:** `accepting connections`

#### 7. Redis ready
```bash
docker exec school-portal-redis redis-cli ping
```
**Expected:** `PONG`

#### 8. Database has tables
```bash
docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz -c "\dt"
```
**Expected:** List of 6+ tables (users, classes, assignments, submissions, grades, enrollments)

#### 9. App logs no errors
```bash
docker logs concentrate-quiz-app --tail=20 | grep -i error
```
**Expected:** (nothing/empty output = no errors)

#### 10. Disk space OK
```bash
df -h / | tail -1
```
**Expected:** Usage <80% (e.g., `65%`)

---

## Common Issues & Fixes

| Problem | Check | Fix |
|---------|-------|-----|
| `curl` times out | Security group rules | `aws ec2 authorize-security-group-ingress --group-id sg-XYZ --protocol tcp --port 3000 --cidr 0.0.0.0/0` |
| Container exited | Logs | `docker logs CONTAINER_NAME` |
| Database connection error | Database health | `docker logs concentrate-quiz-db` |
| Can't connect via SSM | Wait time | Wait 2-3 minutes after instance launch |
| Tables missing | Migrations | `docker exec concentrate-quiz-app npm run migrate` |
| Login fails | Seed data | `docker exec concentrate-quiz-app npm run seed` |

---

## Phase Checklist

### ✅ Phase 1: Instance Connectivity (1 min)
- [ ] Instance running (command #1)
- [ ] Public IP assigned (command #2)
- [ ] Can SSH to instance (no, it's disabled for security ✓)
- [ ] SSM online (test-aws-deployment.sh checks this)

### ✅ Phase 2: Containers Running (2 min)
- [ ] 3 containers up (command #5)
- [ ] Postgres healthy (command #6)
- [ ] Redis healthy (command #7)

### ✅ Phase 3: App Responding (1 min)
- [ ] Frontend 3000 responds (command #3)
- [ ] API 3001 responds (command #4)
- [ ] Health endpoint OK (command #4)

### ✅ Phase 4: Database Ready (1 min)
- [ ] Tables exist (command #8)
- [ ] Migrations complete (grep for `_migrations` table)
- [ ] Seed data loaded (query user count)

### ✅ Phase 5: No Critical Issues (1 min)
- [ ] No errors in logs (command #9)
- [ ] Disk space OK (command #10)
- [ ] App memory usage normal

---

## Environment Variables Check

```bash
# On instance
cat ~/concentrate-quiz/.env
```

Should have:
- `JWT_SECRET` - random string
- `DB_PASSWORD` - random string
- `DB_HOST=postgres` - points to docker service
- `REDIS_URL=redis://redis:6379` - points to docker service
- `DB_USER=postgres`
- `DB_NAME=concentrate-quiz`

---

## Port Verification

| Port | Service | Status | Test |
|------|---------|--------|------|
| 3000 | Frontend (Next.js) | ✅ must be open | `curl http://IP:3000` |
| 3001 | Backend API (Fastify) | ✅ must be open | `curl http://IP:3001/health` |
| 22 | SSH | ❌ must be closed | `timeout 3 bash -c 'cat < /dev/null > /dev/tcp/IP/22'` (should fail) |
| 5432 | Postgres | ✅ open (internal only) | Only accessible from container |
| 6379 | Redis | ✅ open (internal only) | Only accessible from container |

---

## Troubleshooting Decision Tree

```
Test failed? →
  ├─ Instance running?
  │  ├─ No → Start with: aws ec2 start-instances --instance-ids i-XYZ
  │  └─ Yes → Check SSM
  │
  ├─ SSM Online?
  │  ├─ No → Wait 2 min, then: aws ssm describe-instance-information --filter "key=InstanceIds,valueSet=i-XYZ"
  │  └─ Yes → Connect and check containers
  │
  ├─ Containers running?
  │  ├─ No → Check logs: docker logs CONTAINER_NAME
  │  │  ├─ Database error? → docker logs concentrate-quiz-db
  │  │  ├─ App error? → docker logs concentrate-quiz-app
  │  │  └─ Fix, then: docker compose up -d
  │  └─ Yes → Check health
  │
  ├─ Health check 200?
  │  ├─ No → Check app logs: docker logs concentrate-quiz-app
  │  └─ Yes → Check database
  │
  ├─ Database accessible?
  │  ├─ No → Check docker logs concentrate-quiz-db, wait 30s, retry
  │  └─ Yes → Check migrations
  │
  └─ Migrations ran?
     ├─ No → docker exec concentrate-quiz-app npm run migrate
     └─ Yes → ✅ DEPLOYMENT SUCCESSFUL
```

---

## Baseline Response Times (t3.small)

```
Health check (/health)     : ~50ms ✓
List classes (/api/classes): ~100ms ✓
Login POST (/auth/login)   : ~200ms ✓
Frontend page load         : ~1-3s ✓
Database query             : <100ms ✓
```

If >2x slower, check: `docker stats` and Redis memory

---

## Restart Everything

If something's stuck:

```bash
# On instance
cd ~/concentrate-quiz

# Stop everything
docker compose down

# Wait 5 seconds
sleep 5

# Start everything
docker compose up -d

# Monitor startup (30 seconds)
docker compose logs -f
```

---

## Security Checks

- [ ] SSH port 22 disabled: `timeout 3 bash -c "cat < /dev/null > /dev/tcp/$IP/22"` → should fail
- [ ] Health endpoint public: `curl http://PUBLIC_IP:3001/health` → should work
- [ ] JWT token required for API: `curl http://PUBLIC_IP:3001/api/classes` → should return 401
- [ ] No secrets in logs: `docker logs concentrate-quiz-app | grep -i "password\|secret"` → should be empty
- [ ] Database password not in logs: `docker logs concentrate-quiz-db | grep -i "password"` → should be empty

---

## Automated Test Output Example

```
=== AWS EC2 Deployment Test Suite ===
Instance ID: i-0a1b2c3d4e5f6g7h8
Region: us-east-1
Time: Wed Jul 09 12:34:56 UTC 2026

=== Phase 1: Instance Connectivity & Metadata ===
  Instance exists and is running... ✅ PASS
  Instance Type: t3.small
  SSM Session Manager connectivity... ✅ PASS
  Get instance public IP... ✅ PASS
  Public IP: 10.0.1.2

=== Phase 2: Remote Service Checks (via SSM) ===
  Docker installed and accessible... ✅ PASS
  Docker Compose services running... ✅ PASS
    - concentrate-quiz-app:Up 3 minutes (healthy)
    - concentrate-quiz-db:Up 5 minutes (healthy)
    - school-portal-redis:Up 5 minutes (healthy)

=== Phase 3: Network & Port Connectivity ===
  Frontend port 3000 accessible... ✅ PASS
  Backend port 3001 accessible... ✅ PASS
  Backend health endpoint (/health)... ✅ PASS
  Response: {"ok":true}
  SSH port 22 disabled... ✅ PASS

=== Test Summary ===
Results:
  Passed: 15
  Failed: 0

✅ All critical tests passed!

Your deployment is ready. Next steps:
  1. Open browser: http://10.0.1.2:3000
  2. Test login with seed credentials
  3. Create a test class and assignment
```

---

## More Help

- **Full guide:** `docs/AWS_DEPLOYMENT.md`
- **Testing guide:** `docs/AWS_TESTING.md`
- **Test script:** `scripts/test-aws-deployment.sh`
- **Instance setup:** `scripts/setup-instance.sh`

---

**Last updated:** July 9, 2026
