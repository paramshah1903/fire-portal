import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { HttpError } from '../lib/errors.js';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const rid = (req as unknown as { id?: string }).id;

  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, requestId: rid },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        requestId: rid,
        details: err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  const status =
    typeof (err as { status?: number }).status === 'number'
      ? (err as { status: number }).status
      : 500;

  // Always log 5xx errors (including production) with the request id
  // so ops can correlate a user-reported id with the stack trace.
  if (status >= 500) {
    console.error(`[api-error] rid=${rid ?? '-'}`, err);
  } else if (!isProduction) {
    console.error(`[api-error] rid=${rid ?? '-'}`, err);
  }

  res.status(status).json({
    error: {
      code:
        (err as { code?: string }).code ??
        (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
      message:
        status === 500
          ? 'Something went wrong. Please try again.'
          : ((err as { message?: string }).message ?? 'Request failed'),
      requestId: rid,
    },
  });
};
