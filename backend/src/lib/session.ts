import type { CookieOptions, Request, Response } from 'express';
import { prisma } from './prisma.js';
import { env, isProduction } from '../config/env.js';

const COOKIE_NAME = env.sessionCookieName;

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    signed: true,
    maxAge: env.sessionMaxAgeMs,
    path: '/',
  };
}

export function clearSessionCookieOptions(): CookieOptions {
  const opts = sessionCookieOptions();
  return { ...opts, maxAge: 0 };
}

export interface CreateSessionInput {
  userId: string;
  req: Request;
}

export async function createSession(
  input: CreateSessionInput,
): Promise<{ id: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + env.sessionMaxAgeMs);
  const session = await prisma.session.create({
    data: {
      userId: input.userId,
      expiresAt,
      userAgent: input.req.get('user-agent') ?? null,
      ip: input.req.ip ?? null,
    },
  });
  return { id: session.id, expiresAt };
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(COOKIE_NAME, sessionId, sessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, clearSessionCookieOptions());
}

export function readSessionCookie(req: Request): string | null {
  const signed = req.signedCookies?.[COOKIE_NAME];
  if (typeof signed === 'string' && signed.length > 0) return signed;
  return null;
}

export async function destroySession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

/**
 * Delete expired sessions. Called on startup and could be called on
 * a timer; kept cheap enough to run inline.
 */
export async function purgeExpiredSessions(): Promise<number> {
  const { count } = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return count;
}

/**
 * Slide a session's expiry: refresh both `expiresAt` and `lastSeenAt`
 * to keep the session alive. Only bumps the DB row if enough time
 * has elapsed since the last refresh (default 5 min) to avoid write
 * amplification on chatty pages. Also enforces an absolute lifetime
 * cap so a session cannot live forever regardless of activity.
 *
 * Returns the updated (or unchanged) row so the caller can refresh
 * the cookie in the response.
 */
export async function slideSession(session: {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}): Promise<{ shouldRefreshCookie: boolean; expiresAt: Date }> {
  const now = Date.now();
  const absoluteDeadline =
    session.createdAt.getTime() + env.sessionAbsoluteMaxAgeMs;
  const desiredExpiry = Math.min(now + env.sessionMaxAgeMs, absoluteDeadline);

  // If desired expiry has advanced past the current one, or enough time
  // has passed since last write, persist the update.
  const enoughTimePassed =
    now - session.lastSeenAt.getTime() > env.sessionRefreshIntervalMs;
  const worthWriting =
    enoughTimePassed &&
    desiredExpiry > session.expiresAt.getTime() + 1000; // ignore trivial deltas

  if (!worthWriting) {
    return {
      shouldRefreshCookie: false,
      expiresAt: session.expiresAt,
    };
  }

  const updated = await prisma.session.update({
    where: { id: session.id },
    data: {
      lastSeenAt: new Date(now),
      expiresAt: new Date(desiredExpiry),
    },
    select: { expiresAt: true },
  });
  return { shouldRefreshCookie: true, expiresAt: updated.expiresAt };
}
