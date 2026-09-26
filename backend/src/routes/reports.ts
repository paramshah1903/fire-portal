import { Router } from 'express';
import * as ctrl from '../controllers/reportsController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const reportsRouter = Router();

reportsRouter.use(requireAuth);
reportsRouter.use(requirePermissions(PERMISSION_KEYS.REPORT_VIEW));

reportsRouter.get('/compliance', ctrl.compliance);
reportsRouter.get('/unit-compliance', ctrl.unitCompliance);
reportsRouter.get('/equipment-history', ctrl.equipmentHistory);
reportsRouter.get('/failed-equipment', ctrl.failedEquipment);
reportsRouter.get('/corrective-actions', ctrl.correctiveActions);
reportsRouter.get(
  '/equipment-inspection-log',
  ctrl.equipmentInspectionLog,
);
