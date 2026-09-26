# Database

## Engine

**SQLite** via **Prisma ORM**.

The database is a single file at `backend/prisma/dev.db`. Nothing to
install; Prisma creates and migrates it. The path is configured via
`DATABASE_URL` in `backend/.env`.

## Prisma commands

| Command                     | Purpose                                        |
| --------------------------- | ---------------------------------------------- |
| `npm run db:migrate`        | Create + apply a new dev migration             |
| `npm run db:migrate:deploy` | Apply migrations without prompting (prod)      |
| `npm run db:generate`       | Regenerate the Prisma client                   |
| `npm run db:seed`           | Run the seed script                            |
| `npm run db:studio`         | Launch Prisma Studio                           |
| `npm run db:reset`          | **Destructive**: drop and re-migrate           |
| `npm run db:backup`         | Copy `dev.db` (+ WAL/SHM sidecars) into `backups/dev-<timestamp>.db` |

## Backups (SQLite)

`npm run db:backup` writes an atomic snapshot into
`backend/backups/dev-<UTC-timestamp>.db`. The script also copies any
existing `-journal`, `-wal`, and `-shm` sidecars so the restored
database is consistent.

For production, wire the script into cron or a systemd timer — see
[DEPLOYMENT.md](DEPLOYMENT.md) for a working systemd unit + timer.

**Restore**: stop the API service, replace `backend/prisma/dev.db`
with the backup file (and any accompanying sidecars), start the
service.

## Portability to PostgreSQL

The schema deliberately avoids SQLite-only quirks:

- IDs are string CUIDs, not `AUTOINCREMENT` integers.
- Timestamps are `DateTime`, not stored as ints.
- Enums are modelled as string columns backed by TypeScript enums,
  because SQLite has no native enum. When migrating to PostgreSQL these
  can be converted to real `pg` enums with a targeted migration.
- No JSON1 extension features are used; JSON payloads are stored as
  `String`.
- No triggers, no stored procedures, no full-text search extensions.

### Migrating to PostgreSQL

When (and only when) a multi-node deployment is required. Do **not**
implement this preemptively — SQLite covers the single-server case and
keeps the ops story simple.

1. **Provision PostgreSQL** (14+) and create a database + user.
2. **Back up** the current SQLite file:
   ```bash
   cd backend
   npm run db:backup
   ```
3. **Extract data** — because the SQLite migration history is designed
   around SQLite, we baseline the PostgreSQL DB fresh and re-import
   data separately.
   Simplest export: use Prisma Studio to export each table to CSV, or
   run a one-off script that reads via the old client and writes via
   a new one.
4. **Switch the schema provider** — in `backend/prisma/schema.prisma`:
   ```
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
5. **Move existing migrations aside** (they contain SQLite-specific
   syntax):
   ```bash
   mv backend/prisma/migrations backend/prisma/migrations.sqlite.bak
   ```
6. **Point `DATABASE_URL`** at the new database:
   ```
   DATABASE_URL="postgresql://upl_app:<pw>@db.internal:5432/upl_portal"
   ```
7. **Baseline** the PostgreSQL database:
   ```bash
   npm run db:migrate -- --name init_postgres
   ```
8. **Re-import** the data from step 3, then run the seed only for
   permissions/roles if they weren't part of the export.
9. **Update the deployment**:
   - Backup script becomes redundant (use `pg_dump` instead).
   - Frontend / API code needs no changes — all queries go through
     Prisma.
   - File uploads still land on the local disk; move them to internal
     object storage before scaling horizontally.
   - Sessions continue to work as-is (already DB-backed).

Portability notes that were maintained throughout development so this
migration stays cheap:

- IDs are string CUIDs, not integer autoincrement.
- Timestamps are `DateTime`, not integers.
- Enums are strings validated at the application layer; can later be
  promoted to Postgres native enums with a targeted migration.
- No SQLite-only functions (JSON1, FTS, triggers, etc.) are used.
- No stored procedures; all business logic lives in Node.

## Schema

Delivered so far:

| Model            | Introduced | Notes                                              |
| ---------------- | ---------- | -------------------------------------------------- |
| HealthCheck      | Phase 0    | Health-endpoint DB probe                           |
| Role             | Phase 1    | Immutable, seeded                                  |
| Permission       | Phase 1    | Seeded, keys match `src/lib/rbac.ts`               |
| RolePermission   | Phase 1    | Join table                                         |
| Unit             | Phase 1    | Unique `code`                                      |
| Department       | Phase 1    | Unique `(unitId, code)`                            |
| User             | Phase 1    | bcrypt `passwordHash`, `roleId`, `unitId?`, `departmentId?` |
| Session          | Phase 1    | DB-backed, cookie holds signed session id          |
| EquipmentType    | Phase 2    | Unique `key`, `inspectionFrequencyDays`            |
| Equipment        | Phase 2    | Unique `equipmentCode` + `qrCodeValue`, status enum-string |
| ChecklistTemplate | Phase 3   | Logical template; targets `EquipmentType`          |
| ChecklistTemplateUnit | Phase 3 | M:N join for applicable units (empty = all units) |
| ChecklistTemplateVersion | Phase 3 | Immutable-once-published; `isCurrent` marks the active one |
| ChecklistSection | Phase 3    | Belongs to a version; ordered by `sequence`        |
| ChecklistQuestion| Phase 3    | Belongs to a section; type as string; per-type extras |
| Inspection       | Phase 5    | Unique `(equipmentId, periodKey)`, immutable once COMPLETED |
| InspectionResponse | Phase 5  | Snapshots question fields at submission time       |
| InspectionAttachment | Phase 5 | Photo metadata; on-disk path resolved via `fileStorage` |
| CorrectiveAction | Phase 6    | Human-readable `code`, per-unit; lifecycle status; immutable when CLOSED |
| CorrectiveActionAttachment | Phase 6 | Evidence with lifecycle `stage` (EVIDENCE/RESOLUTION/CLOSURE) |
| AuditLog         | Phase 1    | Actor / action / entity / metadata / createdAt     |

No further business models are planned before Phase 10.

Historical inspection records are never physically deleted; entities
that support deactivation carry an `isActive` flag rather than being
removed. Equipment additionally has an operational `status` that is
distinct from `isActive`.

Indexes are already in place on `qrCodeValue` (unique), `equipmentCode`
(unique), `Equipment.unitId`, `Equipment.equipmentTypeId`,
`Equipment.status`, `Equipment.isActive`, `Department.unitId`,
`User.roleId`, `User.unitId`, `AuditLog.actorId`,
`AuditLog.(entityType, entityId)`, `AuditLog.action`,
`AuditLog.createdAt`, `Session.userId`, `Session.expiresAt`.
