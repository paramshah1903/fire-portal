import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { resolveDateRange } from '../lib/inspectionPeriod.js';
import { ROLE_KEYS } from '../lib/rbac.js';

export interface Actor {
  id: string;
  roleKey: string;
  unitId: string | null;
}

function isBroad(actor: Actor): boolean {
  return (
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
  );
}

function scopeUnitId(actor: Actor, requested?: string): string | undefined {
  if (isBroad(actor)) return requested;
  return actor.unitId ?? '__none__';
}

export interface DashboardOptions {
  actor: Actor;
  fromDate?: string;
  toDate?: string;
  /** Legacy: shorthand for a whole calendar month. */
  periodKey?: string;
  unitId?: string;
  equipmentTypeId?: string;
}

export interface UnitCompletionRow {
  unitId: string;
  unitCode: string;
  unitName: string;
  completed: number;
  inProgress: number;
  overdue: number;
  due: number;
  total: number;
  completionPct: number;
}

export interface TopFailedItem {
  questionText: string;
  failCount: number;
  safetyCriticalFailCount: number;
}

export interface Dashboard {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  scope: {
    unitId: string | null;
    equipmentTypeId: string | null;
    roleKey: string;
    // True if the caller sees only their own unit's data
    unitScoped: boolean;
  };
  kpis: {
    totalEquipment: number;
    activeEquipment: number;
    /** Total (equipment × month) inspections expected in the range. */
    dueInRange: number;
    completed: number;
    inProgress: number;
    overdue: number;
    failedEquipment: number;
    openCorrectiveActions: number;
  };
  charts: {
    overallCompletionPct: number;
    unitCompletion: UnitCompletionRow[];
    statusDistribution: {
      completed: number;
      inProgress: number;
      due: number;
      overdue: number;
    };
    topFailedItems: TopFailedItem[];
    openCorrectiveActionsByPriority: {
      CRITICAL: number;
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
  };
}

/** Compute the last-moment-of-month for a "YYYY-MM" key. */
function periodEndFromKey(key: string): Date {
  const [y, m] = key.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

/**
 * Fetch every metric the dashboard shows in one round-trip. Metrics
 * aggregate over the requested date range — each (equipment, month)
 * combination in the range is one expected inspection.
 */
export async function buildDashboard(
  opts: DashboardOptions,
): Promise<Dashboard> {
  const range = resolveDateRange({
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    periodKey: opts.periodKey,
  });
  const effectiveUnitId = scopeUnitId(opts.actor, opts.unitId);

  // ---- Equipment universe (respects scope) --------------------------------
  const equipmentWhere: Prisma.EquipmentWhereInput = {
    unitId: effectiveUnitId,
    equipmentTypeId: opts.equipmentTypeId,
  };
  const activeEquipmentWhere: Prisma.EquipmentWhereInput = {
    ...equipmentWhere,
    isActive: true,
    status: { not: 'RETIRED' },
  };

  const [totalEquipment, activeEquipment, activeEquipmentList] =
    await Promise.all([
      prisma.equipment.count({ where: equipmentWhere }),
      prisma.equipment.count({ where: activeEquipmentWhere }),
      prisma.equipment.findMany({
        where: activeEquipmentWhere,
        select: {
          id: true,
          unitId: true,
          unit: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

  const equipmentIds = activeEquipmentList.map((e) => e.id);
  const unitBucket = new Map<
    string,
    { unitId: string; unitCode: string; unitName: string; ids: string[] }
  >();
  for (const e of activeEquipmentList) {
    let bucket = unitBucket.get(e.unitId);
    if (!bucket) {
      bucket = {
        unitId: e.unitId,
        unitCode: e.unit.code,
        unitName: e.unit.name,
        ids: [],
      };
      unitBucket.set(e.unitId, bucket);
    }
    bucket.ids.push(e.id);
  }

  // ---- Inspections in this range -----------------------------------------
  const inspections = equipmentIds.length
    ? await prisma.inspection.findMany({
        where: {
          periodKey: { in: range.periodKeys },
          equipmentId: { in: equipmentIds },
        },
        select: {
          id: true,
          equipmentId: true,
          periodKey: true,
          status: true,
          result: true,
          dueDate: true,
          hasSafetyCriticalFailure: true,
        },
      })
    : [];
  const inspByKey = new Map<string, (typeof inspections)[number]>();
  for (const i of inspections) inspByKey.set(`${i.equipmentId}::${i.periodKey}`, i);

  // Walk every (equipment, month) tuple in the range.
  const now = Date.now();
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  let due = 0;

  const perUnit = new Map<
    string,
    { completed: number; inProgress: number; overdue: number; due: number }
  >();
  for (const bucket of unitBucket.values()) {
    perUnit.set(bucket.unitId, {
      completed: 0,
      inProgress: 0,
      overdue: 0,
      due: 0,
    });
  }

  for (const periodKey of range.periodKeys) {
    const periodEnd = periodEndFromKey(periodKey);
    const periodPast = periodEnd.getTime() < now;
    for (const e of activeEquipmentList) {
      const insp = inspByKey.get(`${e.id}::${periodKey}`);
      const u = perUnit.get(e.unitId)!;
      if (!insp) {
        if (periodPast) {
          overdue++;
          u.overdue++;
        } else {
          due++;
          u.due++;
        }
      } else if (insp.status === 'COMPLETED') {
        completed++;
        u.completed++;
      } else if (
        insp.status === 'PENDING' &&
        insp.dueDate.getTime() < now
      ) {
        overdue++;
        u.overdue++;
      } else {
        inProgress++;
        u.inProgress++;
      }
    }
  }

  const totalExpected = activeEquipmentList.length * range.periodKeys.length;
  const overallCompletionPct =
    totalExpected > 0
      ? Math.round((completed / totalExpected) * 1000) / 10
      : 0;

  // ---- Per-unit stack ----------------------------------------------------
  const unitCompletion: UnitCompletionRow[] = [];
  for (const bucket of unitBucket.values()) {
    const u = perUnit.get(bucket.unitId)!;
    const totalForUnit = bucket.ids.length * range.periodKeys.length;
    unitCompletion.push({
      unitId: bucket.unitId,
      unitCode: bucket.unitCode,
      unitName: bucket.unitName,
      completed: u.completed,
      inProgress: u.inProgress,
      overdue: u.overdue,
      due: u.due,
      total: totalForUnit,
      completionPct:
        totalForUnit > 0
          ? Math.round((u.completed / totalForUnit) * 1000) / 10
          : 0,
    });
  }
  unitCompletion.sort((a, b) => a.unitCode.localeCompare(b.unitCode));

  // ---- Failed inspections (in this range) --------------------------------
  const failedEquipment = inspections.filter(
    (i) => i.result === 'FAIL',
  ).length;

  // ---- Open corrective actions ------------------------------------------
  const caWhere: Prisma.CorrectiveActionWhereInput = {
    unitId: effectiveUnitId,
    status: { not: 'CLOSED' },
    equipment: opts.equipmentTypeId
      ? { equipmentTypeId: opts.equipmentTypeId }
      : undefined,
  };
  const openCorrectiveActions = await prisma.correctiveAction.count({
    where: caWhere,
  });

  // ---- Top failed checklist items (in this range) -----------------------
  const failedResponses = inspections.length
    ? await prisma.inspectionResponse.findMany({
        where: {
          inspectionId: { in: inspections.map((i) => i.id) },
          isFail: true,
        },
        select: {
          questionText: true,
          isSafetyCritical: true,
        },
      })
    : [];

  const failCountByText = new Map<
    string,
    { failCount: number; safetyCriticalFailCount: number }
  >();
  for (const r of failedResponses) {
    const cur = failCountByText.get(r.questionText) ?? {
      failCount: 0,
      safetyCriticalFailCount: 0,
    };
    cur.failCount++;
    if (r.isSafetyCritical) cur.safetyCriticalFailCount++;
    failCountByText.set(r.questionText, cur);
  }
  const topFailedItems: TopFailedItem[] = Array.from(
    failCountByText.entries(),
  )
    .map(([questionText, v]) => ({
      questionText,
      failCount: v.failCount,
      safetyCriticalFailCount: v.safetyCriticalFailCount,
    }))
    .sort((a, b) => b.failCount - a.failCount)
    .slice(0, 10);

  // ---- Open CAs by priority ---------------------------------------------
  const openCaByPriority = await prisma.correctiveAction.groupBy({
    by: ['priority'],
    where: caWhere,
    _count: { _all: true },
  });
  const priorityCounts: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  } = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  for (const row of openCaByPriority) {
    const key = row.priority as keyof typeof priorityCounts;
    if (key in priorityCounts) priorityCounts[key] = row._count._all;
  }

  return {
    fromDate: range.fromDate.toISOString(),
    toDate: range.toDate.toISOString(),
    periodKeys: range.periodKeys,
    scope: {
      unitId: opts.unitId ?? null,
      equipmentTypeId: opts.equipmentTypeId ?? null,
      roleKey: opts.actor.roleKey,
      unitScoped: !isBroad(opts.actor),
    },
    kpis: {
      totalEquipment,
      activeEquipment,
      dueInRange: totalExpected,
      completed,
      inProgress,
      overdue,
      failedEquipment,
      openCorrectiveActions,
    },
    charts: {
      overallCompletionPct,
      unitCompletion,
      statusDistribution: {
        completed,
        inProgress,
        due,
        overdue,
      },
      topFailedItems,
      openCorrectiveActionsByPriority: priorityCounts,
    },
  };
}
