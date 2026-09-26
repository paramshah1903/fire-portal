import 'express';

/**
 * Shape of the user object we hydrate onto req.user once authenticate()
 * has resolved the session cookie.
 */
export interface RequestUser {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  isActive: boolean;
  roleKey: string;
  roleName: string;
  permissions: string[];
  unitId: string | null;
  departmentId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
      sessionId?: string;
    }
  }
}

export {};
