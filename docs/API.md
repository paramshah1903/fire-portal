# REST API

Base URL (development): `http://localhost:4000/api`

Content type: `application/json`. Authentication is a signed HTTP-only
cookie (`upl.sid` by default) established by `POST /auth/login`. All
subsequent requests must include the cookie (Axios does this
automatically with `withCredentials: true`).

## Error envelope

```json
{
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": [ /* only for VALIDATION_ERROR */ ]
  }
}
```

Common status/code pairs: `401 UNAUTHORIZED`, `403 FORBIDDEN`,
`400 VALIDATION_ERROR` (with `details`), `404 NOT_FOUND`,
`409 CONFLICT` (with a specific code like `USERNAME_TAKEN`),
`429 RATE_LIMITED`.

---

## Phase 0

### `GET /api/health`
Liveness check. Also probes SQLite with `SELECT 1`.
Returns `200 { status: "ok", database: "ok", ... }` or `503`.

---

## Phase 1 — Authentication / RBAC / Users / Units / Departments

### Authentication

#### `POST /api/auth/login`
Public. Rate limited (20 per 15 min per IP).

```json
{ "username": "admin", "password": "Admin@123" }
```

`200`: sets `upl.sid` cookie, returns `{ user, expiresAt }`.
`401 UNAUTHORIZED` on unknown user, bad password, or inactive account.

#### `POST /api/auth/logout`
Deletes the current session server-side and clears the cookie.

#### `GET /api/auth/me`
Requires auth. Returns `{ user }` where `user` includes:

```
id, username, fullName, email, isActive,
roleKey, roleName, permissions[], unitId, departmentId
```

### Units — `user.view` / `unit.manage` required

- `GET /api/units?includeInactive=true` — `unit.view`
- `GET /api/units/:id` — `unit.view` (includes departments)
- `POST /api/units` — `unit.manage`
- `PUT /api/units/:id` — `unit.manage`

### Departments

- `GET /api/departments?unitId=…&includeInactive=…` — `department.view`
- `GET /api/departments/:id` — `department.view`
- `POST /api/departments` — `department.manage`
- `PUT /api/departments/:id` — `department.manage`

Departments have `unique(unitId, code)`.

### Users

- `GET /api/users?search=…&unitId=…&includeInactive=…` — `user.view`.
  Non-super-admin/central-admin callers are automatically scoped to
  their own unit.
- `GET /api/users/:id` — `user.view`
- `POST /api/users` — `user.manage`. Unit-admins cannot create users
  outside their unit or with the `SUPER_ADMIN` role.
- `PUT /api/users/:id` — `user.manage`. Same scope rules.
  Deactivating a user destroys their sessions. You cannot deactivate
  your own account.
- `POST /api/users/:id/reset-password` — `user.manage`. Body:
  `{ "newPassword": "…" }`. All of that user's sessions are revoked.
- `GET /api/users/roles` — `user.view`. Lists all roles (for the UI).

Password policy: at least 8 chars, one letter, one digit.

---

## Phase 2 — Equipment Types + Equipment + Bulk Import

### Equipment Types

- `GET /api/equipment-types?includeInactive=…` — `equipment.view`
- `GET /api/equipment-types/:id` — `equipment.view`
- `POST /api/equipment-types` — `equipment.manage`
  Body: `{ key, name, description?, inspectionFrequencyDays?, isActive? }`.
  `key` is normalised (uppercase + underscores).
- `PUT /api/equipment-types/:id` — `equipment.manage`

### Equipment

- `GET /api/equipment` — `equipment.view`. Query params:
  `search`, `unitId`, `equipmentTypeId`, `status`, `includeInactive`,
  `page` (default 1), `pageSize` (default 25, max 200).
  Non-central/super callers are automatically scoped to their unit.
  Response: `{ total, page, pageSize, rows: Equipment[] }`.
- `GET /api/equipment/:id` — `equipment.view` (unit-scoped).
- `GET /api/equipment/lookup?value=<code or QR>` — `equipment.view`
  (unit-scoped). Used by the Phase 4 QR-scan flow.
