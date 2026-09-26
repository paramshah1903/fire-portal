import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export interface ListOptions {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  pageSize?: number;
}

const auditInclude = {
  actor: {
    select: { id: true, username: true, fullName: true },
  },
} as const;

export async function listAuditLogs(opts: ListOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 50));

  const where: Prisma.AuditLogWhereInput = {
    actorId: opts.actorId,
    action: opts.action,
    entityType: opts.entityType,
    entityId: opts.entityId,
    createdAt:
      opts.fromDate || opts.toDate
        ? {
            gte: opts.fromDate ?? undefined,
            lte: opts.toDate ?? undefined,
          }
        : undefined,
    OR: opts.search
      ? [
          { action: { contains: opts.search } },
          { entityType: { contains: opts.search } },
          { entityId: { contains: opts.search } },
          { metadata: { contains: opts.search } },
        ]
      : undefined,
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, rows };
}

/**
 * Return the distinct action keys currently in the audit log so the
 * UI's filter dropdown reflects what's actually happening.
 */
export async function listActions(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  });
  return rows.map((r) => r.action);
}

export async function listEntityTypes(): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({
    where: { entityType: { not: null } },
    distinct: ['entityType'],
    select: { entityType: true },
    orderBy: { entityType: 'asc' },
  });
  return rows
    .map((r) => r.entityType)
    .filter((x): x is string => x != null);
}
