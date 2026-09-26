import { Router } from 'express';
import * as ctrl from '../controllers/dashboardController.js';
import { requireAuth } from '../middleware/auth.js';

export const dashboardRouter = Router();

// Every logged-in user gets a dashboard (scope is enforced by the
// service). No specific permission is required beyond authentication —
// the numbers a viewer sees are already unit-scoped.
dashboardRouter.use(requireAuth);
dashboardRouter.get('/', ctrl.get);
