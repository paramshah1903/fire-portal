import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/equipmentService.js';
import * as checklistService from '../services/checklistTemplateService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { forbidden } from '../lib/errors.js';
import { ROLE_KEYS } from '../lib/rbac.js';
import {
  EQUIPMENT_STATUSES,
  type EquipmentStatus,
} from '../lib/equipmentCodes.js';

const statusEnum = z.enum(EQUIPMENT_STATUSES);

const createSchema = z.object({
  equipmentCode: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  equipmentTypeId: z.string().min(1),
  serialNumber: z.string().max(120).optional().nullable(),
  manufacturer: z.string().max(120).optional().nullable(),
  model: z.string().max(120).optional().nullable(),
  capacity: z.string().max(120).optional().nullable(),
  assetNumber: z.string().max(120).optional().nullable(),
  installationDate: z.string().optional().nullable(),
  unitId: z.string().min(1),
  departmentId: z.string().optional().nullable(),
  area: z.string().max(200).optional().nullable(),
  building: z.string().max(200).optional().nullable(),
  floor: z.string().max(50).optional().nullable(),
  location: z.string().max(400).optional().nullable(),
  exactLocation: z.string().max(400).optional().nullable(),
  status: statusEnum.optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

function actorCanTouchUnit(
  roleKey: string,
  actorUnitId: string | null,
  targetUnitId: string,
): boolean {
  if (roleKey === ROLE_KEYS.SUPER_ADMIN || roleKey === ROLE_KEYS.CENTRAL_ADMIN) {
    return true;
  }
  return !!actorUnitId && actorUnitId === targetUnitId;
}

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const actor = req.user!;
  const requestedUnitId =
    typeof req.query.unitId === 'string' ? req.query.unitId : undefined;

  const scopeUnitId =
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
      ? undefined
      : actor.unitId ?? '__none__'; // '__none__' guarantees empty result

  const page =
    typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number.parseInt(req.query.pageSize, 10)
      : 25;

  const status =
    typeof req.query.status === 'string'
      ? (req.query.status as EquipmentStatus)
      : undefined;

  const result = await service.listEquipment({
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    unitId: requestedUnitId,
    equipmentTypeId:
      typeof req.query.equipmentTypeId === 'string'
        ? req.query.equipmentTypeId
        : undefined,
    status,
    includeInactive: req.query.includeInactive === 'true',
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
    scopeUnitId,
  });
  res.json(result);
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const item = await service.getEquipment(req.params.id);
  const actor = req.user!;
  if (!actorCanTouchUnit(actor.roleKey, actor.unitId, item.unitId)) {
    throw forbidden('You cannot view equipment outside your unit.');
  }
  res.json({ equipment: item });
});

export const lookup: RequestHandler = asyncHandler(async (req, res) => {
  const value = String(req.query.value ?? '').trim();
  if (!value) {
    res.status(400).json({
      error: {
        code: 'MISSING_VALUE',
        message: 'Provide a code or QR value in the "value" query param.',
      },
    });
    return;
  }
  const item = await service.getEquipmentByCodeOrQr(value);
  const actor = req.user!;
  if (!actorCanTouchUnit(actor.roleKey, actor.unitId, item.unitId)) {
    throw forbidden('You cannot view equipment outside your unit.');
  }
  res.json({ equipment: item });
});

export const getApplicableChecklist: RequestHandler = asyncHandler(
  async (req, res) => {
    const item = await service.getEquipment(req.params.id);
    const actor = req.user!;
    if (!actorCanTouchUnit(actor.roleKey, actor.unitId, item.unitId)) {
      throw forbidden('You cannot view equipment outside your unit.');
    }
    const checklist = await checklistService.findApplicableChecklistForEquipment(
      req.params.id,
    );
    res.json({ checklist });
  },
);

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createSchema.parse(req.body);
  const actor = req.user!;
  if (!actorCanTouchUnit(actor.roleKey, actor.unitId, parsed.unitId)) {
    throw forbidden('You cannot create equipment outside your unit.');
  }
  const item = await service.createEquipment(parsed);
  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.EQUIPMENT_CREATE,
    entityType: 'Equipment',
    entityId: item.id,
    metadata: {
      equipmentCode: item.equipmentCode,
      qrCodeValue: item.qrCodeValue,
      unitId: item.unitId,
    },
  });
  res.status(201).json({ equipment: item });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateSchema.parse(req.body);
  const actor = req.user!;

  const existing = await service.getEquipment(req.params.id);
  if (!actorCanTouchUnit(actor.roleKey, actor.unitId, existing.unitId)) {
    throw forbidden('You cannot update equipment outside your unit.');
  }
  if (
    parsed.unitId &&
    !actorCanTouchUnit(actor.roleKey, actor.unitId, parsed.unitId)
  ) {
    throw forbidden('You cannot move equipment to another unit.');
  }

  const { before, after } = await service.updateEquipment(req.params.id, parsed);
  const statusChanged = before.status !== after.status;
  const deactivated = before.isActive && !after.isActive;

  await writeAudit({
    actorId: actor.id,
    action: deactivated
      ? AUDIT_ACTIONS.EQUIPMENT_DEACTIVATE
      : statusChanged
        ? AUDIT_ACTIONS.EQUIPMENT_STATUS_CHANGE
        : AUDIT_ACTIONS.EQUIPMENT_UPDATE,
    entityType: 'Equipment',
    entityId: after.id,
    metadata: {
      equipmentCode: after.equipmentCode,
      statusBefore: before.status,
      statusAfter: after.status,
      isActiveBefore: before.isActive,
      isActiveAfter: after.isActive,
    },
  });

  res.json({ equipment: after });
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteEquipment(req.params.id);
  await writeAudit({
    actorId: req.user?.id,
    action: 'equipment.delete',
    entityType: 'Equipment',
    entityId: req.params.id,
  });
  res.status(204).end();
});
