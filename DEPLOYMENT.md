# Deployment guide

This app has three runtime pieces:

1. **PostgreSQL** database
2. **Backend** — a long-lived Node process (Express + **persistent WebSocket** via Socket.IO)
3. **Frontend** — a static React build

## ⚠️ Important: Vercel and WebSockets

**Vercel cannot host the backend as-is.** Vercel runs serverless / edge
functions that are short-lived and **do not support long-lived WebSocket
connections**, which Socket.IO requires for real-time messaging, presence and
typing indicators. Vercel also does not run PostgreSQL.

You have two realistic options:

### Option A — One platform for everything (simplest, recommended)

Deploy the whole stack to a platform that supports persistent processes and
managed Postgres:

- **Railway**, **Render**, **Fly.io**, or a VPS with Docker.

With Docker this is essentially:

```bash
JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
docker compose up --build -d
```

On Render/Railway: create a PostgreSQL instance, deploy `./server` (Dockerfile)
with the env vars below, and deploy `./client` as a static site or Docker image.

### Option B — Frontend on Vercel + backend elsewhere

- Deploy **`./client`** to **Vercel** (it's a static Vite build — `vercel.json` is included).
- Deploy **`./server`** to Railway/Render/Fly (a host that supports WebSockets).
- In Vercel project settings, set:
  - `VITE_API_URL=https://your-backend-host/api`
  - `VITE_SOCKET_URL=https://your-backend-host`
- Set the backend `CLIENT_ORIGIN` to your Vercel domain so CORS + cookies work.
- Because the cookie is cross-site, the backend already sets
  `SameSite=None; Secure` in production — serve the backend over HTTPS.

## Backend environment variables

| Variable               | Example                                                  |
|------------------------|----------------------------------------------------------|
| `DATABASE_URL`         | `postgresql://user:pass@host:5432/messenger?schema=public` |
| `JWT_ACCESS_SECRET`    | long random string                                       |
| `JWT_REFRESH_SECRET`   | long random string                                       |
| `CLIENT_ORIGIN`        | `https://your-frontend.example.com` (comma-separated OK) |
| `ACCESS_TOKEN_TTL`     | `15m`                                                    |
| `REFRESH_TOKEN_TTL_DAYS` | `7`                                                    |
| `PORT`                 | `4000`                                                   |

> Note: uploaded avatars are stored on the server's local disk (`/app/uploads`).
> For multi-instance / serverless backends, swap the Multer disk storage in
> `server/src/middleware/upload.ts` for object storage (S3/R2/Supabase Storage).

## Database migrations

Migrations live in `server/prisma/migrations` and are applied automatically by
the backend container (`prisma migrate deploy` runs on startup). To run them
manually:

```bash
cd server && npx prisma migrate deploy
```
