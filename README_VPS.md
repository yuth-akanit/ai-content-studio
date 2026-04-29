# VPS Deployment

This project is ready to deploy on a VPS using Docker Compose and Nginx.

## 1. Prepare the server

- Ubuntu 22.04 or 24.04 recommended
- Install Docker and Docker Compose plugin
- Open ports `80` and `443` on your firewall

## 2. Copy the project

```bash
git clone <your-repo-url> ai-content-studio
cd ai-content-studio
```

## 3. Create production env file

```bash
cp .env.production.example .env.production
```

Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_API_KEY`
- `AI_BASE_URL`
- `AI_MODEL`

## 4. Start the stack

```bash
docker compose up -d --build
```

Important:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

must be available at build time for the client bundle.
If you build manually with `docker build`, pass them as build args.

Example:

```bash
set -a
. ./.env.production
set +a

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -t ai-content-studio .
```

## 5. Verify

```bash
docker compose ps
curl http://localhost/api/health
```

## 6. Update deploy

```bash
git pull
docker compose up -d --build
```

## One-command VPS deploy

If you are deploying directly on a VPS with Docker and an existing reverse proxy
such as Caddy, use:

```bash
chmod +x deploy.sh
./deploy.sh
```

Defaults:

- container name: `ai-content-studio`
- host port: `3007`
- env file: `.env.production`

You can override them:

```bash
APP_PORT=3012 APP_NAME=ai-content-studio-staging ./deploy.sh
```

## 7. View logs

```bash
docker compose logs -f app
docker compose logs -f nginx
```

## HTTPS

Recommended production setup:

- put Cloudflare in front, or
- terminate SSL with Caddy/Nginx Proxy Manager, or
- add Certbot on the VPS

If you want, add an SSL proxy in front of this compose stack instead of exposing port `80` directly.