- `POST /api/equipment` — `equipment.manage`. Body accepts all
  `EquipmentInput` fields. `qrCodeValue` is generated server-side.
- `PUT /api/equipment/:id` — `equipment.manage`. Cannot move equipment
  to a unit outside your scope.

Status values: `ACTIVE`, `UNDER_MAINTENANCE`, `OUT_OF_SERVICE`,
`RETIRED`. `isActive=false` or `status=RETIRED` excludes an item from
monthly inspection schedules.

### Bulk import — `equipment.manage`

- `GET /api/equipment/import/template`
  Returns `text/csv` with the expected header row and one sample row.

- `POST /api/equipment/import/preview`
  `multipart/form-data` with field `file` (CSV/XLS/XLSX, max 5 MB).
  Parses, validates, and returns:
  ```json
  {
    "rows": [ /* per-row: parsed values + errors[] */ ],
    "summary": {
      "total": 10, "valid": 8, "invalid": 2,
      "duplicatesInFile": 0, "duplicatesInDb": 1
    }
  }
  ```
  Header names are case-insensitive; spaces and underscores are interchangeable.

- `POST /api/equipment/import/commit`
  Body: `{ rows: ImportRow[] }` (the rows array from preview).
  Rows are re-validated server-side. Only rows with no errors are
  inserted, in a single transaction. Unit-scoped callers can only
  insert rows for their own unit. Response:
  `{ inserted, skipped, summary }`.

Expected import columns:
```
equipment_code, name, equipment_type_key, unit_code,
department_code?, serial_number?, manufacturer?, model?, capacity?,
asset_number?, installation_date? (YYYY-MM-DD), area?, building?,
floor?, location?, exact_location?, status?
```

---

## Phase 3 — Checklist Templates (versioned)

Templates and versions are separate resources: a template is the logical
checklist (name, description, applicable units, equipment type,
frequency) and owns a sequence of versions. Only one version per template
is `isCurrent=true` at a time. Editing a published version is not
allowed — create a new draft (clones the current version) instead.

### Templates

- `GET /api/checklist-templates?includeInactive=…` — `checklist.view`
- `GET /api/checklist-templates/:id` — `checklist.view` (includes versions summary)
- `POST /api/checklist-templates` — `checklist.manage`
  Body: `{ name, description?, equipmentTypeId, frequencyDays?, applicableUnitIds? }`.
  Also creates an empty draft version 1.
- `PUT /api/checklist-templates/:id` — `checklist.manage`
  Body: `{ name?, description?, frequencyDays?, applicableUnitIds?, isActive? }`.
- `POST /api/checklist-templates/:id/versions` — `checklist.manage`.
  Creates a new DRAFT version — if a current published version exists,
  its sections/questions are cloned as the starting point. Fails with
  `409 DRAFT_EXISTS` if a draft is already open.

### Versions

- `GET /api/checklist-versions/:id` — `checklist.view`. Returns the
  full section + question tree.
- `PUT /api/checklist-versions/:id` — `checklist.manage`. Bulk-save
  the sections/questions of a DRAFT (only). Body:
  `{ sections: [{ title, description?, questions: [{ text, questionType, isMandatory, isSafetyCritical, requiresCorrectiveActionOnFail, optionsJson?, numericMin?, numericMax?, numericUnit?, helpText?, isActive? }] }] }`.
  Whole tree replaces the previous one so clients can freely reorder
  and add/remove.
- `POST /api/checklist-versions/:id/publish` — `checklist.manage`.
  Draft becomes `PUBLISHED` + `isCurrent=true`; the previously-current
  version is `ARCHIVED` + `isCurrent=false`. Fails with `EMPTY_TEMPLATE`
  if the version has no questions.

### Equipment lookup

