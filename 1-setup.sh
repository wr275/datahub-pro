#!/bin/bash

# ============================================================
#  DataHub Pro — One-Time Setup Script for Mac
#  Run with: bash 1-setup.sh
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   DataHub Pro — Setup${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# ── Step 1: Homebrew ─────────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking Homebrew...${NC}"
if ! command -v brew &>/dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [[ -f "/opt/homebrew/bin/brew" ]]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
    fi
else
    echo -e "${GREEN}✓ Homebrew already installed${NC}"
fi

# Make sure brew is on PATH (Apple Silicon)
if [[ -f "/opt/homebrew/bin/brew" ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# ── Step 2: Python 3.11 ──────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/6] Installing Python 3.11...${NC}"
echo "  (Your Mac has Python 3.8 which is too old — installing 3.11)"
brew install python@3.11

# Find python3.11
PYTHON=""
for candidate in \
    "/opt/homebrew/bin/python3.11" \
    "/usr/local/bin/python3.11" \
    "$(brew --prefix python@3.11)/bin/python3.11"; do
    if [[ -f "$candidate" ]]; then
        PYTHON="$candidate"
        break
    fi
done

if [[ -z "$PYTHON" ]]; then
    echo -e "${RED}Could not find python3.11. Try restarting Terminal and running again.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Using Python: $PYTHON ($($PYTHON --version))${NC}"

# Save python path for start script
echo "$PYTHON" > "$SCRIPT_DIR/.python_path"

# ── Step 3: Node.js ──────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6] Checking Node.js...${NC}"
if ! command -v node &>/dev/null; then
    echo "Installing Node.js..."
    brew install node
else
    echo -e "${GREEN}✓ Node.js already installed ($(node --version))${NC}"
fi

# ── Step 4: PostgreSQL ───────────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Checking PostgreSQL...${NC}"
if ! command -v psql &>/dev/null && ! ls /opt/homebrew/opt/postgresql@16/bin/psql &>/dev/null 2>&1; then
    echo "Installing PostgreSQL..."
    brew install postgresql@16
fi

# Add postgres to PATH
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
if ! grep -q "postgresql@16" ~/.zprofile 2>/dev/null; then
    echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zprofile
fi

# Start postgres
brew services start postgresql@16 2>/dev/null || true
sleep 3
echo -e "${GREEN}✓ PostgreSQL running${NC}"

# Create database
echo "  Setting up database..."
createdb datahub_pro 2>/dev/null && echo "  Created database" || echo "  (database already exists)"
psql datahub_pro -c "CREATE USER datahub WITH PASSWORD 'datahub_password';" 2>/dev/null || true
psql datahub_pro -c "GRANT ALL PRIVILEGES ON DATABASE datahub_pro TO datahub;" 2>/dev/null || true
echo -e "${GREEN}✓ Database ready${NC}"

# ── Step 5: Python virtual environment + packages ────────────
echo ""
echo -e "${YELLOW}[5/6] Installing Python packages...${NC}"
cd "$SCRIPT_DIR/backend"

# Create virtual environment using Python 3.11
$PYTHON -m venv venv
echo -e "${GREEN}✓ Virtual environment created${NC}"

# Install packages into the venv
./venv/bin/pip install --upgrade pip --quiet
./venv/bin/pip install -r requirements.txt
echo -e "${GREEN}✓ Python packages installed${NC}"

# Create .env file
if [ ! -f .env ]; then
    cp .env.example .env
    sed -i '' 's|DATABASE_URL=.*|DATABASE_URL=postgresql://datahub:datahub_password@localhost:5432/datahub_pro|' .env
    echo -e "${GREEN}✓ Created .env file${NC}"
fi

# ── Step 6: Node packages ────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6] Installing frontend packages...${NC}"
cd "$SCRIPT_DIR/frontend"
npm install
echo -e "${GREEN}✓ Frontend packages installed${NC}"

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}  ✅ Setup complete!${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "  Now run:  bash 2-start.sh"
echo ""
