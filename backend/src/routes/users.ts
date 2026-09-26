import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get(
  '/roles',
  requirePermissions(PERMISSION_KEYS.USER_VIEW),
  userController.listRoles,
);

usersRouter.get(
  '/',
  requirePermissions(PERMISSION_KEYS.USER_VIEW),
  userController.listUsers,
);
usersRouter.get(
  '/:id',
  requirePermissions(PERMISSION_KEYS.USER_VIEW),
  userController.getUser,
);
usersRouter.post(
  '/',
  requirePermissions(PERMISSION_KEYS.USER_MANAGE),
  userController.createUser,
);
usersRouter.put(
  '/:id',
  requirePermissions(PERMISSION_KEYS.USER_MANAGE),
  userController.updateUser,
);
usersRouter.post(
  '/:id/reset-password',
  requirePermissions(PERMISSION_KEYS.USER_MANAGE),
  userController.resetPassword,
);
