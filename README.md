# 💬 Pulse Messenger

A production-ready, real-time web messenger with a modern, **mobile-first** UI
(Telegram / Discord style), a typed REST API, JWT auth with refresh-token
rotation, and a Socket.IO realtime layer.

## Features

- 🔐 **User registration** with input validation (Zod)
- 🔑 **JWT auth with refresh tokens** (access token in memory, refresh token in an httpOnly cookie, rotated on every refresh)
- 🔒 **Secure password storage** with bcrypt (cost 12)
- 💬 **Direct (1:1) conversations** with full message history in PostgreSQL
- ⚡ **Real-time messaging** over WebSocket (Socket.IO) with optimistic UI
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
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Socket.IO client |
| Backend  | Node.js, Express, TypeScript, Socket.IO, Zod, Multer            |
| Database | PostgreSQL 16 + Prisma ORM                                      |
| Auth     | JWT (access) + opaque refresh tokens (DB-persisted), bcrypt     |
| Infra    | Docker, docker-compose, Nginx (client)                          |

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

You need a running PostgreSQL instance.

```bash
# 1. Backend
cd server
cp .env.example .env          # adjust DATABASE_URL / secrets
npm install
npx prisma migrate dev        # create schema
npm run prisma:seed           # optional demo data
npm run dev                   # http://localhost:4000

# 2. Frontend (new terminal)
cd client
npm install
npm run dev                   # http://localhost:5173 (proxies /api + /socket.io)
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
| POST   | `/api/messages`                             | ✅   | Send message (REST)        |
| PATCH  | `/api/messages/:id`                         | ✅   | Edit message               |
| DELETE | `/api/messages/:id`                         | ✅   | Delete message             |

### Socket.IO events

Client → server: `message:send`, `typing:start`, `typing:stop`, `message:read`
Server → client: `message:new`, `message:edited`, `message:deleted`, `message:read`, `presence:update`, `presence:list`, `typing:start`, `typing:stop`

## Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for cloud deployment notes, including
the important caveat about WebSocket support on serverless platforms.
