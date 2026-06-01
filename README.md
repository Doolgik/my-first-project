# 💬 Pulse Messenger

A production-ready, real-time web messenger with a modern, **mobile-first** UI
(Telegram / Discord style), a typed REST API, JWT auth with refresh-token
rotation, and a Socket.IO realtime layer.

## Features

- 🔐 **User registration** with input validation (Zod)
- 🔑 **JWT auth with refresh tokens** (access token in memory, refresh token in an httpOnly cookie, rotated on every refresh)
- 🔒 **Secure password storage** with bcrypt (cost 12)
- 💬 **Direct (1:1) conversations** with full message history in PostgreSQL
- ⚡ **Real-time messaging** over the Pusher protocol (Pusher Channels / self-hosted soketi) with optimistic UI — **deployable to serverless platforms like Vercel**
- 🟢 **Online / offline presence** + last-seen
- ✍️ **Typing indicators**
- ✓✓ **Read receipts**
- 🔍 **User search**
- 👤 **Profile editing** + **avatar upload**
- 📱 **Responsive, mobile-first UI** (single-pane on phones, two-pane on desktop, safe-area aware)
- 🛡️ **Protected API** (Bearer auth middleware), rate limiting, Helmet, CORS
- ❗ **Centralized error handling** & validation
- 🐳 **Dockerized** and cloud-deploy ready
- 🗃️ **Prisma ORM** with real migrations

## Tech stack

| Layer    | Tech                                                            |
|----------|-----------------------------------------------------------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, pusher-js    |
| Backend  | Node.js, Express, TypeScript, Pusher (realtime), Zod, Multer    |
| Database | PostgreSQL 16 + Prisma ORM                                      |
| Auth     | JWT (access) + opaque refresh tokens (DB-persisted), bcrypt     |
| Realtime | Pusher protocol — Pusher Channels in prod, soketi for self-host |
| Infra    | Docker, docker-compose, Nginx (client), Vercel-ready            |

## Quick start (Docker — recommended)

```bash
# from the repo root
JWT_ACCESS_SECRET=$(openssl rand -hex 32) \
JWT_REFRESH_SECRET=$(openssl rand -hex 32) \
docker compose up --build
```

- App:        http://localhost:8080
- API health: http://localhost:4000/health

Migrations run automatically on backend start.

## Local development (without Docker)

You need a running PostgreSQL instance. Realtime needs a Pusher-compatible
broker — either free [Pusher Channels](https://pusher.com) credentials, or a
local [soketi](https://soketi.app) (`npx @soketi/soketi start`). If `PUSHER_*`
is left unset the API still runs, just without realtime push.

```bash
# 1. Backend
cd server
cp .env.example .env          # set DATABASE_URL, secrets and PUSHER_* (optional)
npm install
npx prisma migrate dev        # create schema
npm run prisma:seed           # optional demo data
npm run dev                   # http://localhost:4000

# 2. Frontend (new terminal)
cd client
cp .env.example .env          # set VITE_PUSHER_* to match the broker
npm install
npm run dev                   # http://localhost:5173 (proxies /api)
```

### Demo account (after seeding)

```
alice@example.com / password123
bob@example.com   / password123
carol@example.com / password123
```

## API overview

| Method | Route                                       | Auth | Description                |
|--------|---------------------------------------------|------|----------------------------|
| POST   | `/api/auth/register`                        | –    | Register                   |
| POST   | `/api/auth/login`                           | –    | Login                      |
| POST   | `/api/auth/refresh`                         | 🍪   | Rotate tokens              |
| POST   | `/api/auth/logout`                          | 🍪   | Logout                     |
| GET    | `/api/auth/me`                              | ✅   | Current user               |
| GET    | `/api/users/search?q=`                      | ✅   | Search users               |
| GET    | `/api/users/:id`                            | ✅   | Get a user                 |
| PATCH  | `/api/users/me`                             | ✅   | Update profile             |
| POST   | `/api/users/me/avatar`                      | ✅   | Upload avatar (multipart)  |
| GET    | `/api/conversations`                        | ✅   | List conversations         |
| POST   | `/api/conversations`                        | ✅   | Start/find a conversation  |
| GET    | `/api/conversations/:id/messages`           | ✅   | Message history            |
| POST   | `/api/conversations/:id/read`               | ✅   | Mark conversation read     |
| POST   | `/api/conversations/:id/typing`             | ✅   | Broadcast typing state     |
| POST   | `/api/messages`                             | ✅   | Send message               |
| PATCH  | `/api/messages/:id`                         | ✅   | Edit message               |
| DELETE | `/api/messages/:id`                         | ✅   | Delete message             |
| POST   | `/api/realtime/auth`                        | ✅   | Pusher channel authorization |
| POST   | `/api/realtime/webhook`                     | 🔏   | Pusher presence webhook (signed) |

### Realtime (Pusher) channels & events

- **`presence-online`** — global presence roster (who is online). Drives online/offline indicators; member add/remove updates persisted status via a signed webhook.
- **`private-user-{userId}`** — each user's private channel. The server pushes `message:new`, `message:edited`, `message:deleted`, `message:read`, `typing:start`, `typing:stop` here for every conversation the user takes part in.

Clients send messages / typing / read state via the REST API; the server fans
the resulting events out over Pusher. This keeps the backend stateless and free
of long-lived sockets, so it runs on serverless platforms.

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for cloud deployment notes, including
the important caveat about WebSocket support on serverless platforms.
