# UPL Fire Equipment Maintenance Portal

Internal web application for managing monthly fire equipment maintenance
inspections across UPL manufacturing units.

> **Status:** All phases complete (0 → 10). Every business module
> from the spec is delivered: auth + RBAC, units, departments, users,
> equipment master + bulk import, checklist templates with versioning,
> QR generation + camera scan + printable labels, mobile monthly
> inspections with photo uploads and safety-critical failure
> detection, corrective actions with lifecycle + evidence, five reports
> (CSV/Excel/print), live dashboard with charts, audit-log UI, and
> production hardening (sliding sessions, rate limits, security
> headers, request-id correlation, backup script, deployment guide).
> See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and
> [docs/ACCEPTANCE_TESTING.md](docs/ACCEPTANCE_TESTING.md).

---

## 1. Overview

The portal manages:

- Fire equipment master (extinguishers, hydrants, hose reels, pumps, detectors)
- Unique QR code per equipment for mobile scan-and-inspect workflow
- Configurable checklist templates with versioning
- Monthly inspections with pass/fail, safety-critical rules, and photos
- Automatic corrective actions on failure
- Compliance dashboards and reports
- Role-based access control and full audit logging

---

## 2. Technology Stack

**Frontend**

- React 18 + Vite + TypeScript
- Tailwind CSS
- React Router
- Axios
- Recharts (charts, added later)
- QR generation and camera-based QR scanning libraries (added later)

**Backend**

- Node.js + Express + TypeScript
- Prisma ORM
- SQLite (local `.db` file — no database server needed)
- bcrypt / Argon2 for password hashing (added later)
- HTTP-only session cookies (added later)

**Architecture** — simple monolith:

```
React → Axios → Express REST API → Controllers → Services → Prisma → SQLite
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

---

## 3. Prerequisites

- **Node.js 18+** (tested with Node 24) and npm 9+
- A modern web browser
- No database server required — SQLite runs as a local file

---

## 4. Installation

Clone the repository, then install dependencies in **both** packages:

```bash
# backend
cd backend
npm install

# frontend
cd ../frontend
npm install
```

---

## 5. Environment Variables

Copy the example environment file:

```bash
# from repo root
cp .env.example backend/.env
cp .env.example frontend/.env
```

Keep only the relevant variables in each file:

- `backend/.env` — DATABASE_URL, PORT, NODE_ENV, SESSION_SECRET,
  SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS, CORS_ORIGIN, UPLOAD_DIR,
  UPLOAD_MAX_BYTES
- `frontend/.env` — VITE_API_BASE_URL

See [`.env.example`](.env.example) for the complete list.

---

## 6. Database Setup

The database is a local SQLite file managed by Prisma. There is nothing
to install.

```bash
cd backend
npm run db:migrate      # create/apply migrations
npm run db:seed         # (added in later phases) seed demo data
npm run db:studio       # optional: browse the DB in Prisma Studio
```

The database file lives at `backend/prisma/dev.db` and is ignored by git.

See [`docs/DATABASE.md`](docs/DATABASE.md) for the full schema plan.

---

## 7. Prisma Commands

| Command                | Purpose                                              |
| ---------------------- | ---------------------------------------------------- |
| `npm run db:migrate`   | Create + apply a new dev migration                   |
| `npm run db:generate`  | Regenerate the Prisma client                         |
| `npm run db:seed`      | Run the seed script (populated in later phases)      |
| `npm run db:studio`    | Launch Prisma Studio in the browser                  |
| `npm run db:reset`     | **Destructive** — wipe and re-migrate (dev only)     |

---

## 8. Running the Application

Open two terminals.

**Terminal 1 — backend (port 4000):**

```bash
cd backend
npm run dev
```

Health check: <http://localhost:4000/api/health>

**Terminal 2 — frontend (port 5173):**

```bash
cd frontend
npm run dev
```

App: <http://localhost:5173> — the shell page confirms it can reach the
backend health endpoint.

---

## 9. Development Workflow

- Backend uses `tsx` for hot-reloading TypeScript
- Frontend uses Vite HMR
- Run `npm run typecheck` and `npm run build` in each package before
  committing
- Prisma migrations are checked in — do **not** hand-edit them

---

## 10. Production Build

```bash
# backend
cd backend
npm run build
npm start

# frontend
cd ../frontend
npm run build
npm run preview       # serves the built assets locally
```

Production deployment guidance is added in Phase 10.

---

## 11. Project Structure

```
upl_project/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── lib/
│   │   ├── app.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.ts
│   └── tsconfig.json
├── docs/
│   ├── ACCEPTANCE_TESTING.md
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEPLOYMENT.md
│   ├── IMPLEMENTATION_PLAN.md
│   └── RBAC.md
├── .env.example
├── .gitignore
└── README.md
```

---

## 12. Demo Credentials

Seeded by `npm run db:seed`. Dev only — change before deploying.

| Role            | Username       | Password         |
| --------------- | -------------- | ---------------- |
| Super Admin     | `admin`        | `Admin@123`      |
| Central Admin   | `centraladmin` | `Central@123`    |
| Unit Admin      | `unitadmin`    | `UnitAdmin@123`  |
| Inspector       | `inspector`    | `Inspector@123`  |
| Viewer          | `viewer`       | `Viewer@123`     |

`unitadmin`, `inspector`, and `viewer` are assigned to UPL Unit A.

The seed is idempotent and **does not** overwrite passwords on
re-runs, so operators keeping their own credentials aren't disrupted
when demo data is refreshed.

---

## 13. Troubleshooting

- **`prisma migrate` fails on Windows** — ensure the `backend/prisma/`
  folder is writable and no Prisma Studio process is holding `dev.db`
  open.
- **Frontend can't reach backend** — check `VITE_API_BASE_URL` in
  `frontend/.env` and confirm the backend is on port 4000.
- **Port already in use** — set a different `PORT` in `backend/.env`
  and update `VITE_API_BASE_URL` to match.
- **CORS error** — set `CORS_ORIGIN` in `backend/.env` to the exact
  origin of your frontend (default `http://localhost:5173`).