- `GET /api/equipment/:id/applicable-checklist` — `equipment.view`.
  Resolves the current published version for this equipment. Preference:
  1. Template targeting the equipment's `equipmentType` and explicitly
     listing the equipment's `unit` in `applicableUnits`.
  2. Template targeting the equipment's `equipmentType` with no
     `applicableUnits` (applies to all).
  Returns `{ checklist: { template, version } | null }`.

### Question types

Stored as strings for SQLite portability. Frontend mirrors this list.

```
PASS_FAIL | YES_NO | NUMERIC | TEXT | DROPDOWN | DATE | PHOTO | REMARKS
```

Per-type extras: `optionsJson` (DROPDOWN, JSON string array of options),
`numericMin` / `numericMax` / `numericUnit` (NUMERIC).

---

## Phase 5 — Monthly Inspections

Every inspection is versioned against a specific `ChecklistTemplateVersion`
snapshot; response rows also snapshot each question's text/type/flags, so
historical records survive any future template edits. Unique
`(equipmentId, periodKey)` prevents duplicate monthly inspections; the
`start` endpoint returns the existing PENDING one when a caller retries.

### Schedule + list

- `GET /api/inspections/schedule?periodKey=YYYY-MM&unitId=&equipmentTypeId=&monthlyStatus=DUE|IN_PROGRESS|COMPLETED|OVERDUE`
  — `inspection.view`. Returns `{ periodKey, summary, rows }` combining
  every active applicable equipment with its inspection status for that
  period. Overdue is computed from `dueDate < now`.
- `GET /api/inspections?status=…&result=…&unitId=…&equipmentId=…&periodKey=…&page=&pageSize=` — `inspection.view`
- `GET /api/inspections/:id` — `inspection.view` (unit-scoped)
- `GET /api/equipment/:id/inspections` — `inspection.view`

### Perform workflow

- `POST /api/inspections/start` — `inspection.perform`.
  Body `{ equipmentId }`. Returns the existing PENDING inspection or
  creates a fresh one against the currently applicable checklist. Refuses
  if equipment is inactive/retired/out-of-service, or an inspection has
  already been COMPLETED for the current period.
- `PUT /api/inspections/:id` — `inspection.perform`.
  Body `{ responses: [...], remarks? }`. Upserts responses. Refuses if
  the inspection is `COMPLETED` (`INSPECTION_LOCKED`).
- `POST /api/inspections/:id/submit` — `inspection.perform`.
  Body `{ responses, remarks?, confirmationName }`. Re-saves responses
  first, then validates every mandatory question is answered
  (`MANDATORY_UNANSWERED`), stamps `COMPLETED`, computes
  `result = anyFail ? "FAIL" : "PASS"` and
  `hasSafetyCriticalFailure = anySafetyCriticalFail`. Immutable after.

### Photo attachments

- `POST /api/inspections/:id/attachments` — `inspection.perform`.
  `multipart/form-data`: `file` (JPEG/PNG/WEBP/HEIC ≤ 10 MB), optional
  `responseId`, optional `caption`. Server generates a safe filename
  under `UPLOAD_DIR/inspections/<id>/`; the FS path is never exposed.
- `GET /api/inspection-attachments/:id` — `inspection.view`,
  unit-scoped. Streams the file with its recorded mime-type.

### Auto-fail rules (compute at save/submit)

- `PASS_FAIL`: `valueString === "FAIL"` → fail
- `YES_NO`: `valueString === "NO"` → fail (design assumes questions phrase
  the desired answer as YES; invert the question wording otherwise)
- `NUMERIC`: `valueNumeric` outside `[numericMin, numericMax]` (either
  bound optional) → fail
- Other types are informational; the inspector can still add notes.

---

## Phase 6 — Corrective Actions

CAs are auto-created on inspection submit for every failed response
whose question had `requiresCorrectiveActionOnFail=true`; can also be
raised manually. Human-readable codes are per unit (`CA-A-00001`).

Priorities: `CRITICAL | HIGH | MEDIUM | LOW`.
Auto-created CAs get `HIGH` when the failed question was
safety-critical, otherwise `MEDIUM`.

