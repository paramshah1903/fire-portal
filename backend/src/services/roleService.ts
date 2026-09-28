import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import {
  PERMISSION_KEYS,
  ROLE_KEYS,
  type PermissionKey,
  type RoleKey,
} from '../lib/rbac.js';

/**
 * Role administration — the "User Role master" surface.
 *
 * The five seeded roles are stored with isSystem=true. They cannot be
 * deleted and their `key` / `name` cannot be renamed (code paths still
 * depend on those keys). Their permission sets, however, *can* be
 * edited — with one hard rule: SUPER_ADMIN is fully immutable to
 * prevent the operator from locking themselves out of the system.
 *
 * Custom roles (isSystem=false) support full CRUD.
 */

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------

const roleInclude = {
  permissions: {
    include: { permission: { select: { id: true, key: true, description: true } } },
  },
  _count: { select: { users: true } },
} as const;

export async function listRoles() {
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: roleInclude,
  });
  return roles.map(shape);
}

export async function getRole(id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: roleInclude,
  });
  if (!role) throw notFound('Role not found.');
  return shape(role);
}

export async function listPermissions() {
  const rows = await prisma.permission.findMany({
    orderBy: { key: 'asc' },
    select: { id: true, key: true, description: true },
  });
  return rows;
}

// -----------------------------------------------------------------------------
// Write
// -----------------------------------------------------------------------------

export interface CreateRoleInput {
  key: string;
  name: string;
  description?: string | null;
  permissionKeys: string[];
}

export async function createRole(input: CreateRoleInput) {
  const key = input.key.trim().toUpperCase();
  const name = input.name.trim();
  if (!/^[A-Z][A-Z0-9_]{1,49}$/.test(key)) {
    throw badRequest(
      'Role key must be UPPER_CASE letters, digits, underscores; start with a letter.',
      'INVALID_ROLE_KEY',
    );
  }
  if (!name) {
    throw badRequest('Name is required.', 'INVALID_ROLE_NAME');
  }
  if (isReservedKey(key)) {
    throw conflict(
      `"${key}" is a reserved system-role key.`,
      'RESERVED_ROLE_KEY',
    );
  }
  // Ensure the permission keys resolve.
  const permissions = await lookupPermissions(input.permissionKeys);

  const existing = await prisma.role.findUnique({ where: { key } });
  if (existing) {
    throw conflict(`Role "${key}" already exists.`, 'DUPLICATE_ROLE_KEY');
  }

  return prisma.$transaction(async (tx) => {
    const role = await tx.role.create({
      data: {
        key,
        name,
        description: input.description?.trim() || null,
        isSystem: false,
        permissions: {
          create: permissions.map((p) => ({ permissionId: p.id })),
        },
      },
    });
    return tx.role.findUniqueOrThrow({
      where: { id: role.id },
      include: roleInclude,
    }).then(shape);
  });
}

export interface UpdateRoleInput {
  name?: string;
  description?: string | null;
  permissionKeys?: string[];
}

export async function updateRole(id: string, input: UpdateRoleInput) {
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) throw notFound('Role not found.');

  // Guardrail #1: SUPER_ADMIN is immutable so admins can never lock
  // themselves out by removing their own permissions.
  if (existing.key === ROLE_KEYS.SUPER_ADMIN) {
    throw forbidden(
      'The Super Admin role is immutable — it always has every permission.',
    );
  }

  // Guardrail #2: System roles keep their name (code paths depend on it).
  const nextName =
    input.name !== undefined && !existing.isSystem
      ? input.name.trim()
      : undefined;

  const nextDescription =
    input.description === undefined
      ? undefined
      : input.description?.trim() || null;

  let permissionsForReplacement:
    | { permissionId: string }[]
    | undefined;
  if (input.permissionKeys) {
    const permissions = await lookupPermissions(input.permissionKeys);
    permissionsForReplacement = permissions.map((p) => ({
      permissionId: p.id,
    }));
  }

  return prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id },
      data: {
        name: nextName,
        description: nextDescription,
      },
    });
    if (permissionsForReplacement) {
      // Full replacement of the role's permission set.
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      if (permissionsForReplacement.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionsForReplacement.map((p) => ({
            roleId: id,
            permissionId: p.permissionId,
          })),
        });
      }
    }
    return tx.role
      .findUniqueOrThrow({ where: { id }, include: roleInclude })
      .then(shape);
  });
}

export async function deleteRole(id: string) {
  const existing = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) throw notFound('Role not found.');
  if (existing.isSystem) {
    throw forbidden('System roles cannot be deleted.');
  }
  if (existing._count.users > 0) {
    throw conflict(
      `Cannot delete: ${existing._count.users} user(s) are still assigned to this role.`,
      'ROLE_IN_USE',
    );
  }
  await prisma.role.delete({ where: { id } });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function lookupPermissions(permissionKeys: string[]) {
  const uniq = Array.from(new Set(permissionKeys));
  if (uniq.length === 0) return [];
  // Validate keys against the compile-time list first — anything not
  // recognised should not silently succeed.
  const validSet = new Set<string>(Object.values(PERMISSION_KEYS));
  const unknown = uniq.filter((k) => !validSet.has(k));
  if (unknown.length > 0) {
    throw badRequest(
      `Unknown permission(s): ${unknown.join(', ')}`,
      'INVALID_PERMISSIONS',
    );
  }
  return prisma.permission.findMany({
    where: { key: { in: uniq } },
    select: { id: true, key: true },
  });
}

function isReservedKey(key: string): boolean {
  return (Object.values(ROLE_KEYS) as string[]).includes(key);
}

function shape(role: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
  permissions: { permission: { key: string; description: string | null } }[];
  _count: { users: number };
}) {
  return {
    id: role.id,
    key: role.key,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
    userCount: role._count.users,
    permissionKeys: role.permissions.map((rp) => rp.permission.key),
  };
}

export type RoleWithPermissions = Awaited<ReturnType<typeof shape>>;

// Re-export for typed callers
export type { PermissionKey, RoleKey };
