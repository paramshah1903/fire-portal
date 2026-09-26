import { Router } from 'express';
import * as ctrl from '../controllers/auditLogController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const auditLogsRouter = Router();

auditLogsRouter.use(requireAuth);
auditLogsRouter.use(requirePermissions(PERMISSION_KEYS.AUDIT_VIEW));

auditLogsRouter.get('/actions', ctrl.listActions);
auditLogsRouter.get('/entity-types', ctrl.listEntityTypes);
auditLogsRouter.get('/', ctrl.list);
