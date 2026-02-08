#!/bin/bash
set -e

echo "=== WoW Guilds - Deploy ==="

# Build containers
echo "Building containers..."
docker compose -f docker-compose.prod.yml build

# Run database migrations inside a temporary container
echo "Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm --no-deps -w /app/packages/database worker bunx prisma migrate deploy

# Start services
echo "Starting containers..."
docker compose -f docker-compose.prod.yml up -d

# Wait for health check
echo "Waiting for health check..."
sleep 10

if docker exec wowguilds-web wget -qO- http://localhost:3000/api/health > /dev/null 2>&1; then
  echo "Health check passed!"
else
  echo "WARNING: Health check failed"
  docker compose -f docker-compose.prod.yml logs --tail 50
  exit 1
fi

echo "=== Deploy complete ==="
