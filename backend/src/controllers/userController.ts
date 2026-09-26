import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as userService from '../services/userService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { ROLE_KEYS, type RoleKey } from '../lib/rbac.js';
import { prisma } from '../lib/prisma.js';

const roleKeyEnum = z.enum([
  ROLE_KEYS.SUPER_ADMIN,
  ROLE_KEYS.CENTRAL_ADMIN,
  ROLE_KEYS.UNIT_ADMIN,
  ROLE_KEYS.INSPECTOR,
  ROLE_KEYS.VIEWER,
]);

const createSchema = z.object({
  username: z.string().min(3).max(32),
  fullName: z.string().min(1).max(120),
  email: z.string().email().optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),
  employeeId: z.string().max(50).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  password: z.string().min(8).max(200),
  roleKey: roleKeyEnum,
  unitId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  email: z.string().email().optional().nullable(),
  mobile: z.string().max(30).optional().nullable(),
  employeeId: z.string().max(50).optional().nullable(),
  designation: z.string().max(120).optional().nullable(),
  roleKey: roleKeyEnum.optional(),
  unitId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  newPassword: z.string().min(8).max(200),
});

/**
 * Non-super-admin actors cannot manage users outside their unit and
 * cannot create/edit super admins.
 */
function assertRoleAssignmentAllowed(actorRole: RoleKey, targetRole: RoleKey) {
  if (actorRole === ROLE_KEYS.SUPER_ADMIN) return;
  if (targetRole === ROLE_KEYS.SUPER_ADMIN) {
    throw forbidden('Only a Super Admin can assign the Super Admin role.');
  }
}

async function assertScopeAllowedForUnit(
  actor: { roleKey: string; unitId: string | null },
  unitId: string | null | undefined,
) {
  if (actor.roleKey === ROLE_KEYS.SUPER_ADMIN) return;
  if (actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN) return;
  // Unit-scoped actors can only manage users inside their own unit.
  if (!actor.unitId) throw forbidden('You are not scoped to a unit.');
  if (unitId && unitId !== actor.unitId) {
    throw forbidden('You cannot manage users outside your unit.');
  }
}

export const listUsers: RequestHandler = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const requestedUnitId =
    typeof req.query.unitId === 'string' ? req.query.unitId : undefined;

  const actor = req.user!;
  const unitId =
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
      ? requestedUnitId
      : actor.unitId ?? undefined;

  const users = await userService.listUsers({
    unitId,
    includeInactive,
    search,
  });
  res.json({ users });
});

export const getUser: RequestHandler = asyncHandler(async (req, res) => {
  const user = await userService.getUser(req.params.id);
  const actor = req.user!;
  if (
    actor.roleKey !== ROLE_KEYS.SUPER_ADMIN &&
    actor.roleKey !== ROLE_KEYS.CENTRAL_ADMIN &&
    user.unitId !== actor.unitId
  ) {
    throw forbidden('You cannot view users outside your unit.');
  }
  res.json({ user });
});

export const createUser: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createSchema.parse(req.body);
  const actor = req.user!;
  assertRoleAssignmentAllowed(actor.roleKey as RoleKey, parsed.roleKey);
  await assertScopeAllowedForUnit(actor, parsed.unitId ?? null);

  const user = await userService.createUser(parsed);
  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.USER_CREATE,
    entityType: 'User',
    entityId: user.id,
    metadata: {
      username: user.username,
      roleKey: parsed.roleKey,
      unitId: user.unitId,
    },
  });
  res.status(201).json({ user });
});

export const updateUser: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateSchema.parse(req.body);
  const actor = req.user!;

  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });
  if (!existing) throw notFound('User not found.');

  await assertScopeAllowedForUnit(actor, existing.unitId);
  await assertScopeAllowedForUnit(actor, parsed.unitId ?? existing.unitId);
  if (parsed.roleKey) {
    assertRoleAssignmentAllowed(actor.roleKey as RoleKey, parsed.roleKey);
    if (existing.role.key === ROLE_KEYS.SUPER_ADMIN && actor.roleKey !== ROLE_KEYS.SUPER_ADMIN) {
      throw forbidden('Only a Super Admin can modify a Super Admin.');
    }
  }
  if (existing.id === actor.id && parsed.isActive === false) {
    throw badRequest('You cannot deactivate your own account.', 'SELF_DEACTIVATE');
  }

  const user = await userService.updateUser(req.params.id, parsed);
  const action =
    parsed.isActive === false
      ? AUDIT_ACTIONS.USER_DEACTIVATE
      : parsed.isActive === true
        ? AUDIT_ACTIONS.USER_ACTIVATE
        : AUDIT_ACTIONS.USER_UPDATE;
  await writeAudit({
    actorId: actor.id,
    action,
    entityType: 'User',
    entityId: user.id,
    metadata: parsed,
  });
  res.json({ user });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = resetPasswordSchema.parse(req.body);
  const actor = req.user!;
  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { role: true },
  });
  if (!existing) throw notFound('User not found.');
  await assertScopeAllowedForUnit(actor, existing.unitId);
  if (existing.role.key === ROLE_KEYS.SUPER_ADMIN && actor.roleKey !== ROLE_KEYS.SUPER_ADMIN) {
    throw forbidden('Only a Super Admin can reset a Super Admin password.');
  }

  await userService.resetPassword(req.params.id, parsed.newPassword);
  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.USER_RESET_PASSWORD,
    entityType: 'User',
    entityId: req.params.id,
  });
  res.json({ ok: true });
});

export const listRoles: RequestHandler = asyncHandler(async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, key: true, name: true, description: true },
  });
  res.json({ roles });
});
