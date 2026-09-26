import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as authService from '../services/authService.js';
import {
  clearSessionCookie,
  destroySession,
  setSessionCookie,
} from '../lib/session.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { unauthorized } from '../lib/errors.js';

const loginSchema = z.object({
  username: z.string().min(1, 'Username or email is required.'),
  password: z.string().min(1, 'Password is required.'),
});

export const postLogin: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const result = await authService.login(req, parsed.username, parsed.password);

  setSessionCookie(res, result.sessionId);
  res.json({
    user: result.user,
    expiresAt: result.expiresAt.toISOString(),
  });
});

export const postLogout: RequestHandler = asyncHandler(async (req, res) => {
  if (req.sessionId) {
    await destroySession(req.sessionId);
    if (req.user) {
      await writeAudit({
        actorId: req.user.id,
        action: AUDIT_ACTIONS.LOGOUT,
      });
    }
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

export const getMe: RequestHandler = (req, res, next) => {
  if (!req.user) return next(unauthorized());
  res.json({ user: req.user });
};
