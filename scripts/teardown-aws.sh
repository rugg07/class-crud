#!/bin/bash

################################################################################
# AWS EC2 Teardown Script
#
# Terminates an EC2 instance and optionally cleans up related resources
# (security group, etc.)
#
# Usage:
#   ./scripts/teardown-aws.sh <instance-id> [region] [--delete-sg]
#
# Examples:
#   ./scripts/teardown-aws.sh i-1234567890abcdef0                # Terminate instance
#   ./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1      # With region
#   ./scripts/teardown-aws.sh i-1234567890abcdef0 us-east-1 --delete-sg
#
################################################################################

set -e

# Configuration
INSTANCE_ID="${1}"
REGION="${2:-us-east-1}"
DELETE_SG="${3}"

# Validation
if [ -z "$INSTANCE_ID" ]; then
  echo "Usage: $0 <instance-id> [region] [--delete-sg]"
  echo ""
  echo "Examples:"
  echo "  $0 i-1234567890abcdef0"
  echo "  $0 i-1234567890abcdef0 us-east-1"
  echo "  $0 i-1234567890abcdef0 us-east-1 --delete-sg"
  exit 1
fi

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== AWS EC2 Teardown ===${NC}"
echo ""

# Check if instance exists
echo "Checking instance: $INSTANCE_ID"
INSTANCE_STATE=$(aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].State.Name' \
  --output text 2>/dev/null || echo "")

if [ -z "$INSTANCE_STATE" ] || [ "$INSTANCE_STATE" = "None" ]; then
  echo -e "${RED}ERROR: Instance not found: $INSTANCE_ID${NC}"
  exit 1
fi

echo "Instance state: $INSTANCE_STATE"
echo ""

# Get instance details before termination
echo -e "${YELLOW}=== Instance Details ===${NC}"
aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].[InstanceId,InstanceType,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' \
  --output table

echo ""

# Confirmation
read -p "Are you sure you want to terminate this instance? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
  echo "Teardown cancelled."
  exit 0
fi

# Get security group ID before terminating instance
SG_ID=$(aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")

# Terminate instance
echo -e "${YELLOW}Terminating instance: $INSTANCE_ID${NC}"
aws ec2 terminate-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --output table

# Wait for instance to be terminated
echo -e "${YELLOW}Waiting for instance to terminate...${NC}"
MAX_ATTEMPTS=60
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATE=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text 2>/dev/null)

  if [ "$STATE" = "terminated" ]; then
    echo "Instance terminated!"
    break
  fi

  echo "State: $STATE (${ATTEMPT}/${MAX_ATTEMPTS})"
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""

# Optionally delete security group
if [ "$DELETE_SG" = "--delete-sg" ] && [ -n "$SG_ID" ] && [ "$SG_ID" != "None" ]; then
  echo -e "${YELLOW}Deleting security group: $SG_ID${NC}"

  # Wait a bit for the instance to fully terminate
  sleep 10

  # Revoke all rules first
  echo "Revoking security group rules..."

  # Get and revoke ingress rules
  INGRESS_RULES=$(aws ec2 describe-security-group-rules \
    --region "$REGION" \
    --filters "Name=group-id,Values=${SG_ID}" \
           "Name=is-egress,Values=false" \
    --query 'SecurityGroupRules[*].GroupOwnerId' \
    --output text)

  if [ -n "$INGRESS_RULES" ]; then
    aws ec2 revoke-security-group-ingress \
      --region "$REGION" \
      --group-id "$SG_ID" \
      --ip-permissions "IpProtocol=-1,IpRanges=[{CidrIp=0.0.0.0/0}]" \
      2>/dev/null || true
  fi

  # Delete the security group
  aws ec2 delete-security-group \
    --region "$REGION" \
    --group-id "$SG_ID" \
    2>/dev/null || echo "Could not delete security group (may be in use or have dependencies)"
fi

echo ""
echo -e "${GREEN}=== Teardown Complete ===${NC}"
echo ""
echo "Instance ID:        $INSTANCE_ID"
echo "Region:             $REGION"
if [ "$DELETE_SG" = "--delete-sg" ]; then
  echo "Security Group:     $SG_ID (deleted)"
else
  echo "Security Group:     $SG_ID (not deleted, use --delete-sg to remove)"
fi
echo ""
