import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as departmentService from '../services/departmentService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';

const createSchema = z.object({
  unitId: z.string().min(1),
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const listDepartments: RequestHandler = asyncHandler(async (req, res) => {
  const unitId = typeof req.query.unitId === 'string' ? req.query.unitId : undefined;
  const includeInactive = req.query.includeInactive === 'true';
  const departments = await departmentService.listDepartments({
    unitId,
    includeInactive,
  });
  res.json({ departments });
});

export const getDepartment: RequestHandler = asyncHandler(async (req, res) => {
  const department = await departmentService.getDepartment(req.params.id);
  res.json({ department });
});

export const createDepartment: RequestHandler = asyncHandler(
  async (req, res) => {
    const parsed = createSchema.parse(req.body);
    const department = await departmentService.createDepartment(parsed);
    await writeAudit({
      actorId: req.user?.id,
      action: AUDIT_ACTIONS.DEPARTMENT_CREATE,
      entityType: 'Department',
      entityId: department.id,
      metadata: { code: department.code, unitId: department.unitId },
    });
    res.status(201).json({ department });
  },
);

export const updateDepartment: RequestHandler = asyncHandler(
  async (req, res) => {
    const parsed = updateSchema.parse(req.body);
    const department = await departmentService.updateDepartment(
      req.params.id,
      parsed,
    );
    await writeAudit({
      actorId: req.user?.id,
      action:
        parsed.isActive === false
          ? AUDIT_ACTIONS.DEPARTMENT_DEACTIVATE
          : AUDIT_ACTIONS.DEPARTMENT_UPDATE,
      entityType: 'Department',
      entityId: department.id,
      metadata: parsed,
    });
    res.json({ department });
  },
);