Lifecycle: `OPEN → IN_PROGRESS → RESOLVED → CLOSED`. Once `CLOSED`, the
record is immutable. Only users with `corrective_action.close` can
transition RESOLVED → CLOSED. Resolution and closure both require
mandatory remarks.

### Endpoints

- `GET /api/corrective-actions?status=&priority=&unitId=&assigneeId=&equipmentId=&sourceInspectionId=&page=&pageSize=` — `corrective_action.view`
- `GET /api/corrective-actions/:id` — `corrective_action.view`
- `POST /api/corrective-actions` — `corrective_action.create`.
  Body: `{ equipmentId, title, description, priority?, assigneeId?, targetDate?, sourceInspectionId?, sourceResponseId?, failedItemText? }`.
- `PUT /api/corrective-actions/:id` — `corrective_action.create`.
  Metadata edits. Rejected if `CLOSED`.
- `POST /api/corrective-actions/:id/progress` — `corrective_action.create`.
- `POST /api/corrective-actions/:id/resolve` — `corrective_action.create`.
  Body: `{ resolutionRemarks }` (required).
- `POST /api/corrective-actions/:id/close` — `corrective_action.close`.
  Body: `{ closureRemarks }` (required). Refuses if not `RESOLVED`.

### Evidence attachments

- `POST /api/corrective-actions/:id/attachments` — `corrective_action.create`.
  `multipart/form-data`: `file` + optional `stage` (`EVIDENCE|RESOLUTION|CLOSURE`, default `EVIDENCE`) + optional `caption`.
- `GET /api/corrective-action-attachments/:id` — `corrective_action.view`.
  Streams the file with its recorded mime-type.

### Equipment endpoint

- `GET /api/equipment/:id/corrective-actions` — `corrective_action.view`.

---

## Phase 9 — Audit logs + security hardening

### Audit logs (RBAC: `audit.view`)

- `GET /api/audit-logs?actorId=&action=&entityType=&entityId=&search=&fromDate=&toDate=&page=&pageSize=`
  Returns `{ total, page, pageSize, rows }`. Rows include the actor
  (`{ id, username, fullName } | null`) and a JSON-encoded `metadata`
  string.
- `GET /api/audit-logs/actions` — distinct action keys, ordered.
- `GET /api/audit-logs/entity-types` — distinct entity types, ordered.

Only `SUPER_ADMIN` and `CENTRAL_ADMIN` currently have `audit.view`.
Every mutation across the app writes an audit row — see
`backend/src/lib/audit.ts` for the full action catalogue.

### Session

- Cookie: HTTP-only, signed, `sameSite=lax`, `secure` in production.
- **Sliding expiry**: each authenticated request extends `expiresAt`
  to `now + SESSION_MAX_AGE_MS` (throttled to at most one DB write
  per `SESSION_REFRESH_INTERVAL_MS`, default 5 min). Cookie is
  re-sent whenever the DB row is bumped so browser expiry stays in
  sync.
- **Absolute cap**: sessions cannot outlive
  `SESSION_ABSOLUTE_MAX_AGE_MS` (default 30 days) regardless of
  activity.
- Session records are deleted server-side on logout, deactivation,
  password reset, or expiry.

### Rate limits

Three limiters compose:

- **`POST /api/auth/login`** — 20 requests per 15 min per IP.
- **Global `/api/*`** — `RATE_LIMIT_GLOBAL_PER_MINUTE` (default 300)
  per IP.
- **Write `/api/*` (POST/PUT/PATCH/DELETE)** —
  `RATE_LIMIT_WRITE_PER_MINUTE` (default 60) per IP.

All limiters return `429 RATE_LIMITED` with the standard headers set.

### Security headers

Helmet defaults are enabled: `Content-Security-Policy`,
`Referrer-Policy: no-referrer`, `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`,
plus origin resource / cross-origin protections.

### Sensitive data

- Password hashes are stripped from every user response.
- Attachment on-disk paths are never returned to clients — files are
  streamed via ID-only endpoints.
