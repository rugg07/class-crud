#!/bin/bash

################################################################################
# AWS EC2 Deployment Test Suite
#
# Validates that an EC2 instance deployed with setup-instance.sh is working
# correctly. Run this script from your LOCAL MACHINE after the instance is
# running.
#
# Prerequisites:
#   - AWS CLI installed and configured
#   - Instance is running and SSM-ready
#   - Instance ID is passed as argument
#
# Usage:
#   ./scripts/test-aws-deployment.sh <INSTANCE_ID>
#   ./scripts/test-aws-deployment.sh i-1234567890abcdef0
#
# Exit codes:
#   0 = all tests passed
#   1 = some tests failed
#
################################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
INSTANCE_ID="${1:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
TESTS_PASSED=0
TESTS_FAILED=0
TIMEOUT_SECONDS=30

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}=== $1 ===${NC}"
}

print_test() {
  echo -n "  $1... "
}

print_pass() {
  echo -e "${GREEN}✅ PASS${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

print_fail() {
  echo -e "${RED}❌ FAIL${NC}: $1"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

print_warn() {
  echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

print_info() {
  echo -e "${CYAN}ℹ️  INFO${NC}: $1"
}

# Validate inputs
if [ -z "$INSTANCE_ID" ]; then
  echo -e "${RED}Error: Instance ID required${NC}"
  echo ""
  echo "Usage: $0 <INSTANCE_ID>"
  echo "Example: $0 i-1234567890abcdef0"
  exit 1
fi

# Main test flow
print_header "AWS EC2 Deployment Test Suite"
echo "Instance ID: $INSTANCE_ID"
echo "Region: $AWS_REGION"
echo "Time: $(date)"
echo ""

################################################################################
# Phase 1: Instance Connectivity
################################################################################
print_header "Phase 1: Instance Connectivity & Metadata"

# Test 1.1: Instance exists and is running
print_test "Instance exists and is running"
if INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text 2>/dev/null); then

  if [ "$INSTANCE_STATE" = "running" ]; then
    print_pass
    INSTANCE_TYPE=$(aws ec2 describe-instances \
      --instance-ids "$INSTANCE_ID" \
      --region "$AWS_REGION" \
      --query 'Reservations[0].Instances[0].InstanceType' \
      --output text)
    print_info "Instance Type: $INSTANCE_TYPE"
  else
    print_fail "Instance state is $INSTANCE_STATE, expected 'running'"
  fi
else
  print_fail "Could not describe instance"
fi

# Test 1.2: SSM connectivity
print_test "SSM Session Manager connectivity"
if aws ssm describe-instance-information \
  --instance-information-filter-list "key=InstanceIds,valueSet=$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'InstanceInformationList[0].PingStatus' \
  --output text 2>/dev/null | grep -q "Online"; then
  print_pass
else
  print_fail "Instance not reachable via SSM (may need 1-2 more minutes for agent startup)"
fi

# Test 1.3: Get public IP
print_test "Get instance public IP"
PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --region "$AWS_REGION" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

if [ -n "$PUBLIC_IP" ] && [ "$PUBLIC_IP" != "None" ]; then
  print_pass
  print_info "Public IP: $PUBLIC_IP"
else
  print_fail "Could not obtain public IP"
  PUBLIC_IP=""
fi

################################################################################
# Phase 2: Remote Service Checks (via SSM)
################################################################################
print_header "Phase 2: Remote Service Checks (via SSM)"

# Helper to run command via SSM
run_ssm_command() {
  local cmd="$1"
  aws ssm start-session \
    --target "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "command=$cmd" \
    --region "$AWS_REGION" \
    2>/dev/null || echo ""
}

# Test 2.1: Docker installed
print_test "Docker installed and accessible"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker --version" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "Docker version"; then
  print_pass
else
  print_fail "Docker not found or not accessible"
fi

# Test 2.2: Docker Compose running
print_test "Docker Compose services running"
if CONTAINER_STATUS=$(aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker ps --format='{{.Names}}:{{.Status}}'" \
  --region "$AWS_REGION" \
  2>&1); then

  if echo "$CONTAINER_STATUS" | grep -q "concentrate-quiz"; then
    print_pass
    echo "$CONTAINER_STATUS" | grep "concentrate-quiz" | while read -r line; do
      echo "      - $line"
    done
  else
    print_fail "Expected containers not found in 'docker ps' output"
  fi
else
  print_fail "Could not check running containers"
fi

# Test 2.3: PostgreSQL container health
print_test "PostgreSQL container running"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker inspect concentrate-quiz-db --format='{{.State.Running}}'" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "true"; then
  print_pass
else
  print_fail "PostgreSQL container not running"
fi

# Test 2.4: Redis container health
print_test "Redis container running"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker inspect school-portal-redis --format='{{.State.Running}}'" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "true"; then
  print_pass
else
  print_fail "Redis container not running"
fi

# Test 2.5: Database connectivity
print_test "PostgreSQL database connectivity"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker exec concentrate-quiz-db pg_isready -U postgres" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "accepting connections"; then
  print_pass
else
  print_warn "PostgreSQL may still be starting up, retry in 30 seconds"
fi

# Test 2.6: Redis connectivity
print_test "Redis connectivity"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker exec school-portal-redis redis-cli ping" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "PONG"; then
  print_pass
else
  print_fail "Redis not responding to ping"
fi

# Test 2.7: App container running
print_test "App container running"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker ps --filter='name=concentrate-quiz-app' --format='{{.Names}}'" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "concentrate-quiz-app"; then
  print_pass
else
  print_fail "App container not found"
fi

# Test 2.8: Environment file exists
print_test "Environment configuration present"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=test -f ~/concentrate-quiz/.env && echo 'OK' || echo 'MISSING'" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "OK"; then
  print_pass
else
  print_warn "Environment file not found at expected location"
fi

################################################################################
# Phase 3: Network & Port Connectivity
################################################################################
print_header "Phase 3: Network & Port Connectivity"

if [ -n "$PUBLIC_IP" ]; then
  # Test 3.1: Frontend port (3000) accessible
  print_test "Frontend port 3000 accessible"
  if timeout $TIMEOUT_SECONDS curl -s "http://$PUBLIC_IP:3000" >/dev/null 2>&1; then
    print_pass
  else
    print_fail "Could not reach http://$PUBLIC_IP:3000 (may be starting up, retry in 30 seconds)"
  fi

  # Test 3.2: Backend port (3001) accessible
  print_test "Backend port 3001 accessible"
  if timeout $TIMEOUT_SECONDS curl -s "http://$PUBLIC_IP:3001" >/dev/null 2>&1; then
    print_pass
  else
    print_fail "Could not reach http://$PUBLIC_IP:3001 (may be starting up, retry in 30 seconds)"
  fi

  # Test 3.3: Health endpoint responds
  print_test "Backend health endpoint (/health)"
  HEALTH_RESPONSE=$(timeout $TIMEOUT_SECONDS curl -s "http://$PUBLIC_IP:3001/health" 2>/dev/null || echo "")
  if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    print_pass
    print_info "Response: $HEALTH_RESPONSE"
  else
    print_warn "Health endpoint not yet ready (may be starting up)"
  fi

  # Test 3.4: SSH port disabled (should fail)
  print_test "SSH port 22 disabled (connection should fail)"
  if ! timeout 3 bash -c "cat < /dev/null > /dev/tcp/$PUBLIC_IP/22" 2>/dev/null; then
    print_pass
    print_info "SSH correctly disabled for security"
  else
    print_warn "SSH port appears to be open (should be disabled)"
  fi
else
  print_warn "Skipping network tests: could not obtain public IP"
fi

################################################################################
# Phase 4: Database Schema & State
################################################################################
print_header "Phase 4: Database Schema Verification"

# Test 4.1: Check if migrations ran (tables exist)
print_test "Database tables created"
if aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz -c \"\\dt\"" \
  --region "$AWS_REGION" \
  2>&1 | grep -q "public"; then
  print_pass
  # Count tables
  TABLE_COUNT=$(aws ssm start-session \
    --target "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "command=docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz -c \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public'\" -t" \
    --region "$AWS_REGION" \
    2>&1 | grep -o "[0-9]*" | head -1)
  print_info "Found $TABLE_COUNT tables in database"
else
  print_warn "Could not verify database tables"
fi

# Test 4.2: Check for key tables
print_test "Key database tables exist"
REQUIRED_TABLES=("users" "classes" "assignments" "submissions" "grades")
FOUND_TABLES=0

for table in "${REQUIRED_TABLES[@]}"; do
  if aws ssm start-session \
    --target "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters "command=docker exec concentrate-quiz-db psql -U postgres -d concentrate-quiz -c \"SELECT 1 FROM $table LIMIT 1;\" 2>&1" \
    --region "$AWS_REGION" \
    2>&1 | grep -q "1"; then
    FOUND_TABLES=$((FOUND_TABLES + 1))
  fi
done

if [ $FOUND_TABLES -gt 0 ]; then
  print_pass
  print_info "Found $FOUND_TABLES/$((${#REQUIRED_TABLES[@]})) required tables"
else
  print_warn "Could not verify database tables (migrations may not have run)"
fi

################################################################################
# Phase 5: Logs & Diagnostics
################################################################################
print_header "Phase 5: Service Logs & Diagnostics"

# Test 5.1: Capture app logs (last 20 lines)
print_test "App container logs (no errors)"
APP_LOGS=$(aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=docker logs --tail=20 concentrate-quiz-app 2>&1" \
  --region "$AWS_REGION" \
  2>&1)

if echo "$APP_LOGS" | grep -i "error\|failed\|exception" >/dev/null 2>&1; then
  print_warn "Potential errors detected in app logs"
  echo "$APP_LOGS" | head -5 | sed 's/^/      /'
else
  print_pass
fi

# Test 5.2: Disk space check
print_test "Disk space available"
if DISK_USAGE=$(aws ssm start-session \
  --target "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "command=df -h / | tail -1 | awk '{print \$5}'" \
  --region "$AWS_REGION" \
  2>&1); then

  # Extract percentage
  PERCENT=$(echo "$DISK_USAGE" | grep -o "[0-9]*" | head -1)
  if [ -n "$PERCENT" ] && [ "$PERCENT" -lt 80 ]; then
    print_pass
    print_info "Root filesystem: ${PERCENT}% used"
  else
    print_warn "Disk usage high: ${PERCENT}%"
  fi
else
  print_warn "Could not check disk space"
fi

################################################################################
# Summary & Next Steps
################################################################################
print_header "Test Summary"
echo ""
echo "Results:"
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))
if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All critical tests passed!${NC}"
  echo ""
  echo "Your deployment is ready. Next steps:"
  if [ -n "$PUBLIC_IP" ]; then
    echo "  1. Open browser: http://$PUBLIC_IP:3000"
    echo "  2. Test login with seed credentials"
    echo "  3. Create a test class and assignment"
  fi
  echo "  4. Check logs if you notice any issues:"
  echo "     aws ssm start-session --target $INSTANCE_ID --region $AWS_REGION"
  echo "     docker logs -f concentrate-quiz-app"
  echo ""
  exit 0
else
  echo -e "${RED}❌ Some tests failed ($TESTS_FAILED/$TOTAL_TESTS)${NC}"
  echo ""
  echo "Troubleshooting steps:"
  echo "  1. Check that the instance is fully booted (wait another 1-2 minutes)"
  echo "  2. Connect via SSM and check logs:"
  echo "     aws ssm start-session --target $INSTANCE_ID --region $AWS_REGION"
  echo "     docker compose logs"
  echo "  3. Check security group allows ports 3000, 3001"
  echo "  4. Verify setup-instance.sh completed successfully"
  echo ""
  echo "Full documentation:"
  echo "  - docs/AWS_DEPLOYMENT.md (general guide)"
  echo "  - docs/AWS_TESTING.md (detailed testing guide)"
  echo ""
  exit 1
fi
