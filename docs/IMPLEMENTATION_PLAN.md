# Implementation Plan

The application is built in phases. After each phase we run type checks,
builds, and Prisma validation, fix any errors, and stop for review
before proceeding.

## Phase 0 — Foundation (this phase)

- Repo skeleton: `backend/`, `frontend/`, `docs/`
- Backend: Node + Express + TypeScript
- Frontend: React + Vite + TypeScript + Tailwind + React Router + Axios
- Prisma configured against SQLite
- Initial migration and generated client
- `.env.example`, `.gitignore`, `README.md`, docs
- Backend health endpoint (checks DB connectivity)
- Frontend shell that pings the health endpoint
- No business features yet

## Phase 1 — Authentication / RBAC / Units

- Users, roles, permissions, role_permissions
- Units and departments
- Login / logout / session (HTTP-only cookie)
- Password hashing (bcrypt / Argon2)
- RBAC middleware on the backend
- User management UI
- Frontend route guards

## Phase 2 — Equipment

- Equipment types (configurable)
- Equipment master with all documented fields
- CRUD, search, filtering, status transitions
- Bulk CSV/Excel import with validate → preview → confirm
- Equipment detail page

## Phase 3 — Checklist Templates

- Templates, sections, questions
- All question types (Pass/Fail, Yes/No, Numeric, Text, Dropdown, Date,
  Photo, Remarks)
- Mandatory + safety-critical flags
- Template assignment per equipment type
- **Versioning** — historical inspections retain the version they used
- Admin UI

## Phase 4 — QR Management

- Unique QR per equipment
- Individual generation, bulk generation
- Printable labels (PDF-friendly)
- Mobile QR scanning page

## Phase 5 — Monthly Inspections

- Pending / Completed / Overdue states
- Duplicate prevention
- Mobile-first inspection UI
- Pass/fail, mandatory validation, safety-critical failure logic
- Photo upload (local storage abstraction)
- Immutable historical records

## Phase 6 — Corrective Actions

- Auto-creation on configured failed questions
- List, detail, priority, target date, assignment
- Status transitions and closure with evidence
- Authorization on close

## Phase 7 — Reports

- Compliance, unit compliance, equipment history, failed equipment,
  corrective actions
- Filters
- CSV / Excel-compatible / PDF export where practical

## Phase 8 — Dashboard

- Real DB-backed KPIs and charts
- Filters (unit, equipment type, month, status)
- Role-sensitive content

## Phase 9 — Audit / Security Hardening

- Audit logs for all sensitive actions
- Security headers, rate limiting, input validation
- File type/size restrictions, session timeout
- Sensitive-data handling review

## Phase 10 — Production Readiness

- Env configuration review
- Production builds
- Backup considerations for SQLite
- Deployment instructions
- PostgreSQL migration notes (do not implement)
