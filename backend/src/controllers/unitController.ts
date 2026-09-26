import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as unitService from '../services/unitService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';

const unitCreateSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  location: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const unitUpdateSchema = unitCreateSchema.partial();

export const listUnits: RequestHandler = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const units = await unitService.listUnits({ includeInactive });
  res.json({ units });
});

export const getUnit: RequestHandler = asyncHandler(async (req, res) => {
  const unit = await unitService.getUnit(req.params.id);
  res.json({ unit });
});

export const createUnit: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = unitCreateSchema.parse(req.body);
  const unit = await unitService.createUnit(parsed);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.UNIT_CREATE,
    entityType: 'Unit',
    entityId: unit.id,
    metadata: { code: unit.code, name: unit.name },
  });
  res.status(201).json({ unit });
});

export const updateUnit: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = unitUpdateSchema.parse(req.body);
  const unit = await unitService.updateUnit(req.params.id, parsed);
  await writeAudit({
    actorId: req.user?.id,
    action:
      parsed.isActive === false
        ? AUDIT_ACTIONS.UNIT_DEACTIVATE
        : AUDIT_ACTIONS.UNIT_UPDATE,
    entityType: 'Unit',
    entityId: unit.id,
    metadata: parsed,
  });
  res.json({ unit });
});
