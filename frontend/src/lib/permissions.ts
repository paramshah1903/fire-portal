/**
 * Frontend mirror of backend permission/role keys.
 * Keep in sync with backend/src/lib/rbac.ts. These are used only for
 * UX (hiding nav / disabling buttons). The backend re-checks every
 * request, so this list is not security-sensitive.
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  CENTRAL_ADMIN: 'CENTRAL_ADMIN',
  UNIT_ADMIN: 'UNIT_ADMIN',
  INSPECTOR: 'INSPECTOR',
  VIEWER: 'VIEWER',
} as const;

export type RoleKey = (typeof ROLES)[keyof typeof ROLES];

export const PERMS = {
  USER_MANAGE: 'user.manage',
  USER_VIEW: 'user.view',
  ROLE_MANAGE: 'role.manage',
  UNIT_MANAGE: 'unit.manage',
  UNIT_VIEW: 'unit.view',
  DEPARTMENT_MANAGE: 'department.manage',
  DEPARTMENT_VIEW: 'department.view',
  EQUIPMENT_MANAGE: 'equipment.manage',
  EQUIPMENT_VIEW: 'equipment.view',
  CHECKLIST_MANAGE: 'checklist.manage',
  CHECKLIST_VIEW: 'checklist.view',
  INSPECTION_PERFORM: 'inspection.perform',
  INSPECTION_VIEW: 'inspection.view',
  CORRECTIVE_ACTION_CREATE: 'corrective_action.create',
  CORRECTIVE_ACTION_CLOSE: 'corrective_action.close',
  CORRECTIVE_ACTION_VIEW: 'corrective_action.view',
  REPORT_VIEW: 'report.view',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermKey = (typeof PERMS)[keyof typeof PERMS];
