import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/roleService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const createRoleSchema = z.object({
  key: z.string().min(2).max(50),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  permissionKeys: z.array(z.string()).default([]),
});

const updateRoleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  permissionKeys: z.array(z.string()).optional(),
});

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

export const listRoles: RequestHandler = asyncHandler(async (_req, res) => {
  const roles = await service.listRoles();
  res.json({ roles });
});

export const getRole: RequestHandler = asyncHandler(async (req, res) => {
  const role = await service.getRole(req.params.id);
  res.json({ role });
});

export const listPermissions: RequestHandler = asyncHandler(
  async (_req, res) => {
    const permissions = await service.listPermissions();
    res.json({ permissions });
  },
);

export const createRole: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createRoleSchema.parse(req.body);
  const role = await service.createRole(parsed);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.ROLE_CREATE ?? 'role.create',
    entityType: 'Role',
    entityId: role.id,
    metadata: { key: role.key, name: role.name },
  });
  res.status(201).json({ role });
});

export const updateRole: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateRoleSchema.parse(req.body);
  const role = await service.updateRole(req.params.id, parsed);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.ROLE_UPDATE ?? 'role.update',
    entityType: 'Role',
    entityId: role.id,
    metadata: {
      key: role.key,
      permissionKeys: parsed.permissionKeys,
    },
  });
  res.json({ role });
});

export const deleteRole: RequestHandler = asyncHandler(async (req, res) => {
  await service.deleteRole(req.params.id);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.ROLE_DELETE ?? 'role.delete',
    entityType: 'Role',
    entityId: req.params.id,
  });
  res.status(204).end();
});
