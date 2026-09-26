import { Router } from 'express';
import * as unitController from '../controllers/unitController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const unitsRouter = Router();

unitsRouter.use(requireAuth);

unitsRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.UNIT_VIEW),
  unitController.listUnits,
);
unitsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.UNIT_VIEW),
  unitController.getUnit,
);
unitsRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.UNIT_MANAGE),
  unitController.createUnit,
);
unitsRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.UNIT_MANAGE),
  unitController.updateUnit,
);
