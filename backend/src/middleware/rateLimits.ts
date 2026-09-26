import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { env } from '../config/env.js';

const rateLimitError = {
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again shortly.',
  },
};

/**
 * Broad, lenient rate limit applied to every /api/* request.
 * The write limiter below applies on top for mutations.
 */
export const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.rateLimitGlobalPerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitError,
});

/**
 * Extra limit on state-changing requests. Applied at the top of the
 * router chain and only counts POST/PUT/PATCH/DELETE.
 */
export const writeApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: env.rateLimitWritePerMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: rateLimitError,
  skip: (req: Request) => req.method === 'GET' || req.method === 'HEAD',
});
