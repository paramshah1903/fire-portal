import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import {
  clearSessionCookie,
  destroySession,
  readSessionCookie,
  setSessionCookie,
  slideSession,
} from '../lib/session.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { PermissionKey, RoleKey } from '../lib/rbac.js';
import type { RequestUser } from '../types/express.js';

async function loadUserFromRequest(
  req: Request,
  res: Response,
): Promise<RequestUser | null> {
  const sessionId = readSessionCookie(req);
  if (!sessionId) return null;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        include: {
          role: {
            include: {
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    },
  });

  if (!session) {
    clearSessionCookie(res);
    return null;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await destroySession(session.id);
    clearSessionCookie(res);
    return null;
  }

  const user = session.user;
  if (!user.isActive) {
    await destroySession(session.id);
    clearSessionCookie(res);
    return null;
  }

  // Slide the session forward on activity (throttled). If the DB row
  // actually moved, refresh the cookie so the browser's own expiry
  // stays in sync.
  slideSession({
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  })
    .then((result) => {
      if (result.shouldRefreshCookie) setSessionCookie(res, session.id);
    })
    .catch(() => undefined);

  req.sessionId = session.id;

  return {
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
}

/**
 * Populates req.user if a valid session cookie is present, otherwise
 * leaves req.user undefined. Never throws — pair with requireAuth().
 */
export const attachUser: RequestHandler = async (req, res, next) => {
  try {
    const user = await loadUserFromRequest(req, res);
    if (user) req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Fails the request with 401 if req.user was not populated by
 * attachUser.
 */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  next();
};

/**
 * Fails with 403 unless the caller has *all* listed permission keys.
 */
export function requirePermissions(
  ...required: PermissionKey[]
): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    const held = new Set(req.user.permissions);
    for (const p of required) {
      if (!held.has(p)) return next(forbidden());
    }
    next();
  };
}

/**
 * Fails with 403 unless the caller's role matches one of the allowed keys.
 * Prefer requirePermissions() where possible; this is for role-scoped UI
 * hints and admin-only screens.
 */
export function requireRoles(...roles: RoleKey[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.roleKey as RoleKey)) return next(forbidden());
    next();
  };
}

/**
 * Wraps async controllers so uncaught rejections reach the error handler.
 */
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// re-export for controllers
export type { NextFunction };
