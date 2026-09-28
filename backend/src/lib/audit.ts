import { prisma } from './prisma.js';

export interface AuditPayload {
  actorId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Fire-and-forget audit-log writer. Failures are logged but never
 * bubble up — audit logging must never break a business request.
 */
export async function writeAudit(payload: AuditPayload): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: payload.actorId ?? null,
        action: payload.action,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        metadata: payload.metadata ? JSON.stringify(payload.metadata) : null,
      },
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err);
  }
}

export const AUDIT_ACTIONS = {
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILURE: 'auth.login.failure',
  LOGOUT: 'auth.logout',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DEACTIVATE: 'user.deactivate',
  USER_ACTIVATE: 'user.activate',
  USER_RESET_PASSWORD: 'user.reset_password',
  ROLE_CREATE: 'role.create',
  ROLE_UPDATE: 'role.update',
  ROLE_DELETE: 'role.delete',
  UNIT_CREATE: 'unit.create',
  UNIT_UPDATE: 'unit.update',
  UNIT_DEACTIVATE: 'unit.deactivate',
  DEPARTMENT_CREATE: 'department.create',
  DEPARTMENT_UPDATE: 'department.update',
  DEPARTMENT_DEACTIVATE: 'department.deactivate',
  EQUIPMENT_TYPE_CREATE: 'equipment_type.create',
  EQUIPMENT_TYPE_UPDATE: 'equipment_type.update',
  EQUIPMENT_CREATE: 'equipment.create',
  EQUIPMENT_UPDATE: 'equipment.update',
  EQUIPMENT_STATUS_CHANGE: 'equipment.status_change',
  EQUIPMENT_DEACTIVATE: 'equipment.deactivate',
  EQUIPMENT_BULK_IMPORT: 'equipment.bulk_import',
  CHECKLIST_TEMPLATE_CREATE: 'checklist_template.create',
  CHECKLIST_TEMPLATE_UPDATE: 'checklist_template.update',
  CHECKLIST_TEMPLATE_DEACTIVATE: 'checklist_template.deactivate',
  CHECKLIST_VERSION_CREATE_DRAFT: 'checklist_version.create_draft',
  CHECKLIST_VERSION_UPDATE_DRAFT: 'checklist_version.update_draft',
  CHECKLIST_VERSION_PUBLISH: 'checklist_version.publish',
  INSPECTION_START: 'inspection.start',
  INSPECTION_SAVE_PROGRESS: 'inspection.save_progress',
  INSPECTION_SUBMIT: 'inspection.submit',
  INSPECTION_ATTACHMENT_UPLOAD: 'inspection.attachment.upload',
  CORRECTIVE_ACTION_CREATE: 'corrective_action.create',
  CORRECTIVE_ACTION_AUTO_CREATE: 'corrective_action.auto_create',
  CORRECTIVE_ACTION_UPDATE: 'corrective_action.update',
  CORRECTIVE_ACTION_ASSIGN: 'corrective_action.assign',
  CORRECTIVE_ACTION_PROGRESS: 'corrective_action.progress',
  CORRECTIVE_ACTION_RESOLVE: 'corrective_action.resolve',
  CORRECTIVE_ACTION_CLOSE: 'corrective_action.close',
  CORRECTIVE_ACTION_ATTACHMENT_UPLOAD: 'corrective_action.attachment.upload',
} as const;
