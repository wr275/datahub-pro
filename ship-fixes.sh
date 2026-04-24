#!/usr/bin/env bash
# One-shot: commit + push two logical changes to main:
#   1) Post-login polish (admin sidebar, HubHome cleanup)
#   2) Landing page color swap (amber → brand pink)
# The password-reset feature is already on main as b6488f7.
#
# Run from the repo root:
#   cd ~/Desktop/datahub-pro && bash ship-fixes.sh
set -euo pipefail

cd "$(dirname "$0")"

# Clear any stale lock the sandbox may have left behind
rm -f .git/index.lock

echo "=== Current branch ==="
git branch --show-current
echo ""

# ── Commit 1: post-login polish ────────────────────────────────────
echo "=== Commit 1/2: post-login polish ==="
git add backend/routers/auth.py frontend/src/pages/HubHome.jsx
git status --short -- backend/routers/auth.py frontend/src/pages/HubHome.jsx

git commit -m "Post-login polish: surface admin sidebar + clean HubHome

- auth.py: include is_superuser in login/register/accept-invite
  TokenResponse so the Platform Admin sidebar section appears on
  first login without needing a page reload. Previously only /me
  returned the flag, so the sidebar stayed hidden until refresh.

- HubHome Quick Actions: drop RFM Analysis, add KPI Dashboard,
  Data View, Pivot Table, Forecasting. The prior filter was
  silently dropping the four AI entries, so users only saw three
  buttons.

- HubHome FINANCE section: remove four tools that pointed at
  non-existent routes (/profit-loss, /cash-flow, /balance-sheet,
  /financial-ratios) and fix /budget-vs-actuals ->
  /budget-actuals. Relocate NPV Calculator from FORECASTING.

- HubHome OPERATIONS: surface SharePoint (route existed but was
  undiscoverable from the workspace grid)."
echo ""

# ── Commit 2: landing page color swap ─────────────────────────────
echo "=== Commit 2/2: landing page amber → pink ==="
git add frontend/src/pages/LandingPage.css frontend/src/pages/LandingPage.jsx
git status --short -- frontend/src/pages/LandingPage.css frontend/src/pages/LandingPage.jsx

git commit -m "Landing page: swap brand amber/yellow for pink #e91e8c

Matches the rest of the product UI (sidebar, logos, buttons,
Login screen) which all use #e91e8c. Structure untouched — only
five --amber CSS vars and nine hardcoded refs were changed.

- Palette swap in LandingPage.css (--amber, --amber-d, --amber-l,
  --amber-dim, --amber-bdr). Variable names intentionally kept as
  --amber so every downstream consumer picks up the new color
  without needing a rename pass.

- LandingPage.jsx: 9 hardcoded #f59e0b / #d97706 / rgba references
  updated to the new palette. Foreground text on the pink logo
  marks changed from black to white to preserve contrast.

- macOS-style traffic-light dots (#fbbf24) intentionally kept
  amber — they read as window chrome, not brand."
echo ""

# ── Push ──────────────────────────────────────────────────────────
echo "=== Pushing to main ==="
git push origin main

echo ""
echo "Done. Railway will redeploy datahub-pro-production.up.railway.app"
echo "automatically. datahubpro.co.uk points at this same deployment."
