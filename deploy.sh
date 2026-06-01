#!/usr/bin/env bash

set -euo pipefail

APP_NAME="${APP_NAME:-ai-content-studio}"
APP_PORT="${APP_PORT:-3007}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
ENV_FILE="${ENV_FILE:-.env.production}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
IMAGE_NAME="${IMAGE_NAME:-ai-content-studio}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: Missing $ENV_FILE"
  echo "Create it first, for example:"
  echo "  cp .env.production.example .env.production"
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

required_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  AI_API_KEY
  AI_BASE_URL
  AI_MODEL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "ERROR: $var_name is missing or empty in $ENV_FILE"
    exit 1
  fi
done

echo "==> Building image: $IMAGE_NAME"
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t "$IMAGE_NAME" .

if docker ps -a --format '{{.Names}}' | grep -Fxq "$APP_NAME"; then
  echo "==> Removing existing container: $APP_NAME"
  docker rm -f "$APP_NAME" >/dev/null
fi

echo "==> Starting container: $APP_NAME"
docker run -d \
  --name "$APP_NAME" \
  --restart unless-stopped \
  -p "${APP_PORT}:${CONTAINER_PORT}" \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME" >/dev/null

echo "==> Waiting for health check"
for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${APP_PORT}${HEALTH_PATH}" >/dev/null; then
    echo "==> Deploy successful"
    curl -fsS "http://127.0.0.1:${APP_PORT}${HEALTH_PATH}"
    echo
    exit 0
  fi
  sleep 2
done

echo "ERROR: Health check failed for http://127.0.0.1:${APP_PORT}${HEALTH_PATH}"
echo "Recent logs:"
docker logs --tail 100 "$APP_NAME" || true
exit 1
