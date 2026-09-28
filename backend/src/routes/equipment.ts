import { Router } from 'express';
import * as ctrl from '../controllers/equipmentController.js';
import * as importCtrl from '../controllers/equipmentImportController.js';
import * as inspectionCtrl from '../controllers/inspectionController.js';
import * as caCtrl from '../controllers/correctiveActionController.js';
import {
  requireAuth,
  requirePermissions,
  requireRoles,
} from '../middleware/auth.js';
import { PERMISSION_KEYS, ROLE_KEYS } from '../lib/rbac.js';
import { equipmentImportUpload } from '../middleware/upload.js';

export const equipmentRouter = Router();

equipmentRouter.use(requireAuth);

// Bulk import — must be defined before /:id so it isn't consumed as an ID.
equipmentRouter.get(
  '/import/template',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  importCtrl.downloadTemplate,
);
equipmentRouter.post(
  '/import/preview',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  equipmentImportUpload,
  importCtrl.preview,
);
equipmentRouter.post(
  '/import/commit',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  importCtrl.commit,
);

// Lookup by code or QR value.
equipmentRouter.get(
  '/lookup',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.lookup,
);

// Standard CRUD.
equipmentRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.list,
);
equipmentRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.get,
);
equipmentRouter.get(
  '/:id/applicable-checklist',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_VIEW),
  ctrl.getApplicableChecklist,
);
equipmentRouter.get(
  '/:id/inspections',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  inspectionCtrl.listForEquipment,
);
equipmentRouter.get(
  '/:id/current-inspection',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  inspectionCtrl.currentForEquipment,
);
equipmentRouter.get(
  '/:id/corrective-actions',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_VIEW),
  caCtrl.listForEquipment,
);
equipmentRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  ctrl.create,
);
equipmentRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.EQUIPMENT_MANAGE),
  ctrl.update,
);
// Hard-delete: Super Admin only. Refuses if any inspection or CA
// references the equipment.
equipmentRouter.delete(
  '/:id',
  requireRoles(ROLE_KEYS.SUPER_ADMIN),
  ctrl.remove,
);
