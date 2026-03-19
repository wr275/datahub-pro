# DataHub Pro — GitHub + Railway Deployment Guide

## What Was Fixed Before Deployment

| Fix | File | Change |
|-----|------|--------|
| 1 | `backend/main.py` | CORS reads `FRONTEND_URL` from env, supports comma-separated origins |
| 2 | `backend/database.py` | Converts `postgres://` → `postgresql://` (Railway quirk) |
| 3 | `frontend/railway.json` | `startCommand` now does `npm run build && npx serve -s dist -l $PORT` |
| 4 | `frontend/package.json` | Added `serve` dependency + `start` script |
| 5 | `.gitignore` | Root, backend, and frontend ignore files added |
| 6 | `backend/nixpacks.toml` | Pins Python 3.11 for Railway build |
| 7 | `backend/requirements.txt` | Added `psycopg2-binary` for PostgreSQL driver |

---

## Step 1 — Push to GitHub

```bash
# From inside the datahub-saas/ folder
cd datahub-saas

git init
git add .
git commit -m "Initial commit: DataHub Pro SaaS"

# Create a new repo on github.com (name it: datahub-pro)
# Then push:
git remote add origin https://github.com/YOUR_USERNAME/datahub-pro.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Create Railway Project

1. Go to **railway.app** → New Project → **Deploy from GitHub repo**
2. Select your `datahub-pro` repo
3. Railway will detect multiple services — **do NOT auto-deploy yet**

---

## Step 3 — Add PostgreSQL

1. In your Railway project, click **+ New** → **Database** → **Add PostgreSQL**
2. Railway creates a Postgres instance and a `DATABASE_URL` variable automatically
3. Note: Railway provides `postgres://...` — our fix in `database.py` handles the conversion

---

## Step 4 — Deploy Backend

1. In Railway project → **+ New** → **GitHub Repo** → select your repo
2. Set **Root Directory** to: `backend`
3. Railway will use `nixpacks.toml` to build with Python 3.11
4. Add these **environment variables** in the backend service settings:

```
DATABASE_URL        → (copy from PostgreSQL service — Railway auto-links this)
SECRET_KEY          → (generate: python -c "import secrets; print(secrets.token_hex(32))")
STRIPE_SECRET_KEY   → sk_test_... (from Stripe dashboard)
STRIPE_WEBHOOK_SECRET → whsec_... (from Stripe dashboard)
STRIPE_STARTER_PRICE_ID  → price_...
STRIPE_GROWTH_PRICE_ID   → price_...
STRIPE_ENTERPRISE_PRICE_ID → price_...
STORAGE_TYPE        → local
LOCAL_UPLOAD_DIR    → ./uploads
FRONTEND_URL        → (fill in after frontend deploys — you'll update this)
SENDGRID_API_KEY    → SG.... (from SendGrid, or leave blank to skip email)
```

5. Deploy. Once live, copy the backend URL (e.g. `https://datahub-backend.up.railway.app`)

---

## Step 5 — Deploy Frontend

1. In Railway project → **+ New** → **GitHub Repo** → same repo
2. Set **Root Directory** to: `frontend`
3. Add these **environment variables**:

```
VITE_API_URL → https://datahub-backend.up.railway.app
```

4. Deploy. Once live, copy the frontend URL (e.g. `https://datahub-frontend.up.railway.app`)

---

## Step 6 — Wire Them Together

1. Go back to the **backend service** → Variables
2. Update `FRONTEND_URL` to your actual frontend URL:
   ```
   FRONTEND_URL → https://datahub-frontend.up.railway.app
   ```
3. Redeploy the backend (Railway will do this automatically when you save the variable)

---

## Step 7 — Set Up Stripe Webhook

1. Go to **Stripe Dashboard** → Developers → Webhooks → **Add endpoint**
2. Endpoint URL: `https://datahub-backend.up.railway.app/api/billing/webhook`
3. Events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the **Signing Secret** → paste it as `STRIPE_WEBHOOK_SECRET` in Railway backend vars
5. Redeploy backend

---

## Step 8 — Verify Everything Works

Hit these endpoints to confirm:

```bash
# Backend health
curl https://datahub-backend.up.railway.app/health
# Expected: {"status":"healthy","service":"DataHub Pro API"}

# API docs (Swagger)
open https://datahub-backend.up.railway.app/docs

# Frontend
open https://datahub-frontend.up.railway.app
```

Then:
- Register a new account → should create org + user
- Upload a CSV/XLSX file → should parse and store it
- Visit the Analytics tab → summary should populate

---

## Environment Variables Reference

### Backend (required for production)
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Postgres connection string (auto-set by Railway) |
| `SECRET_KEY` | 64-char random string for JWT signing |
| `FRONTEND_URL` | Frontend URL for CORS (update after frontend deploys) |
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_... in production) |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_STARTER_PRICE_ID` | Stripe Price ID for Starter plan |
| `STRIPE_GROWTH_PRICE_ID` | Stripe Price ID for Growth plan |
| `STRIPE_ENTERPRISE_PRICE_ID` | Stripe Price ID for Enterprise plan |
| `STORAGE_TYPE` | `local` (default) or `s3` |
| `LOCAL_UPLOAD_DIR` | `./uploads` |
| `SENDGRID_API_KEY` | Optional — for email invites |

### Frontend (required for production)
| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend URL — must be set before `npm run build` |

---

## Common Issues

**CORS errors in browser console**
→ Check `FRONTEND_URL` in backend env vars matches your frontend domain exactly (no trailing slash)

**500 error on first request**
→ Railway may not have run DB migrations. Check backend logs — if `relation does not exist`, the DB tables weren't created. The lifespan event in `main.py` should auto-create them on startup.

**Frontend shows blank page**
→ Usually means `VITE_API_URL` is wrong. Check the browser console for 404/network errors.

**Stripe webhooks failing**
→ Make sure `STRIPE_WEBHOOK_SECRET` is the signing secret from the **webhook endpoint** page in Stripe, not the API key.
