import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/dashboardService.js';

function actor(req: Parameters<RequestHandler>[0]) {
  const u = req.user!;
  return { id: u.id, roleKey: u.roleKey, unitId: u.unitId };
}

function q(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.buildDashboard({
    actor: actor(req),
    fromDate: q(req.query.fromDate),
    toDate: q(req.query.toDate),
    periodKey: q(req.query.periodKey),
    unitId: q(req.query.unitId),
    equipmentTypeId: q(req.query.equipmentTypeId),
  });
  res.json(data);
});
