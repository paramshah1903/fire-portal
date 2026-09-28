import { prisma } from '../lib/prisma.js';
import {
  badRequest,
  conflict,
  notFound,
} from '../lib/errors.js';
import {
  hashPassword,
  validatePasswordStrength,
} from '../lib/passwords.js';
import { destroyAllUserSessions } from '../lib/session.js';
import { ROLE_KEYS, type RoleKey } from '../lib/rbac.js';

export interface CreateUserInput {
  username: string;
  fullName: string;
  email?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  password: string;
  roleKey: RoleKey;
  unitId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  email?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
  designation?: string | null;
  roleKey?: RoleKey;
  unitId?: string | null;
  departmentId?: string | null;
  isActive?: boolean;
}

const userInclude = {
  role: { select: { id: true, key: true, name: true } },
  unit: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
} as const;

function stripHash<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _pw, ...rest } = user;
  return rest;
}

export interface ListUsersOptions {
  unitId?: string;
  includeInactive?: boolean;
  search?: string;
}

export async function listUsers(options: ListUsersOptions = {}) {
  const search = options.search?.trim();
  const users = await prisma.user.findMany({
    where: {
      unitId: options.unitId,
      isActive: options.includeInactive ? undefined : true,
      OR: search
        ? [
            { username: { contains: search } },
            { fullName: { contains: search } },
            { email: { contains: search } },
            { employeeId: { contains: search } },
          ]
        : undefined,
    },
    include: userInclude,
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
  });
  return users.map(stripHash);
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: userInclude,
  });
  if (!user) throw notFound('User not found.');
  return stripHash(user);
}

async function resolveRoleId(roleKey: RoleKey): Promise<string> {
  const role = await prisma.role.findUnique({ where: { key: roleKey } });
  if (!role) throw badRequest(`Unknown role "${roleKey}".`, 'UNKNOWN_ROLE');
  return role.id;
}

async function validateUnitAndDepartment(
  unitId?: string | null,
  departmentId?: string | null,
): Promise<void> {
  if (unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: unitId } });
    if (!unit) throw badRequest('Unit not found.', 'UNKNOWN_UNIT');
  }
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) throw badRequest('Department not found.', 'UNKNOWN_DEPARTMENT');
    if (unitId && dept.unitId !== unitId) {
      throw badRequest(
        'Department does not belong to the selected unit.',
        'DEPARTMENT_UNIT_MISMATCH',
      );
    }
  }
}

function requiresUnit(roleKey: RoleKey): boolean {
  return (
    roleKey === ROLE_KEYS.UNIT_ADMIN ||
    roleKey === ROLE_KEYS.INSPECTOR ||
    roleKey === ROLE_KEYS.VIEWER
  );
}

export async function createUser(input: CreateUserInput) {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw badRequest(
      'Username must be 3-32 chars, lowercase letters, digits, dot, underscore or hyphen.',
      'INVALID_USERNAME',
    );
  }

  const pwError = validatePasswordStrength(input.password);
  if (pwError) throw badRequest(pwError, 'WEAK_PASSWORD');

  if (requiresUnit(input.roleKey) && !input.unitId) {
    throw badRequest(
      'A unit must be assigned for this role.',
      'UNIT_REQUIRED',
    );
  }

  await validateUnitAndDepartment(input.unitId, input.departmentId);
  const roleId = await resolveRoleId(input.roleKey);

  const email = input.email?.trim().toLowerCase() || null;
  const employeeId = input.employeeId?.trim() || null;

  if (email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash) throw conflict('That email is already in use.', 'EMAIL_TAKEN');
  }
  const usernameClash = await prisma.user.findUnique({ where: { username } });
  if (usernameClash) {
    throw conflict('That username is already in use.', 'USERNAME_TAKEN');
  }
  if (employeeId) {
    const empClash = await prisma.user.findUnique({ where: { employeeId } });
    if (empClash) {
      throw conflict(
        'That employee ID is already in use.',
        'EMPLOYEE_ID_TAKEN',
      );
    }
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      username,
      email,
      fullName: input.fullName.trim(),
      mobile: input.mobile?.trim() || null,
      employeeId,
      designation: input.designation?.trim() || null,
      passwordHash,
      roleId,
      unitId: input.unitId ?? null,
      departmentId: input.departmentId ?? null,
      isActive: input.isActive ?? true,
    },
    include: userInclude,
  });
  return stripHash(user);
}

