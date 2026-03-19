# DataHub Pro — Deployment Guide

## Local Development (Start Here)

### Prerequisites
- Docker Desktop installed
- Node.js 20+ installed
- Python 3.12+ installed

### Quick Start (Development)
```bash
# 1. Clone the project
cd datahub-saas

# 2. Copy environment variables
cp docker/.env.production docker/.env
# Edit .env and fill in your values (Stripe keys, etc.)

# 3. Start database
docker-compose -f docker/docker-compose.yml up -d db

# 4. Start backend
cd backend
pip install -r requirements.txt
cp .env.example .env  # edit with your values
uvicorn main:app --reload

# 5. Start frontend (new terminal)
cd frontend
npm install
npm run dev

# Frontend: http://localhost:3000
# API docs: http://localhost:8000/docs
```

## Production Deployment (AWS)

### Option A: Cheapest (Single Server ~£30/month)
Best for: 0–100 customers

1. Create an AWS EC2 t3.small instance (Ubuntu 22.04)
2. Install Docker: `curl -fsSL https://get.docker.com | sh`
3. Copy your project files to the server
4. Set up your domain DNS to point to the server IP
5. Get SSL certificate: `certbot certonly --standalone -d datahubpro.io`
6. Run: `./docker/deploy.sh prod`

### Option B: Scalable (~£150/month)
Best for: 100–1000 customers

Use these AWS managed services:
- **RDS PostgreSQL** (db.t3.micro) — managed database with backups
- **ECS Fargate** — serverless containers, auto-scales
- **S3** — file storage instead of local disk
- **CloudFront** — CDN for the frontend
- **ALB** — load balancer with SSL termination

### Setting Up Stripe

1. Create account at stripe.com
2. Go to Products → Create 3 products (Starter, Growth, Enterprise)
3. For each product, create a monthly price
4. Copy the price IDs (price_xxx) to your .env file
5. Go to Webhooks → Add endpoint: https://datahubpro.io/api/billing/webhook
6. Add these events: checkout.session.completed, customer.subscription.deleted, customer.subscription.updated
7. Copy the webhook secret to STRIPE_WEBHOOK_SECRET in .env

### Domain & SSL

1. Buy domain at Cloudflare (best value, includes free SSL)
2. Point A record to your server IP
3. If using EC2 directly: `sudo certbot --nginx -d datahubpro.io`
4. Certificates auto-renew every 90 days

### Environment Variables Checklist
- [ ] DB_PASSWORD — strong random password
- [ ] SECRET_KEY — 64 char random string (`openssl rand -hex 32`)
- [ ] STRIPE_SECRET_KEY — from Stripe dashboard
- [ ] STRIPE_WEBHOOK_SECRET — from Stripe webhook settings
- [ ] All 3 STRIPE_PRICE_IDs — from your Stripe products
- [ ] FRONTEND_URL — your production domain

### Monitoring & Backups
- Set up PostgreSQL daily backups: `pg_dump datahub_pro > backup_$(date +%Y%m%d).sql`
- Use AWS CloudWatch or Datadog for uptime monitoring
- Set up Stripe email notifications for failed payments
