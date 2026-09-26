import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  let database: 'ok' | 'unavailable' = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'unavailable';
  }

  const status = database === 'ok' ? 'ok' : 'degraded';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    service: 'upl-fire-safety-portal-api',
    time: new Date().toISOString(),
    uptimeSec: Number(process.uptime().toFixed(2)),
    database,
  });
});
