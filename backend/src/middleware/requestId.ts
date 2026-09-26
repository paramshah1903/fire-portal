import { randomBytes } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Stamp every incoming request with a short correlation id. Honours
 * an incoming `X-Request-Id` header if one is supplied (useful when
 * the request comes through a reverse proxy that already assigns one),
 * otherwise generates a fresh 12-char hex id. The id is echoed in the
 * response header of the same name so clients can quote it when
 * reporting an issue.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const id =
    typeof incoming === 'string' && /^[A-Za-z0-9._-]{6,64}$/.test(incoming)
      ? incoming
      : randomBytes(6).toString('hex');
  (req as unknown as { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
};
