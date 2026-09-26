# Role-Based Access Control

RBAC is enforced on the **backend**. The frontend hides unauthorized
navigation and controls for a better UX, but backend checks are the
source of truth.

## Roles

Seeded and immutable (`isSystem = true`).

### Super Admin (`SUPER_ADMIN`)
Full system access across all units. Only a Super Admin can create/edit
another Super Admin.

### Central Fire/Safety Admin (`CENTRAL_ADMIN`)
Manages equipment, checklists, inspections, corrective actions,
reports, units, and users across the whole company. Cannot manage roles
or reset a Super Admin's password.

### Unit Admin (`UNIT_ADMIN`)
Manages users, equipment, inspections, and corrective actions **within
their assigned unit** only. Cannot manage units themselves or create
Super Admins.

### Inspector (`INSPECTOR`)
Scans equipment, performs inspections, raises corrective actions,
views inspection history. Cannot manage equipment, checklist templates
or users.

### Viewer (`VIEWER`)
Read-only for dashboards, equipment, inspections, corrective actions
and reports.

## Enforcement

- Route-level middleware `requirePermissions(...keys)` in
  `backend/src/middleware/auth.ts` checks every mutating and viewing
  endpoint.
- The user controller additionally scopes non-central-admin actors to
  their own unit and blocks role escalation.
- Deactivating a user or resetting their password revokes all active
  sessions.
- Login is rate-limited (20 per 15 min per IP).
- All auth events (login success, login failure with reason, logout,
  user changes, unit/department changes) are written to `AuditLog`.
- Password hashing uses bcrypt with 10 rounds.
- Session records live in the `Session` table; cookies are HTTP-only,
  signed with `SESSION_SECRET`, `sameSite=lax`, `secure` in production.

## Permissions matrix

| Permission (key)              | Super Admin | Central Admin | Unit Admin | Inspector | Viewer |
| ----------------------------- | :---------: | :-----------: | :--------: | :-------: | :----: |
| user.manage                   | ✓           | ✓             | ✓ (scoped) |           |        |
| user.view                     | ✓           | ✓             | ✓          |           |        |
| role.manage                   | ✓           |               |            |           |        |
| unit.manage                   | ✓           | ✓             |            |           |        |
| unit.view                     | ✓           | ✓             | ✓          | ✓         | ✓      |
| department.manage             | ✓           | ✓             | ✓          |           |        |
| department.view               | ✓           | ✓             | ✓          | ✓         | ✓      |
| equipment.manage              | ✓           | ✓             | ✓          |           |        |
| equipment.view                | ✓           | ✓             | ✓          | ✓         | ✓      |
| checklist.manage              | ✓           | ✓             |            |           |        |
| checklist.view                | ✓           | ✓             | ✓          | ✓         | ✓      |
| inspection.perform            | ✓           | ✓             | ✓          | ✓         |        |
| inspection.view               | ✓           | ✓             | ✓          | ✓         | ✓      |
| corrective_action.create      | ✓           | ✓             | ✓          | ✓         |        |
| corrective_action.close       | ✓           | ✓             | ✓          |           |        |
| corrective_action.view        | ✓           | ✓             | ✓          | ✓         | ✓      |
| report.view                   | ✓           | ✓             | ✓          | ✓         | ✓      |
| audit.view                    | ✓           | ✓             |            |           |        |

The seed keeps the mapping in sync — see `backend/src/lib/rbac.ts`.
