#!/bin/bash

################################################################################
# AWS EC2 Deployment Script
#
# Launches a t3.small EC2 instance in us-east-1 with the following:
# - Ubuntu 22.04 LTS
# - IAM role: sandbox-ssm-instance (pre-configured)
# - Security group with inbound rules for app (ports 80, 443, 3000, 3001)
# - No SSH (port 22 disabled)
# - Connect via: AWS Systems Manager Session Manager or EC2 Instance Connect
#
# Usage:
#   ./scripts/deploy-aws.sh [instance-type] [region]
#
# Examples:
#   ./scripts/deploy-aws.sh                    # Defaults to t3.small, us-east-1
#   ./scripts/deploy-aws.sh t3.micro us-east-1
#
################################################################################

set -e

# Configuration
INSTANCE_TYPE="${1:-t3.small}"
REGION="${2:-us-east-1}"
APP_NAME="concentrate-quiz"
INSTANCE_NAME="${APP_NAME}-deployment"
KEY_NAME="${APP_NAME}-key"

# AMI lookup: Ubuntu 22.04 LTS in specified region
# Using aws ec2 describe-images to find the latest AMI
echo "=== Fetching latest Ubuntu 22.04 LTS AMI for ${REGION} ==="
AMI_ID=$(aws ec2 describe-images \
  --region "$REGION" \
  --owners 099720109477 \
  --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
            "Name=state,Values=available" \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
  --output text)

if [ -z "$AMI_ID" ] || [ "$AMI_ID" = "None" ]; then
  echo "ERROR: Could not find Ubuntu 22.04 LTS AMI in ${REGION}"
  exit 1
fi

echo "Using AMI: $AMI_ID"

# Create security group (or reuse if exists)
echo "=== Setting up security group ==="
SG_NAME="${APP_NAME}-sg"
SG_ID=$(aws ec2 describe-security-groups \
  --region "$REGION" \
  --filters "Name=group-name,Values=${SG_NAME}" \
  --query 'SecurityGroups[0].GroupId' \
  --output text 2>/dev/null || echo "")

if [ -z "$SG_ID" ] || [ "$SG_ID" = "None" ]; then
  echo "Creating new security group: $SG_NAME"
  SG_ID=$(aws ec2 create-security-group \
    --region "$REGION" \
    --group-name "$SG_NAME" \
    --description "Security group for ${APP_NAME} deployment" \
    --query 'GroupId' \
    --output text)
  echo "Created security group: $SG_ID"

  # Add inbound rules
  # Port 80 (HTTP)
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || true

  # Port 443 (HTTPS)
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || true

  # Port 3000 (Next.js frontend)
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 3000 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || true

  # Port 3001 (Fastify backend)
  aws ec2 authorize-security-group-ingress \
    --region "$REGION" \
    --group-id "$SG_ID" \
    --protocol tcp \
    --port 3001 \
    --cidr 0.0.0.0/0 \
    2>/dev/null || true

  echo "Configured inbound rules (HTTP, HTTPS, 3000, 3001)"
else
  echo "Reusing existing security group: $SG_ID"
fi

# Launch EC2 instance
echo "=== Launching EC2 instance ==="
INSTANCE_ID=$(aws ec2 run-instances \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --iam-instance-profile "Name=sandbox-ssm-instance" \
  --security-group-ids "$SG_ID" \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${INSTANCE_NAME}},{Key=App,Value=${APP_NAME}}]" \
  --query 'Instances[0].InstanceId' \
  --output text)

if [ -z "$INSTANCE_ID" ] || [ "$INSTANCE_ID" = "None" ]; then
  echo "ERROR: Failed to launch EC2 instance"
  exit 1
fi

echo "Instance launched: $INSTANCE_ID"

# Wait for instance to be running
echo "=== Waiting for instance to reach running state ==="
MAX_ATTEMPTS=60
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
  STATE=$(aws ec2 describe-instances \
    --region "$REGION" \
    --instance-ids "$INSTANCE_ID" \
    --query 'Reservations[0].Instances[0].State.Name' \
    --output text)

  if [ "$STATE" = "running" ]; then
    echo "Instance is running!"
    break
  fi

  echo "State: $STATE (${ATTEMPT}/${MAX_ATTEMPTS})"
  sleep 2
  ATTEMPT=$((ATTEMPT + 1))
done

if [ "$STATE" != "running" ]; then
  echo "ERROR: Instance failed to reach running state (state: $STATE)"
  exit 1
fi

# Get instance details
echo "=== Instance Details ==="
aws ec2 describe-instances \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].[InstanceId,PublicIpAddress,PrivateIpAddress,InstanceType,State.Name]' \
  --output table

# Wait for instance to be ready for SSM
echo ""
echo "=== Waiting for SSM connectivity ==="
MAX_SSM_ATTEMPTS=60
SSM_ATTEMPT=0
while [ $SSM_ATTEMPT -lt $MAX_SSM_ATTEMPTS ]; do
  PING_STATUS=$(aws ssm describe-instance-information \
    --region "$REGION" \
    --filters "Key=InstanceIds,Values=${INSTANCE_ID}" \
    --query 'InstanceInformationList[0].PingStatus' \
    --output text 2>/dev/null || echo "NoResponse")

  if [ "$PING_STATUS" = "Online" ]; then
    echo "Instance is online in SSM!"
    break
  fi

  echo "SSM Status: $PING_STATUS (${SSM_ATTEMPT}/${MAX_SSM_ATTEMPTS})"
  sleep 2
  SSM_ATTEMPT=$((SSM_ATTEMPT + 1))
done

if [ "$PING_STATUS" != "Online" ]; then
  echo "WARNING: Instance may not be ready for SSM yet (Status: $PING_STATUS)"
  echo "Wait a moment and try: aws ssm start-session --target $INSTANCE_ID"
fi

# Output summary
echo ""
echo "=================================="
echo "✅ EC2 Instance Deployed Successfully!"
echo "=================================="
echo ""
echo "Instance ID:        $INSTANCE_ID"
echo "Instance Type:      $INSTANCE_TYPE"
echo "Region:             $REGION"
echo "Security Group:     $SG_ID"
echo ""
echo "Next steps:"
echo "1. Connect to the instance:"
echo "   aws ssm start-session --target $INSTANCE_ID --region $REGION"
echo ""
echo "2. Run the setup script (copy setup-instance.sh to instance first):"
echo "   ./setup-instance.sh"
echo ""
echo "3. To teardown:"
echo "   ./scripts/teardown-aws.sh $INSTANCE_ID $REGION"
echo ""
