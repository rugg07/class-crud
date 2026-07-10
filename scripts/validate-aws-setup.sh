#!/bin/bash

################################################################################
# AWS Deployment Prerequisites Validator
#
# Checks that your local machine has everything needed to deploy to AWS
#
# Usage:
#   ./scripts/validate-aws-setup.sh
#
################################################################################

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

CHECKS_PASSED=0
CHECKS_FAILED=0

echo -e "${BLUE}=== AWS Deployment Prerequisites Check ===${NC}"
echo ""

# Check 1: AWS CLI installed
echo -n "✓ Checking AWS CLI... "
if command -v aws &> /dev/null; then
  VERSION=$(aws --version | cut -d' ' -f1)
  echo -e "${GREEN}OK${NC} ($VERSION)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${RED}FAILED${NC}"
  echo "  Install AWS CLI: https://aws.amazon.com/cli/"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 2: AWS credentials configured
echo -n "✓ Checking AWS credentials... "
if aws sts get-caller-identity &> /dev/null; then
  ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
  USER=$(aws sts get-caller-identity --query Arn --output text)
  echo -e "${GREEN}OK${NC}"
  echo "  Account: $ACCOUNT"
  echo "  User: $USER"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${RED}FAILED${NC}"
  echo "  Configure AWS credentials: aws configure"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 3: Default region is us-east-1
echo -n "✓ Checking AWS region... "
REGION=$(aws configure get region || echo "us-east-1")
if [ "$REGION" = "us-east-1" ] || [ -z "$REGION" ]; then
  echo -e "${GREEN}OK${NC} ($REGION or default us-east-1)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${YELLOW}WARNING${NC} (Region: $REGION, should be us-east-1)"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 4: IAM role exists
echo -n "✓ Checking IAM role sandbox-ssm-instance... "
if aws iam get-role --role-name sandbox-ssm-instance &> /dev/null; then
  echo -e "${GREEN}OK${NC}"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${RED}FAILED${NC}"
  echo "  The IAM role 'sandbox-ssm-instance' must be created by an admin"
  echo "  This role should have: AmazonSSMManagedInstanceCore policy"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 5: Bash installed
echo -n "✓ Checking Bash... "
if command -v bash &> /dev/null; then
  VERSION=$(bash --version | head -1 | cut -d' ' -f4)
  echo -e "${GREEN}OK${NC} (v$VERSION)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${RED}FAILED${NC}"
  echo "  Bash is required. Install it or use sh instead."
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 6: Git installed (optional but recommended)
echo -n "✓ Checking Git... "
if command -v git &> /dev/null; then
  VERSION=$(git --version | cut -d' ' -f3)
  echo -e "${GREEN}OK${NC} (v$VERSION)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${YELLOW}WARNING${NC} (recommended but optional)"
fi

# Check 7: jq installed (optional, for parsing AWS JSON)
echo -n "✓ Checking jq... "
if command -v jq &> /dev/null; then
  VERSION=$(jq --version | cut -d'-' -f2)
  echo -e "${GREEN}OK${NC} (v$VERSION)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${YELLOW}OPTIONAL${NC} (not required, but helpful)"
fi

# Check 8: Deployment scripts exist
echo -n "✓ Checking deployment scripts... "
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/deploy-aws.sh" ] && \
   [ -f "$SCRIPT_DIR/setup-instance.sh" ] && \
   [ -f "$SCRIPT_DIR/teardown-aws.sh" ]; then
  echo -e "${GREEN}OK${NC}"
  echo "  Found:"
  echo "    - deploy-aws.sh"
  echo "    - setup-instance.sh"
  echo "    - teardown-aws.sh"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${RED}FAILED${NC}"
  echo "  Missing deployment scripts in $SCRIPT_DIR"
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
fi

# Check 9: Documentation exists
echo -n "✓ Checking documentation... "
DOC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../docs" && pwd)"
if [ -f "$DOC_DIR/AWS_DEPLOYMENT.md" ] && [ -f "$DOC_DIR/DEPLOYMENT_QUICKREF.md" ]; then
  echo -e "${GREEN}OK${NC}"
  echo "  Found:"
  echo "    - docs/AWS_DEPLOYMENT.md"
  echo "    - docs/DEPLOYMENT_QUICKREF.md"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${YELLOW}WARNING${NC} (documentation missing)"
fi

# Check 10: Dockerfile.production exists
echo -n "✓ Checking Dockerfile.production... "
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ -f "$PROJECT_ROOT/Dockerfile.production" ]; then
  SIZE=$(wc -l < "$PROJECT_ROOT/Dockerfile.production")
  echo -e "${GREEN}OK${NC} ($SIZE lines)"
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
else
  echo -e "${YELLOW}WARNING${NC} (Dockerfile.production missing)"
fi

# Summary
echo ""
echo "=================================="
if [ $CHECKS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All checks passed!${NC}"
else
  echo -e "${RED}❌ Some checks failed${NC}"
fi
echo "=================================="
echo ""
echo "Summary:"
echo -e "  Passed:  ${GREEN}$CHECKS_PASSED${NC}"
echo -e "  Failed:  ${RED}$CHECKS_FAILED${NC}"
echo ""

if [ $CHECKS_FAILED -gt 0 ]; then
  echo "Next steps:"
  echo "  1. Fix the failed checks above"
  echo "  2. Run this script again to verify"
  echo "  3. Then run: ./scripts/deploy-aws.sh"
  exit 1
else
  echo "You're ready to deploy!"
  echo ""
  echo "Next step:"
  echo "  ./scripts/deploy-aws.sh"
  exit 0
fi
