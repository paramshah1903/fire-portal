import { Router } from 'express';
import * as ctrl from '../controllers/correctiveActionController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';
import { inspectionPhotoUpload } from '../middleware/upload.js';

export const correctiveActionsRouter = Router();

correctiveActionsRouter.use(requireAuth);

correctiveActionsRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_VIEW),
  ctrl.list,
);
correctiveActionsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_VIEW),
  ctrl.get,
);
correctiveActionsRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CREATE),
  ctrl.create,
);
correctiveActionsRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CREATE),
  ctrl.update,
);
correctiveActionsRouter.post(
  '/:id/progress',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CREATE),
  ctrl.progress,
);
correctiveActionsRouter.post(
  '/:id/resolve',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CREATE),
  ctrl.resolve,
);
correctiveActionsRouter.post(
  '/:id/close',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CLOSE),
  ctrl.close,
);
correctiveActionsRouter.post(
  '/:id/attachments',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_CREATE),
  inspectionPhotoUpload, // reuses the same photo constraints
  ctrl.uploadAttachment,
);

export const correctiveActionAttachmentsRouter = Router();

correctiveActionAttachmentsRouter.use(requireAuth);

correctiveActionAttachmentsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.CORRECTIVE_ACTION_VIEW),
  ctrl.downloadAttachment,
);
