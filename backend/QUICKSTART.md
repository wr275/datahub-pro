# DataHub Pro Backend - Quick Start Guide

## Installation & Setup

### 1. Prerequisites
- Python 3.10+
- PostgreSQL 12+
- Stripe account (test keys)
- pip

### 2. Clone and Install
```bash
cd datahub-saas/backend
cp .env.example .env
```

### 3. Configure Environment
Edit `.env` with your values:
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/datahub_pro

# Generate a strong secret key (64 chars)
SECRET_KEY=your-random-64-character-secret-key-here

# Stripe (get from https://dashboard.stripe.com/test/keys)
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
STRIPE_STARTER_PRICE_ID=price_starter
STRIPE_GROWTH_PRICE_ID=price_growth
STRIPE_ENTERPRISE_PRICE_ID=price_enterprise

# Frontend
FRONTEND_URL=http://localhost:3000
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

### 5. Create PostgreSQL Database
```bash
createdb datahub_pro
# or via psql
psql -U postgres -c "CREATE DATABASE datahub_pro;"
```

### 6. Run Server
```bash
# Development (with auto-reload)
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 7. Access API
- API: http://localhost:8000
- Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health: http://localhost:8000/health

## API Usage Examples

### Register New User
```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123",
    "full_name": "John Doe",
    "organisation_name": "Acme Corp"
  }'
```

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
# Returns: { "access_token": "...", "refresh_token": "...", "user": {...} }
```

### Upload Excel File
```bash
curl -X POST http://localhost:8000/api/files/upload \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "file=@data.xlsx"
```

### List Files
```bash
curl -X GET http://localhost:8000/api/files/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get File Analytics
```bash
curl -X POST http://localhost:8000/api/analytics/summary/FILE_ID \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Get Billing Plans
```bash
curl http://localhost:8000/api/billing/plans
```

### Create Stripe Checkout
```bash
curl -X POST http://localhost:8000/api/billing/create-checkout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plan_id": "growth"}'
# Returns: { "checkout_url": "https://checkout.stripe.com/..." }
```

## Database Initialization

Tables are automatically created on server startup via SQLAlchemy. The `lifespan` context manager in `main.py` handles this.

To manually create tables:
```python
from database import engine, Base
Base.metadata.create_all(bind=engine)
```

## File Upload Limits

Based on subscription tier:
- **Starter**: 10 uploads/month, 50MB max per file
- **Growth**: Unlimited uploads, 50MB max per file
- **Enterprise**: Unlimited uploads, 50MB max per file

## Authentication

All protected endpoints require Bearer token:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Token expires in 24 hours (configurable via `ACCESS_TOKEN_EXPIRE_MINUTES` in config.py).

## Roles & Permissions

| Role | Can Do |
|------|--------|
| **Owner** | Everything - create org, invite users, manage billing, view audit logs |
| **Admin** | Manage team, invite users, view audit logs (not billing) |
| **Member** | Upload files, view analytics, view team |

## File Formats Supported

- .xlsx (Excel 2007+)
- .xls (Excel 97-2003)
- .csv (Comma-separated values)

## Analytics Features

### Summary Endpoint
Returns per-column statistics:
- **Numeric columns**: sum, mean, min, max, count
- **Text columns**: unique count, top 10 values, total count

### KPI Endpoint
Extracts key metrics from all numeric columns:
- Sum, mean, min, max of each numeric field
- Count of values

## Stripe Integration

### Test Cards
- Success: 4242 4242 4242 4242
- Decline: 4000 0000 0000 0002
- Require auth: 4000 0025 0000 3155

Use any future expiry date and any CVC.

### Webhook Events Handled
- `checkout.session.completed` - Activate subscription
- `customer.subscription.deleted` - Cancel subscription
- `customer.subscription.updated` - Update subscription status

## Deployment Checklist

- [ ] Set strong `SECRET_KEY`
- [ ] Update `FRONTEND_URL` to production domain
- [ ] Update CORS `allow_origins` to production domain
- [ ] Use production Stripe keys
- [ ] Configure PostgreSQL with backup
- [ ] Set up HTTPS/SSL certificate
- [ ] Configure environment variables securely
- [ ] Set up log aggregation
- [ ] Test file uploads and analytics
- [ ] Test Stripe webhook delivery
- [ ] Set up monitoring/alerting
- [ ] Configure database backups
- [ ] Use production-grade database credentials

## Troubleshooting

**"Database connection refused"**
- Check PostgreSQL is running
- Verify DATABASE_URL is correct
- Ensure database exists

**"Invalid Stripe key"**
- Check STRIPE_SECRET_KEY is correct
- Ensure it's not the publishable key
- Verify it's from the correct environment (test/live)

**"File upload fails"**
- Check LOCAL_UPLOAD_DIR exists or is writable
- Verify file size < 50MB
- Ensure file extension is .xlsx, .xls, or .csv

**"Token expired"**
- Implement refresh token rotation in frontend
- Tokens expire after 24 hours by default

## Monitoring

Recommended metrics to track:
- Auth endpoint response times
- File upload success rate
- Analytics query response times
- Database connection pool utilization
- Stripe webhook delivery latency
- Error rates by endpoint
- Concurrent user count

## Support

API documentation available at `/docs` endpoint when running.
