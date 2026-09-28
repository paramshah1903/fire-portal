import { Router } from 'express';
import * as ctrl from '../controllers/inspectionController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';
import { inspectionPhotoUpload } from '../middleware/upload.js';

export const inspectionsRouter = Router();

inspectionsRouter.use(requireAuth);

// Order matters: /schedule, /start, /pending-approvals must not be
// captured by /:id.
inspectionsRouter.get(
  '/schedule',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.listSchedule,
);
inspectionsRouter.post(
  '/start',
  requirePermissions(PERMISSION_KEYS.INSPECTION_PERFORM),
  ctrl.startInspection,
);
inspectionsRouter.get(
  '/pending-approvals',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.listPendingApprovals,
);

inspectionsRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.listInspections,
);
inspectionsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.getInspection,
);
inspectionsRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.INSPECTION_PERFORM),
  ctrl.saveProgress,
);
inspectionsRouter.post(
  '/:id/submit',
  requirePermissions(PERMISSION_KEYS.INSPECTION_PERFORM),
  ctrl.submit,
);
inspectionsRouter.post(
  '/:id/approve',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.approve,
);
inspectionsRouter.post(
  '/:id/reject',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.reject,
);
inspectionsRouter.post(
  '/:id/attachments',
  requirePermissions(PERMISSION_KEYS.INSPECTION_PERFORM),
  inspectionPhotoUpload,
  ctrl.uploadAttachment,
);

export const inspectionAttachmentsRouter = Router();

inspectionAttachmentsRouter.use(requireAuth);

inspectionAttachmentsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.INSPECTION_VIEW),
  ctrl.downloadAttachment,
);
