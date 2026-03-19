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
