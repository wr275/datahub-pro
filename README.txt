============================================================
  DataHub Pro — Quick Start Guide
============================================================

FIRST TIME SETUP (run once):
──────────────────────────────
1. Open Terminal (press Cmd+Space, type "Terminal", press Enter)

2. Navigate to this folder:
   cd ~/Downloads/datahub-saas
   (or wherever you saved this folder)

3. Run the setup script:
   bash 1-setup.sh

   This will install Node.js, PostgreSQL, and all dependencies.
   Takes about 5-10 minutes. Just let it run.


STARTING THE APP (every time):
────────────────────────────────
1. Open Terminal

2. Navigate to this folder:
   cd ~/Downloads/datahub-saas

3. Run:
   bash 2-start.sh

   The app will open automatically in your browser at:
   http://localhost:3000

4. Press Ctrl+C in Terminal to stop the app.


WHAT'S INCLUDED:
─────────────────
  backend/     Python API server (FastAPI)
  frontend/    React web app
  database/    PostgreSQL schema
  docker/      Docker config (for cloud deployment)
  1-setup.sh   One-time setup script
  2-start.sh   Daily start script


NEED HELP?
───────────
If you see any errors during setup, copy the error message
and ask Claude for help — it can fix it immediately.

============================================================
