# CLAUDE.md — Project Rules for AI Assistants

> This file is read by Claude (and any AI assistant) at the start of every session.
> These rules are NON-NEGOTIABLE and must be followed before taking any action.

---

## 🚨 DEPLOYMENT ENVIRONMENTS — READ FIRST

This project has TWO Railway deployments. They are NOT interchangeable.

### ✅ EXPERIMENT / DEMO environment — deploy here freely
- **URL:** https://modest-renewal-demo.up.railway.app
- **Purpose:** Features under development, experiments, demos shown to enterprise prospects
- **GitHub branch:** `demo` (or whichever branch feeds this service — verify in Railway)
- **Rule:** All new feature work, fixes, and experiments go here ONLY

### 🚫 PRODUCTION environment — DO NOT TOUCH without explicit approval
- **URL:** https://datahub-pro-production.up.railway.app
- **Purpose:** Live users, real data
- **GitHub branch:** `main`
- **Rule:** NEVER commit to `main` or deploy anything here unless Waqas explicitly says
  "deploy to production" or "push to main". No exceptions.

---

## ⚠️ BEFORE EVERY CODING SESSION

1. Confirm which environment the task targets.
2. If the user has not said explicitly, ASK before touching any branch.
3. Default assumption: work goes to the **demo/experiment** environment only.
4. Changes to `main` branch = changes to production = requires explicit approval.

---

## REPO OWNER
- **Waqas Rafique** — waqas114@gmail.com
- GitHub: wr275
