# CLAUDE.md — Project Rules for AI Assistants

> This file is read by Claude (and any AI assistant) at the start of every session.
> These rules are NON-NEGOTIABLE and must be followed before taking any action on this repo.

---

## 🚨 DEPLOYMENT ENVIRONMENTS — READ THIS FIRST, EVERY TIME

This project has TWO Railway deployments. They are completely separate and must never be confused.

---

### ✅ DEVELOPMENT / EXPERIMENT environment — work here freely
- **URL:** https://datahub-pro-production.up.railway.app
- **Railway project:** generous-charm / production
- **GitHub branch:** `main`
- **Purpose:** Active development, new features, experiments, day-to-day work
- **Rule:** All commits to `main` deploy here automatically. This is the normal working environment.

---

### 🚫 CLIENT DEMO environment — DO NOT TOUCH. EVER. Without explicit approval.
- **URL:** https://modest-renewal-demo.up.railway.app
- **Backend API:** https://splendid-wholeness-demo.up.railway.app
- **GitHub branch:** `stable` (frozen at tag `v1.0-stable`)
- **Purpose:** Stable demo shown to enterprise prospects and potential clients
- **Rule:** NEVER commit to the `stable` branch or touch this deployment under any circumstances.
  This URL is shared with clients. It must remain frozen and stable at all times.
  The ONLY way to update it is if Waqas explicitly says "update the demo" or "push to stable".

---

## ⚠️ BEFORE EVERY CODING SESSION — MANDATORY CHECKLIST

1. All work defaults to the `main` branch → deploys to datahub-pro-production.up.railway.app ✅
2. NEVER touch the `stable` branch or modest-renewal-demo.up.railway.app 🚫
3. If asked to "deploy to demo" or "update the client demo", STOP and confirm with Waqas first.
4. If ever unsure which environment is meant, ASK before doing anything.

---

## REPO OWNER
- **Waqas Rafique** — waqas114@gmail.com
- GitHub: wr275
