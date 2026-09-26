import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/auditLogService.js';
import { badRequest } from '../lib/errors.js';

function q(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function parseDate(v: unknown, label: string): Date | undefined {
  if (typeof v !== 'string' || v.length === 0) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) {
    throw badRequest(`Invalid ${label} date.`, 'INVALID_DATE');
  }
  return d;
}

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const page =
    typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number.parseInt(req.query.pageSize, 10)
      : 50;

  const data = await service.listAuditLogs({
    actorId: q(req.query.actorId),
    action: q(req.query.action),
    entityType: q(req.query.entityType),
    entityId: q(req.query.entityId),
    search: q(req.query.search),
    fromDate: parseDate(req.query.fromDate, 'fromDate'),
    toDate: parseDate(req.query.toDate, 'toDate'),
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 50,
  });
  res.json(data);
});

export const listActions: RequestHandler = asyncHandler(async (_req, res) => {
  const actions = await service.listActions();
  res.json({ actions });
});

export const listEntityTypes: RequestHandler = asyncHandler(async (_req, res) => {
  const entityTypes = await service.listEntityTypes();
  res.json({ entityTypes });
});
