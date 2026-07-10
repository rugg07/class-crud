# Deployment Guide — School Portal

Complete guide to wiring Google OAuth, containerizing the app, setting up CI/CD, and deploying to AWS.

---

## 🔑 Part 1: Google OAuth Setup

### **Google Cloud Console Configuration** (One-time setup)

1. **Create a Google Cloud Project:**
   - Go to https://console.cloud.google.com
   - Click "Select a Project" → "New Project"
   - Name it (e.g., "School Portal")
   - Click "Create"

2. **Enable Google+ API:**
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API"
   - Click on it, then "Enable"

3. **Create OAuth 2.0 Credentials:**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Select application type: **"Web application"**
   - Name: "School Portal Web"

4. **Configure Redirect URIs:**
   Add these **Authorized redirect URIs:**
   ```
   http://localhost:3001/auth/google/callback
   https://yourdomain.com/auth/google/callback    (for production)
   ```
   - Click "Create"

5. **Download Credentials:**
   - You'll see your **Client ID** and **Client Secret**
   - Download the JSON file (keep it safe)
   - Copy both values to your `.env.local`

### **Frontend Configuration**

Add to `.env.local`:
```bash
GOOGLE_CLIENT_ID=your-client-id-from-google-console
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### **Wire OAuth Button in Login Page**

Edit `src/app/login/page.tsx` and add this after the email/password button:

```tsx
const handleGoogleLogin = async () => {
  setLoading(true);
  try {
    const authUrl = await apiClient.googleAuthorize();
    // Redirect to Google's consent screen
    window.location.href = authUrl;
  } catch (err) {
    toast({
      title: 'Error',
      description: 'Failed to start Google login',
      variant: 'destructive',
    });
    setLoading(false);
  }
};

// Add this in the form, after the email/password submit button:
<Button 
  type="button" 
  variant="outline" 
  className="w-full mt-4"
  onClick={handleGoogleLogin}
  disabled={loading}
>
  Sign in with Google
</Button>
```

### **Test Google OAuth Locally**

1. Start the app: `npm run dev`
2. Create a test user with your email: 
   ```sql
   INSERT INTO users (email, name, role, status)
   VALUES ('your-email@gmail.com', 'Test User', 'student', 'active');
   ```
3. Click "Sign in with Google" on login page
4. Consent to permissions
5. Should redirect back to dashboard with session cookie

**Note:** OAuth requires users to pre-exist in the database (no auto-signup). If you want to enable auto-signup, modify `src/server/auth/auth.service.ts` line 57.

---

## 🐳 Part 2: Docker & GitHub Actions

### **Build Docker Image Locally**

```bash
# Build the image
docker build -t school-portal:latest .

# Run the container (with docker-compose services)
docker compose up -d  # Start postgres + redis

docker run -p 3000:3000 -p 3001:3001 \
  --network concentrate-hiring-quiz_default \
  -e NODE_ENV=production \
  -e DB_HOST=postgres \
  -e DB_PORT=5432 \
  -e DB_USER=postgres \
  -e DB_PASSWORD=postgres \
  -e DB_NAME=concentrate-quiz \
  -e REDIS_URL=redis://redis:6379 \
  -e JWT_SECRET=your-secret-key-at-least-32-chars \
  school-portal:latest
```

**Verify it works:**
```bash
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### **GitHub Actions CI/CD**

The workflow at `.github/workflows/ci.yml` automatically:
- Lints code (ESLint)
- Type-checks (TypeScript)
- Runs backend tests
- Builds Next.js
- Builds Docker image

**Trigger:** Push to `main` or create a PR

**To enable:**
1. Push code to GitHub: `git push origin main`
2. Go to your repo's "Actions" tab
3. Workflow runs automatically
4. All checks must pass before merging

---

## ☁️ Part 3: AWS Deployment

### **Prerequisites**

- AWS CLI installed: `aws --version`
- AWS credentials configured: `aws sts get-caller-identity` (should work)
- Scripts in `/scripts/` directory

### **Step 1: Launch EC2 Instance**