- Uploaded filenames are server-generated; original filenames are
  stored for display only.

---

## Phase 8 — Dashboard

Single endpoint returning KPIs + chart data for the primary landing page.

- `GET /api/dashboard?periodKey=YYYY-MM&unitId=&equipmentTypeId=` — auth required.
  Non-central/super roles are auto-scoped to their own unit; the response
  echoes `scope.unitScoped` so the UI can label accordingly.

Response shape:

```json
{
  "periodKey": "2026-09",
  "scope": { "unitId": null, "equipmentTypeId": null, "roleKey": "SUPER_ADMIN", "unitScoped": false },
  "kpis": {
    "totalEquipment": 60, "activeEquipment": 60, "dueThisMonth": 60,
    "completed": 2, "inProgress": 4, "overdue": 0,
    "failedEquipment": 2, "openCorrectiveActions": 1
  },
  "charts": {
    "overallCompletionPct": 7.4,
    "unitCompletion": [
      { "unitCode": "UNIT-A", "completed": 2, "inProgress": 4, "overdue": 0, "due": 21, "total": 27, "completionPct": 7.4 }
    ],
    "statusDistribution": { "completed": 2, "inProgress": 4, "due": 54, "overdue": 0 },
    "topFailedItems": [
      { "questionText": "Is the safety pin and seal intact?", "failCount": 2, "safetyCriticalFailCount": 2 }
    ],
    "openCorrectiveActionsByPriority": { "CRITICAL": 0, "HIGH": 1, "MEDIUM": 0, "LOW": 0 }
  }
}
```

All values are computed live from the database — nothing is hard-coded.

---

## Phase 7 — Reports

All reports require `report.view`. Non-central roles are auto-scoped
to their own unit. Every report accepts a `format=json|csv|xlsx`
query parameter — `json` is the default and returns
`{ summary, rows, … }`, `csv` and `xlsx` stream a download.

- `GET /api/reports/compliance?periodKey=YYYY-MM&unitId=&equipmentTypeId=&format=`
  Per-equipment inspection status for one period. Summary includes
  totals, pass-rate, and safety-critical failure count.
- `GET /api/reports/unit-compliance?periodKey=&equipmentTypeId=&format=`
  Roll-up per unit with completion-rate and pass-rate percentages.
- `GET /api/reports/equipment-history?equipmentId=&format=`
  Full inspection history for one equipment.
- `GET /api/reports/failed-equipment?periodKey=&unitId=&format=`
  Currently non-compliant equipment (union of failed inspections and
  non-active statuses) with open corrective-action counts.
- `GET /api/reports/corrective-actions?status=&priority=&unitId=&raisedFrom=&raisedTo=&format=`
  Corrective-action list with days-open + summary (open/in-progress/
  resolved/closed/overdue counts and average time-to-close).

CSV output includes a UTF-8 BOM so Excel opens non-ASCII characters
correctly. XLSX is generated by ExcelJS with the same column set as CSV
so both formats stay in sync.

PDF export is deliberately handled by the browser's print dialog on
each report page — Chrome/Edge/Safari all support **Save as PDF**
out of the box, keeping the backend lean.

---

## Phase 4 — QR Management

Phase 4 is a **frontend feature**: no new backend endpoints are added.
QR image rendering, camera-based scanning, printable labels, and bulk
label sheets all consume `GET /api/equipment/lookup` and
`GET /api/equipment/:id` from Phase 2.

QR label payload format:

- Default: encodes `${window.location.origin}/s/<qrCodeValue>` so any
  camera app opens the portal at the right page.
- Override with `VITE_QR_URL_PREFIX="https://portal.upl/s"` to hard-code
  the deployed host (recommended for print runs), or
  `VITE_QR_PLAIN_PAYLOAD=true` to encode just the value.

The frontend's `parseScannedValue()` helper accepts either a raw value
or a URL and extracts the QR value before hitting `/api/equipment/lookup`.

---

## Planned endpoints (later phases)

_All planned endpoints are now implemented._
