#!/bin/bash
# DataHub Pro — Deployment Script
# Usage: ./deploy.sh [dev|prod]
# Make this file executable: chmod +x deploy.sh

set -e

MODE=${1:-dev}
echo "🚀 Deploying DataHub Pro in $MODE mode..."

if [ "$MODE" = "prod" ]; then
    echo "📦 Building production images..."
    docker-compose -f docker-compose.yml --profile production build

    echo "🗄️  Running database migrations..."
    docker-compose run --rm backend python -c "from database import Base, engine; Base.metadata.create_all(engine); print('✅ Database ready')"

    echo "▶️  Starting services..."
    docker-compose -f docker-compose.yml --profile production up -d

    echo "✅ DataHub Pro is live!"
    echo "   Frontend: https://datahubpro.io"
    echo "   API:      https://datahubpro.io/api"
    echo "   Health:   https://datahubpro.io/health"

elif [ "$MODE" = "dev" ]; then
    echo "🔧 Starting development environment..."
    docker-compose up -d db redis

    echo "⏳ Waiting for database..."
    sleep 5

    echo "▶️  Starting backend (port 8000)..."
    cd ../backend
    pip install -r requirements.txt --quiet
    uvicorn main:app --reload --host 0.0.0.0 --port 8000 &

    echo "▶️  Starting frontend (port 3000)..."
    cd ../frontend
    npm install --quiet
    npm run dev &

    echo ""
    echo "✅ Development environment running:"
    echo "   Frontend: http://localhost:3000"
    echo "   API:      http://localhost:8000"
    echo "   API Docs: http://localhost:8000/docs"
    echo ""
    echo "Press Ctrl+C to stop"
    wait

else
    echo "❌ Unknown mode: $MODE. Use 'dev' or 'prod'"
    exit 1
fi
