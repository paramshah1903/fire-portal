import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './app.js';
import { env, isProduction } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { purgeExpiredSessions } from './lib/session.js';

const SESSION_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // every 15 min

function logConfig() {
  const cfg = {
    nodeEnv: env.nodeEnv,
    port: env.port,
    corsOrigin: env.corsOrigin,
    databaseUrl: env.databaseUrl.replace(/(file:)([^?]*)/, '$1<db-path>'),
    sessionCookieName: env.sessionCookieName,
    sessionMaxAgeMs: env.sessionMaxAgeMs,
    sessionAbsoluteMaxAgeMs: env.sessionAbsoluteMaxAgeMs,
    uploadDir: env.uploadDir,
    uploadMaxBytes: env.uploadMaxBytes,
    rateLimitGlobalPerMinute: env.rateLimitGlobalPerMinute,
    rateLimitWritePerMinute: env.rateLimitWritePerMinute,
  };
  console.log('[upl-api] config:', JSON.stringify(cfg));
}

async function ensureUploadDir() {
  const abs = path.resolve(process.cwd(), env.uploadDir);
  await fs.mkdir(abs, { recursive: true });
  console.log(`[upl-api] upload directory ready: ${abs}`);
}

async function main() {
  logConfig();
  await ensureUploadDir();

  const app = createApp();

  // One-off sweep on boot, then every SESSION_SWEEP_INTERVAL_MS.
  try {
    const purged = await purgeExpiredSessions();
    if (purged > 0)
      console.log(`[upl-api] purged ${purged} expired session(s) on startup`);
  } catch (err) {
    console.error('[upl-api] initial session sweep failed', err);
  }
  const sweepTimer = setInterval(() => {
    purgeExpiredSessions().catch((err) =>
      console.error('[upl-api] session sweep failed', err),
    );
  }, SESSION_SWEEP_INTERVAL_MS);
  // Don't hold the process open for the timer.
  sweepTimer.unref();

  const server = app.listen(env.port, () => {
    console.log(
      `[upl-api] listening on http://localhost:${env.port} (env=${env.nodeEnv})`,
    );
    if (isProduction && env.sessionSecret === 'dev-only-change-me') {
      console.warn(
        '[upl-api] WARNING: SESSION_SECRET is the built-in dev value — set a strong secret in production',
      );
    }
  });

  const shutdown = async (signal: string) => {
    console.log(`[upl-api] received ${signal}, shutting down`);
    clearInterval(sweepTimer);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Hard-exit after 10s so a stuck request doesn't block a service restart.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[upl-api] fatal startup error', err);
  process.exit(1);
});
