import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isProduction } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { unitsRouter } from './routes/units.js';
import { departmentsRouter } from './routes/departments.js';
import { usersRouter } from './routes/users.js';
import { equipmentTypesRouter } from './routes/equipmentTypes.js';
import { equipmentRouter } from './routes/equipment.js';
import {
  checklistTemplatesRouter,
  checklistVersionsRouter,
} from './routes/checklistTemplates.js';
import {
  inspectionsRouter,
  inspectionAttachmentsRouter,
} from './routes/inspections.js';
import {
  correctiveActionsRouter,
  correctiveActionAttachmentsRouter,
} from './routes/correctiveActions.js';
import { reportsRouter } from './routes/reports.js';
import { dashboardRouter } from './routes/dashboard.js';
import { auditLogsRouter } from './routes/auditLogs.js';
import { attachUser } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import {
  globalApiLimiter,
  writeApiLimiter,
} from './middleware/rateLimits.js';
import { requestId } from './middleware/requestId.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // trust reverse proxy so req.ip / secure cookies work behind one.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser(env.sessionSecret));
  app.use(requestId);
  // Include the correlation id in each access log line so ops can
  // grep across the log + client-reported request id.
  morgan.token('rid', (req) => (req as unknown as { id?: string }).id ?? '-');
  app.use(
    morgan(
      isProduction
        ? ':rid :remote-addr - :remote-user [:date[iso]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'
        : ':rid :method :url :status :response-time ms',
    ),
  );

  // Hydrate req.user for every request (does not enforce auth).
  app.use(attachUser);

  // Rate limiters — global (all /api) plus a stricter one on writes.
  // /api/auth has its own tighter limiter as well; these compose.
  app.use('/api', globalApiLimiter);
  app.use('/api', writeApiLimiter);

  // Routes
  app.use('/api', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/units', unitsRouter);
  app.use('/api/departments', departmentsRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/equipment-types', equipmentTypesRouter);
  app.use('/api/equipment', equipmentRouter);
  app.use('/api/checklist-templates', checklistTemplatesRouter);
  app.use('/api/checklist-versions', checklistVersionsRouter);
  app.use('/api/inspections', inspectionsRouter);
  app.use('/api/inspection-attachments', inspectionAttachmentsRouter);
  app.use('/api/corrective-actions', correctiveActionsRouter);
  app.use(
    '/api/corrective-action-attachments',
    correctiveActionAttachmentsRouter,
  );
  app.use('/api/reports', reportsRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/audit-logs', auditLogsRouter);

  // Optional: serve the built React frontend from the same origin as
  // the API. Enabled when FRONTEND_DIST_DIR is set. Lets a single
  // Node process behind a single public URL (VPS, tunnel) serve the
  // whole app without a separate web server. Order matters — this
  // block goes AFTER all /api routes so they don't get intercepted,
  // and BEFORE notFoundHandler so unknown /api/* still returns JSON.
  if (env.frontendDistDir) {
    const dist = path.resolve(env.frontendDistDir);
    app.use(
      express.static(dist, {
        maxAge: isProduction ? '1h' : 0,
        index: false,
      }),
    );
    // SPA fallback: any non-/api GET returns index.html so React
    // Router can handle the URL client-side.
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  // Fallthroughs
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
