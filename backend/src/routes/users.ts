import { Router } from 'express';
import * as userController from '../controllers/userController.js';
import * as roleController from '../controllers/roleController.js';
import { requireAuth, requirePermissions } from '../middleware/auth.js';
import { PERMISSION_KEYS } from '../lib/rbac.js';

export const usersRouter = Router();

usersRouter.use(requireAuth);

// Role master — a "read" list is available to anyone with USER_VIEW
// (so New-user forms can populate the role dropdown). Detail + writes
// require the dedicated ROLE_MANAGE permission.
usersRouter.get(
  '/roles',
  requirePermissions(PERMISSION_KEYS.USER_VIEW),
  roleController.listRoles,
);
usersRouter.get(
  '/permissions',
  requirePermissions(PERMISSION_KEYS.ROLE_MANAGE),
  roleController.listPermissions,
);
usersRouter.get(
  '/roles/:id',
  requirePermissions(PERMISSION_KEYS.ROLE_MANAGE),
  roleController.getRole,
);
usersRouter.post(
  '/roles',
  requirePermissions(PERMISSION_KEYS.ROLE_MANAGE),
  roleController.createRole,
);
usersRouter.put(
  '/roles/:id',
  requirePermissions(PERMISSION_KEYS.ROLE_MANAGE),
  roleController.updateRole,
);
usersRouter.delete(
  '/roles/:id',
  requirePermissions(PERMISSION_KEYS.ROLE_MANAGE),
  roleController.deleteRole,
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
