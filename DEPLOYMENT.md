# Deployment guide

The app is split so it can be deployed **entirely on Vercel**:

1. **Frontend** — static React build (`./client`).
2. **Backend** — the Express app runs as a **Vercel serverless function**
   (`./server/api/index.ts`). It holds no long-lived sockets.
3. **Realtime** — the persistent WebSocket connections live on **Pusher
   Channels** (a managed service), not on Vercel. The backend only makes short
   HTTP calls to Pusher to push events.
4. **Database** — any managed Postgres reachable by a connection string
   (Vercel Postgres / Neon / Supabase).
5. **Avatars** — stored as data URLs in the DB, so no object storage or disk is
   needed (keeps the backend stateless).

## Deploy to Vercel (two projects)

### 0. Provision services

- **Postgres**: create a Vercel Postgres / Neon database and copy its pooled
  connection string.
- **Pusher**: create a free app at <https://pusher.com> and note `app_id`,
  `key`, `secret`, `cluster`. In the app settings enable **client events** off
  (not needed) and add a **webhook** → URL `https://<your-backend>/api/realtime/webhook`,
  events: *Member added* and *Member removed*.

### 1. Backend project (root directory = `server`)

Environment variables:

| Variable             | Value                                              |
|----------------------|----------------------------------------------------|
| `DATABASE_URL`       | your Postgres pooled connection string             |
| `JWT_ACCESS_SECRET`  | long random string                                 |
| `JWT_REFRESH_SECRET` | long random string                                 |
| `CLIENT_ORIGIN`      | your frontend URL, e.g. `https://app.vercel.app`   |
| `PUSHER_APP_ID`      | from Pusher                                        |
| `PUSHER_KEY`         | from Pusher                                        |
| `PUSHER_SECRET`      | from Pusher                                        |
| `PUSHER_CLUSTER`     | from Pusher, e.g. `eu`                             |

The included `server/vercel.json` runs `prisma generate && prisma migrate
deploy` at build time, so the schema is created/updated automatically.

### 2. Frontend project (root directory = `client`)

Build-time environment variables:

| Variable             | Value                                              |
|----------------------|----------------------------------------------------|
| `VITE_API_URL`       | `https://<your-backend>.vercel.app/api`            |
| `VITE_PUSHER_KEY`    | same `key` as the backend                          |
| `VITE_PUSHER_CLUSTER`| same cluster, e.g. `eu`                            |

Because the refresh-token cookie is cross-site, the backend sets
`SameSite=None; Secure` in production — both projects must be served over HTTPS
(Vercel does this by default).

> **Need a live link?** I can't create one for you because it requires logging
> into *your* Vercel, Pusher and database accounts. Provision the three services
> above, drop the env vars into the two Vercel projects, and click Deploy.

## Alternative: self-hosted with Docker (no third-party accounts)

`docker-compose.yml` bundles Postgres, the backend, the frontend **and** a
self-hosted [soketi](https://soketi.app) broker (Pusher-protocol compatible),
so the whole stack runs locally or on any VPS with zero external services:

```bash
JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
docker compose up --build
```

- App:        http://localhost:8080
- API health: http://localhost:4000/health
- Broker:     ws://localhost:6001

When deploying this to a public host, set `PUSHER_PUBLIC_HOST` to the broker's
public hostname (the browser connects to it directly) and serve everything over
TLS.

## Realtime architecture notes

- The client subscribes to `presence-online` (presence roster) and
  `private-user-{id}` (its own events). Channel subscriptions are authorized by
  `POST /api/realtime/auth` using the JWT.
- The server pushes events with the Pusher server SDK; it never holds a socket.
- Presence accuracy: soketi/Pusher call the signed `POST /api/realtime/webhook`
  on member add/remove, which updates `isOnline` / `lastSeen` in the DB.

## Database migrations

Migrations live in `server/prisma/migrations` and are applied by
`prisma migrate deploy` (run automatically by `server/vercel.json` and the
Docker entrypoint). Manually:

```bash
cd server && npx prisma migrate deploy
```