```bash
# From your local machine
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh

# Example output:
# Instance ID: i-0abc123def456
# Waiting for instance to be running...
# ✅ Instance running at: ec2-xx-xxx-xxx-xx.compute-1.amazonaws.com
```

Keep the instance ID — you'll need it next.

### **Step 2: Setup Instance**

Connect via AWS Systems Manager Session Manager:
```bash
aws ssm start-session --target <instance-id>
```

Or use EC2 Instance Connect:
1. Go to EC2 dashboard
2. Find your instance
3. Click "Connect" > "EC2 Instance Connect"
4. Click "Connect"

Once connected (bash shell), run the setup script:

```bash
# On the instance shell, clone the repo:
git clone https://github.com/yourusername/school-portal.git
cd school-portal

# Copy the setup script
cp scripts/setup-instance.sh /tmp/setup-instance.sh
chmod +x /tmp/setup-instance.sh

# Run setup
/tmp/setup-instance.sh
```

**The script will:**
- Install Docker + Docker Compose
- Create docker-compose.yml for Postgres + Redis
- Prompt for environment variables (.env file)
- Run migrations
- Start the app: `docker compose up -d`

### **Step 3: Configure Production Environment**

When prompted by the setup script, provide:
```bash
NODE_ENV=production
DB_HOST=postgres
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<generate-a-strong-password>
DB_NAME=concentrate-quiz
REDIS_URL=redis://redis:6379
JWT_SECRET=<generate-a-strong-random-32-char-key>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
```

### **Step 4: Verify Deployment**

On the instance:
```bash
# Check containers running
docker compose ps

# View logs
docker compose logs -f

# Test API
curl http://localhost:3001/health
curl http://localhost:3000/health
```

### **Step 5: Access via Web**

Get the instance's public IP:
```bash
aws ec2 describe-instances \
  --instance-ids <instance-id> \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

Visit: `http://<public-ip>:3000`

### **Step 6: Cleanup**

When done, terminate the instance:
```bash
chmod +x scripts/teardown-aws.sh
./scripts/teardown-aws.sh <instance-id>
```

---

## 🔒 Production Checklist

Before going live:

- [ ] Set `NODE_ENV=production`
- [ ] Use strong random JWT_SECRET (32+ chars)
- [ ] Use strong random DB_PASSWORD
- [ ] Configure HTTPS/SSL with Certbot (optional, provided in setup script)
- [ ] Update GOOGLE_REDIRECT_URI to your production domain
- [ ] Set up DNS (Route53 or external registrar)
- [ ] Run database backups regularly
- [ ] Monitor logs and health checks
- [ ] Set up CloudWatch alarms (optional)

---

## 🐛 Troubleshooting

### **App won't start in Docker**
```bash
# Check logs
docker compose logs app

# Verify .env file
docker compose exec app cat .env | grep DB_

# Verify database is running
docker compose ps
```

### **Cannot connect to database**
- Ensure postgres container is running: `docker compose up -d postgres`
- Verify DB_HOST matches service name in docker-compose.yml
- Check network: containers must be on same network

### **GitHub Actions workflow failing**
- Check the Actions tab in GitHub
- Look at the failing job (Lint, Type-check, Build, Test, Docker)
- Common fixes:
  - Lint: `npm run lint -- --fix`
  - Type-check: `npm run type-check`
  - Tests: `npm run test` (may need DB)

### **AWS deployment fails**
- Check SSM session logs: `aws ssm start-session --target <id> --document-name AWS-StartInteractiveCommand`
- Verify instance has internet access (security group)
- Check if instance type is allowed (must be t3 or t4g)
- Verify IAM role: `sandbox-ssm-instance`

---

## 📚 Resources

- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions](https://docs.github.com/en/actions)
- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Certbot SSL](https://certbot.eff.org/)

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start frontend + backend locally |
| `docker build -t school-portal .` | Build Docker image |
| `docker compose up -d` | Start Postgres + Redis |
| `./scripts/deploy-aws.sh` | Launch EC2 instance |
| `./scripts/teardown-aws.sh <id>` | Terminate EC2 instance |
| `aws ssm start-session --target <id>` | Connect to instance |

---

**Last Updated:** July 10, 2026  
**Status:** Production-ready

