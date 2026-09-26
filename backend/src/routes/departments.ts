import { Router } from 'express';
import * as departmentController from '../controllers/departmentController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const departmentsRouter = Router();

departmentsRouter.use(requireAuth);

departmentsRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.DEPARTMENT_VIEW),
  departmentController.listDepartments,
);
departmentsRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.DEPARTMENT_VIEW),
  departmentController.getDepartment,
);
departmentsRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.DEPARTMENT_MANAGE),
  departmentController.createDepartment,
);
departmentsRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.DEPARTMENT_MANAGE),
  departmentController.updateDepartment,
);
