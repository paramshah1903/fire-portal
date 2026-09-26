import type { Request } from 'express';
import { prisma } from '../lib/prisma.js';
import { verifyPassword } from '../lib/passwords.js';
import { createSession } from '../lib/session.js';
import { unauthorized } from '../lib/errors.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import type { RequestUser } from '../types/express.js';

export interface LoginResult {
  sessionId: string;
  expiresAt: Date;
  user: RequestUser;
}

export async function login(
  req: Request,
  usernameOrEmail: string,
  password: string,
): Promise<LoginResult> {
  const normalized = usernameOrEmail.trim().toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: normalized }, { email: normalized }],
    },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });

  if (!user) {
    await writeAudit({
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      metadata: { reason: 'unknown_user', attempted: normalized },
    });
    throw unauthorized('Invalid username or password.');
  }

  if (!user.isActive) {
    await writeAudit({
      actorId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      metadata: { reason: 'inactive_user' },
    });
    throw unauthorized('This account is inactive. Please contact an admin.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await writeAudit({
      actorId: user.id,
      action: AUDIT_ACTIONS.LOGIN_FAILURE,
      metadata: { reason: 'bad_password' },
    });
    throw unauthorized('Invalid username or password.');
  }

  const session = await createSession({ userId: user.id, req });

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAudit({
    actorId: user.id,
    action: AUDIT_ACTIONS.LOGIN_SUCCESS,
  });

  const requestUser: RequestUser = {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    isActive: user.isActive,
    roleKey: user.role.key,
    roleName: user.role.name,
    permissions: user.role.permissions.map((rp) => rp.permission.key),
    unitId: user.unitId,
    departmentId: user.departmentId,
  };

  return {
    sessionId: session.id,
    expiresAt: session.expiresAt,
    user: requestUser,
  };
}