export async function updateUser(id: string, input: UpdateUserInput) {
  const existing = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  if (!existing) throw notFound('User not found.');

  const nextRoleKey = (input.roleKey ?? existing.role.key) as RoleKey;
  const nextUnitId =
    input.unitId === undefined ? existing.unitId : input.unitId;
  const nextDepartmentId =
    input.departmentId === undefined
      ? existing.departmentId
      : input.departmentId;

  if (requiresUnit(nextRoleKey) && !nextUnitId) {
    throw badRequest(
      'A unit must be assigned for this role.',
      'UNIT_REQUIRED',
    );
  }

  await validateUnitAndDepartment(nextUnitId, nextDepartmentId);

  let roleId: string | undefined;
  if (input.roleKey && input.roleKey !== existing.role.key) {
    roleId = await resolveRoleId(input.roleKey);
  }

  const email =
    input.email === undefined
      ? undefined
      : input.email?.trim().toLowerCase() || null;

  if (email && email !== existing.email) {
    const clash = await prisma.user.findUnique({ where: { email } });
    if (clash && clash.id !== id) {
      throw conflict('That email is already in use.', 'EMAIL_TAKEN');
    }
  }

  const employeeId =
    input.employeeId === undefined
      ? undefined
      : input.employeeId?.trim() || null;

  if (employeeId && employeeId !== existing.employeeId) {
    const clash = await prisma.user.findUnique({ where: { employeeId } });
    if (clash && clash.id !== id) {
      throw conflict(
        'That employee ID is already in use.',
        'EMPLOYEE_ID_TAKEN',
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      fullName: input.fullName?.trim(),
      email,
      mobile:
        input.mobile === undefined ? undefined : input.mobile?.trim() || null,
      employeeId,
      designation:
        input.designation === undefined
          ? undefined
          : input.designation?.trim() || null,
      roleId,
      unitId: input.unitId,
      departmentId: input.departmentId,
      isActive: input.isActive,
    },
    include: userInclude,
  });

  // Revoke active sessions if the user was deactivated.
  if (input.isActive === false) {
    await destroyAllUserSessions(user.id);
  }

  return stripHash(user);
}

export async function resetPassword(id: string, newPassword: string) {
  const pwError = validatePasswordStrength(newPassword);
  if (pwError) throw badRequest(pwError, 'WEAK_PASSWORD');

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw notFound('User not found.');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
  await destroyAllUserSessions(id);
}

/**
 * Hard-delete a user. Refuses when historical records reference them
 * so the audit trail stays intact. Sessions and audit-log actorId
 * are handled by the schema's cascade / set-null rules.
 *
 * Super-Admin-only endpoint — see `routes/users.ts`.
 */
export async function deleteUser(actorId: string, id: string) {
  if (actorId === id) {
    throw badRequest(
      'You cannot delete your own account.',
      'CANNOT_DELETE_SELF',
    );
  }
  const existing = await prisma.user.findUnique({
    where: { id },
    include: {
      role: { select: { key: true } },
      _count: {
        select: {
          inspectionsPerformed: true,
          inspectionsApproved: true,
          inspectionsRejected: true,
          inspectionAttachments: true,
          correctiveActionsRaised: true,
          correctiveActionsAssigned: true,
          correctiveActionsResolved: true,
          correctiveActionsClosed: true,
          correctiveActionAttachments: true,
          publishedChecklists: true,
          templateApprovals: true,
        },
      },
    },
  });
  if (!existing) throw notFound('User not found.');

  // Safety valve: never delete the last Super Admin (lock-out prevention).
  if (existing.role.key === ROLE_KEYS.SUPER_ADMIN) {
    const otherSuperAdmins = await prisma.user.count({
      where: {
        role: { key: ROLE_KEYS.SUPER_ADMIN },
        isActive: true,
        id: { not: id },
      },
    });
    if (otherSuperAdmins === 0) {
      throw badRequest(
        'Cannot delete the last active Super Admin — the system needs at least one.',
        'LAST_SUPER_ADMIN',
      );
    }
  }

  // Preserve history: refuse if the user has performed or approved
  // any inspections, raised any CAs, uploaded any evidence, or
  // published any templates. Operator should deactivate instead.
  const c = existing._count;
  const blockingCount =
    c.inspectionsPerformed +
    c.inspectionsApproved +
    c.inspectionsRejected +
    c.inspectionAttachments +
    c.correctiveActionsRaised +
    c.correctiveActionsAssigned +
    c.correctiveActionsResolved +
    c.correctiveActionsClosed +
    c.correctiveActionAttachments +
    c.publishedChecklists;
  if (blockingCount > 0) {
    throw conflict(
      'This user has historical records (inspections, corrective actions, etc.). Deactivate them instead of deleting.',
      'USER_HAS_HISTORY',
    );
  }

  // Approver assignments on templates: clean up automatically —
  // template survives, just without this approver.
  if (c.templateApprovals > 0) {
    await prisma.checklistTemplateApprover.deleteMany({
      where: { userId: id },
    });
  }

  // Sessions cascade via schema; audit-log actorId is SET NULL.
  await prisma.user.delete({ where: { id } });
}
