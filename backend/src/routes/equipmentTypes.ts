import { Router } from 'express';
import * as ctrl from '../controllers/equipmentTypeController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const equipmentTypesRouter = Router();

equipmentTypesRouter.use(requireAuth);

equipmentTypesRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.list,
);
equipmentTypesRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.get,
);
equipmentTypesRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  ctrl.create,
);
equipmentTypesRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  ctrl.update,
);
