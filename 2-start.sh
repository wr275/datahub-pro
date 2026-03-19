#!/bin/bash

# ============================================================
#  DataHub Pro — Start Script
#  Run every time you want to start the app:
#  bash 2-start.sh
# ============================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   DataHub Pro — Starting...${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Add postgres to PATH
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Make sure PostgreSQL is running
echo -e "${YELLOW}► Starting database...${NC}"
brew services start postgresql@16 2>/dev/null || true
sleep 2
echo -e "${GREEN}✓ Database running${NC}"

# Start backend
echo -e "${YELLOW}► Starting backend API...${NC}"
cd "$SCRIPT_DIR/backend"

# Use the venv python
VENV_PYTHON="$SCRIPT_DIR/backend/venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    echo -e "${RED}Virtual environment not found. Please run 1-setup.sh first.${NC}"
    exit 1
fi

$VENV_PYTHON main.py &
BACKEND_PID=$!
sleep 4

if kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Backend running at http://localhost:8000${NC}"
else
    echo -e "${RED}✗ Backend failed to start. Common fixes:${NC}"
    echo "  1. Make sure you ran 1-setup.sh successfully"
    echo "  2. Check that port 8000 is not already in use:"
    echo "     lsof -i :8000"
    echo "  3. Paste the error above into Claude for help"
    exit 1
fi

# Start frontend
echo -e "${YELLOW}► Starting frontend...${NC}"
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!
sleep 4
echo -e "${GREEN}✓ Frontend running at http://localhost:3000${NC}"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  ✅ DataHub Pro is running!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo -e "  🌐 App:      ${GREEN}http://localhost:3000${NC}"
echo -e "  🔧 API:      ${GREEN}http://localhost:8000${NC}"
echo -e "  📖 API Docs: ${GREEN}http://localhost:8000/api/docs${NC}"
echo ""
echo "  Press Ctrl+C to stop everything"
echo ""

# Open browser
sleep 2
open http://localhost:3000

# Clean up on Ctrl+C
trap "echo ''; echo 'Stopping DataHub Pro...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped. Goodbye!'" EXIT
wait
