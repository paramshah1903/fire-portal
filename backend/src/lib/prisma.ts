import { PrismaClient } from '@prisma/client';
import { isProduction } from '../config/env.js';

/**
 * Single Prisma client instance for the process.
 *
 * In development, tsx watch reloads the module on file changes, which
 * would otherwise instantiate a new PrismaClient on every reload and
 * leak connections. Cache it on globalThis to reuse across reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['warn', 'error'],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
