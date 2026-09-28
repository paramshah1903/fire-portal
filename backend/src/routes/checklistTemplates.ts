import { Router } from 'express';
import * as ctrl from '../controllers/checklistTemplateController.js';
import {
  requireAuth,
  requirePermissions,
  requireRoles,
} from '../middleware/auth.js';
import { PERMISSION_KEYS, ROLE_KEYS } from '../lib/rbac.js';

export const checklistTemplatesRouter = Router();

checklistTemplatesRouter.use(requireAuth);

checklistTemplatesRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_VIEW),
  ctrl.listTemplates,
);
checklistTemplatesRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_VIEW),
  ctrl.getTemplate,
);
checklistTemplatesRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_MANAGE),
  ctrl.createTemplate,
);
checklistTemplatesRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_MANAGE),
  ctrl.updateTemplate,
);
checklistTemplatesRouter.post(
  '/:id/versions',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_MANAGE),
  ctrl.createDraft,
);
// Hard-delete: Super Admin only. Refuses if any inspection has ever
// used any of the template's versions.
checklistTemplatesRouter.delete(
  '/:id',
  requireRoles(ROLE_KEYS.SUPER_ADMIN),
  ctrl.deleteTemplate,
);

export const checklistVersionsRouter = Router();

checklistVersionsRouter.use(requireAuth);

checklistVersionsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_VIEW),
  ctrl.getVersion,
);
checklistVersionsRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_MANAGE),
  ctrl.updateDraft,
);
checklistVersionsRouter.post(
  '/:id/publish',
  requirePermissions(PERMISSION_KEYS.CHECKLIST_MANAGE),
  ctrl.publishDraft,
);
