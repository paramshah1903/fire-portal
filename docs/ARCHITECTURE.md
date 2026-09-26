# Architecture

## Overview

UPL Fire Safety Portal is a simple TypeScript monolith split into two
runtime packages:

- **`frontend/`** — a React + Vite single-page application served by the
  Vite dev server locally, and as static assets in production.
- **`backend/`** — a Node.js Express REST API using Prisma against a
  local SQLite database.

There is no external infrastructure (no Docker, no Redis, no Kafka, no
cloud services) required for local development.

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│   React SPA     │ ───────────────────────► │  Express REST API    │
│  (Vite + TS)    │        Axios             │  (Node + TS)         │
└─────────────────┘                          └─────────┬────────────┘
                                                       │ Prisma
                                                       ▼
                                              ┌──────────────────┐
                                              │  SQLite (file)   │
                                              └──────────────────┘
```

## Backend layers

```
routes/         # HTTP routing only
  └─ controllers/   # request/response shape, validation, RBAC checks
        └─ services/    # business logic, transactions
              └─ prisma  # data access
```

- **Routes** are thin — they map URLs to controllers.
- **Controllers** validate the request, call the service, and format the
  response. They never touch Prisma directly.
- **Services** own business logic and are the only layer that talks to
  Prisma.
- **Middleware** handles cross-cutting concerns: authentication, RBAC,
  request logging, error handling, rate limiting, security headers.

## Frontend structure

- `lib/api.ts` — a single Axios instance with the base URL, credentials,
  and error interceptor.
- `pages/` — route components.
- `components/` — reusable UI primitives (added in later phases).
- `hooks/` — data-fetching and state hooks (added in later phases).

Routing is via React Router. RBAC on the frontend hides unauthorized
navigation and controls, but authorization is always enforced on the
backend.

## Configuration

All environment-specific configuration lives in `.env` files. Nothing is
hard-coded. See [`.env.example`](../.env.example).

## Extensibility notes

- **Database** — the Prisma schema is written to be portable. If UPL
  eventually deploys multiple app instances or needs a centralised DB,
  Prisma can be repointed at PostgreSQL with a schema provider change
  and a new migration baseline. Types stay SQLite-friendly (no
  Postgres-specific column types) until that migration.
- **File storage** — file uploads go through a storage abstraction so
  the local filesystem can later be swapped for internal object storage.
- **Notifications** — currently dashboard-only. Email / WhatsApp / SMS
  providers can be plugged in as separate services when required.
