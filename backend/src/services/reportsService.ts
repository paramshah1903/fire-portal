import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  resolveDateRange,
  type DateRange,
} from '../lib/inspectionPeriod.js';
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

/** Resolve the unit filter honouring RBAC scope. */
function scopeUnitId(actor: Actor, requested?: string): string | undefined {
  if (isBroad(actor)) return requested;
  return actor.unitId ?? '__none__';
}

// ============================================================================
// 1. Compliance report — per equipment, for one period
// ============================================================================

export interface ComplianceOptions {
  actor: Actor;
  fromDate?: string;
  toDate?: string;
  /** Legacy: shorthand for a whole calendar month. */
  periodKey?: string;
  unitId?: string;
  equipmentTypeId?: string;
}

export interface ComplianceRow {
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeName: string;
  /** Which month this row is for (e.g. "2026-09"). */
  periodKey: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'DUE' | 'OVERDUE';
  inspectionResult: 'PASS' | 'FAIL' | '';
  safetyCriticalFailure: boolean;
  inspectorName: string;
  completedAt: string;
  dueDate: string;
}

export interface ComplianceReport {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  summary: {
    totalEquipment: number;
    completed: number;
    inProgress: number;
    due: number;
    overdue: number;
    passRatePct: number;
    failCount: number;
    safetyCriticalFailCount: number;
  };
  rows: ComplianceRow[];
}

export async function complianceReport(
  opts: ComplianceOptions,
): Promise<ComplianceReport> {
  const range = resolveDateRange({
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    periodKey: opts.periodKey,
  });

  const where: Prisma.EquipmentWhereInput = {
    isActive: true,
    status: { not: 'RETIRED' },
    unitId: scopeUnitId(opts.actor, opts.unitId),
    equipmentTypeId: opts.equipmentTypeId,
  };

  const equipment = await prisma.equipment.findMany({
    where,
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      unit: { select: { code: true } },
      equipmentType: {
        select: { name: true, inspectionFrequencyDays: true },
      },
    },
    orderBy: [{ unit: { code: 'asc' } }, { equipmentCode: 'asc' }],
  });

  const inspections = await prisma.inspection.findMany({
    where: {
      periodKey: { in: range.periodKeys },
      equipmentId: { in: equipment.map((e) => e.id) },
    },
    select: {
      equipmentId: true,
      periodKey: true,
      status: true,
      result: true,
      hasSafetyCriticalFailure: true,
      completedAt: true,
      dueDate: true,
      inspector: { select: { fullName: true } },
    },
  });
  // Map by (equipmentId, periodKey).
  const byKey = new Map<string, (typeof inspections)[number]>();
  for (const i of inspections) {
    byKey.set(`${i.equipmentId}::${i.periodKey}`, i);
  }

  const now = Date.now();
  const rows: ComplianceRow[] = [];
  for (const periodKey of range.periodKeys) {
    const periodEnd = periodEndFromKey(periodKey);
    for (const e of equipment) {
      const insp = byKey.get(`${e.id}::${periodKey}`);
      let status: ComplianceRow['status'];
      if (!insp) {
        status = periodEnd.getTime() < now ? 'OVERDUE' : 'DUE';
      } else if (insp.status === 'COMPLETED') {
        status = 'COMPLETED';
      } else {
        status = insp.dueDate.getTime() < now ? 'OVERDUE' : 'IN_PROGRESS';
      }
      rows.push({
        unitCode: e.unit.code,
        equipmentCode: e.equipmentCode,
        equipmentName: e.name,
        equipmentTypeName: e.equipmentType.name,
        periodKey,
        status,
        inspectionResult: (insp?.result as 'PASS' | 'FAIL' | null) ?? '',
        safetyCriticalFailure: insp?.hasSafetyCriticalFailure ?? false,
        inspectorName: insp?.inspector?.fullName ?? '',
        completedAt: insp?.completedAt
          ? insp.completedAt.toISOString()
          : '',
        dueDate: insp?.dueDate
          ? insp.dueDate.toISOString()
          : periodEnd.toISOString(),
      });
    }
  }

  const completed = rows.filter((r) => r.status === 'COMPLETED');
  const passed = completed.filter((r) => r.inspectionResult === 'PASS').length;
  const failed = completed.filter((r) => r.inspectionResult === 'FAIL').length;
  const summary = {
    totalEquipment: equipment.length,
    completed: completed.length,
    inProgress: rows.filter((r) => r.status === 'IN_PROGRESS').length,
    due: rows.filter((r) => r.status === 'DUE').length,
    overdue: rows.filter((r) => r.status === 'OVERDUE').length,
    passRatePct:
      completed.length > 0
        ? Math.round((passed / completed.length) * 1000) / 10
        : 0,
    failCount: failed,
    safetyCriticalFailCount: rows.filter((r) => r.safetyCriticalFailure).length,
  };

  return {
    fromDate: range.fromDate.toISOString(),
    toDate: range.toDate.toISOString(),
    periodKeys: range.periodKeys,
    summary,
    rows,
  };
}

/** Compute the last-moment-of-month for a "YYYY-MM" key. */
function periodEndFromKey(key: string): Date {
  const [y, m] = key.split('-').map((n) => Number.parseInt(n, 10));
  return new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
}

// ============================================================================
// 2. Unit compliance — one row per unit
// ============================================================================

export interface UnitComplianceRow {
  unitId: string;
  unitCode: string;
  unitName: string;
  totalEquipment: number;
  completed: number;
  overdue: number;
  passed: number;
  failed: number;
  completionRatePct: number;
  passRatePct: number;
}

export interface UnitComplianceReport {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  summary: {
    totalUnits: number;
    totalEquipment: number;
    completed: number;
    overdue: number;
    passed: number;
    failed: number;
  };
  rows: UnitComplianceRow[];
}

export async function unitComplianceReport(opts: {
  actor: Actor;
  fromDate?: string;
  toDate?: string;
  periodKey?: string;
  equipmentTypeId?: string;
}): Promise<UnitComplianceReport> {
  const range = resolveDateRange({
    fromDate: opts.fromDate,
    toDate: opts.toDate,
    periodKey: opts.periodKey,
  });

  const units = await prisma.unit.findMany({
    where: {
      isActive: true,
      id: scopeUnitId(opts.actor),
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  const equipment = await prisma.equipment.findMany({
    where: {
      isActive: true,
      status: { not: 'RETIRED' },
      unitId: { in: units.map((u) => u.id) },
      equipmentTypeId: opts.equipmentTypeId,
    },
    select: { id: true, unitId: true },
  });

  const inspections = await prisma.inspection.findMany({
    where: {
      periodKey: { in: range.periodKeys },
      equipmentId: { in: equipment.map((e) => e.id) },
    },
    select: {
      equipmentId: true,
      periodKey: true,
      status: true,
      result: true,
      dueDate: true,
    },
  });
  const byKey = new Map<string, (typeof inspections)[number]>();
  for (const i of inspections) byKey.set(`${i.equipmentId}::${i.periodKey}`, i);

  const now = Date.now();
  // For each unit, iterate every (equipment, periodKey) tuple.
  const rows: UnitComplianceRow[] = units.map((u) => {
    const unitEquipment = equipment.filter((e) => e.unitId === u.id);
    let completed = 0;
    let overdue = 0;
    let passed = 0;
    let failed = 0;

    for (const e of unitEquipment) {
      for (const periodKey of range.periodKeys) {
        const insp = byKey.get(`${e.id}::${periodKey}`);
        if (insp?.status === 'COMPLETED') {
          completed++;
          if (insp.result === 'PASS') passed++;
          else if (insp.result === 'FAIL') failed++;
        } else if (!insp) {
          const periodEnd = periodEndFromKey(periodKey);
          if (periodEnd.getTime() < now) overdue++;
        } else if (
          insp.status === 'PENDING' &&
          insp.dueDate.getTime() < now
        ) {
          overdue++;
        }
      }
    }

    const expected = unitEquipment.length * range.periodKeys.length;
    return {
      unitId: u.id,
      unitCode: u.code,
      unitName: u.name,
      totalEquipment: expected,
      completed,
      overdue,
      passed,
      failed,
      completionRatePct:
        expected > 0 ? Math.round((completed / expected) * 1000) / 10 : 0,
      passRatePct:
        completed > 0 ? Math.round((passed / completed) * 1000) / 10 : 0,
    };
  });

  const summary = {
    totalUnits: rows.length,
    totalEquipment: rows.reduce((n, r) => n + r.totalEquipment, 0),
    completed: rows.reduce((n, r) => n + r.completed, 0),
    overdue: rows.reduce((n, r) => n + r.overdue, 0),
    passed: rows.reduce((n, r) => n + r.passed, 0),
    failed: rows.reduce((n, r) => n + r.failed, 0),
  };

  return {
    fromDate: range.fromDate.toISOString(),
    toDate: range.toDate.toISOString(),
    periodKeys: range.periodKeys,
    summary,
    rows,
  };
}

// ============================================================================
// 3. Equipment history — every inspection for a given equipment
// ============================================================================

export interface EquipmentHistoryRow {
  periodKey: string;
  result: 'PASS' | 'FAIL' | '';
  status: string;
  safetyCriticalFailure: boolean;
  inspectorName: string;
  completedAt: string;
  templateName: string;
  templateVersion: number;
}

export interface EquipmentHistoryReport {
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    unitCode: string;
    equipmentTypeName: string;
  };
  summary: {
    totalInspections: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
    lastCompletedAt: string;
  };
  rows: EquipmentHistoryRow[];
}

export async function equipmentHistoryReport(opts: {
  actor: Actor;
  equipmentId: string;
}): Promise<EquipmentHistoryReport> {
  const equipment = await prisma.equipment.findUnique({
    where: { id: opts.equipmentId },
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      unitId: true,
      unit: { select: { code: true } },
      equipmentType: { select: { name: true } },
    },
  });
  if (!equipment) throw notFound('Equipment not found.');
  if (!isBroad(opts.actor)) {
    if (!opts.actor.unitId || opts.actor.unitId !== equipment.unitId) {
      throw badRequest(
        'You cannot view history for equipment outside your unit.',
        'FORBIDDEN_UNIT',
      );
    }
  }

  const inspections = await prisma.inspection.findMany({
    where: { equipmentId: opts.equipmentId },
    include: {
      inspector: { select: { fullName: true } },
      templateVersion: {
        select: {
          versionNumber: true,
          template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ periodKey: 'desc' }, { createdAt: 'desc' }],
  });

  const rows: EquipmentHistoryRow[] = inspections.map((i) => ({
    periodKey: i.periodKey,
    result: (i.result as 'PASS' | 'FAIL' | null) ?? '',
    status: i.status,
    safetyCriticalFailure: i.hasSafetyCriticalFailure,
    inspectorName: i.inspector.fullName,
    completedAt: i.completedAt ? i.completedAt.toISOString() : '',
    templateName: i.templateVersion.template.name,
    templateVersion: i.templateVersion.versionNumber,
  }));

  const completed = rows.filter((r) => r.status === 'COMPLETED');
  return {
    equipment: {
      id: equipment.id,
      equipmentCode: equipment.equipmentCode,
      name: equipment.name,
      unitCode: equipment.unit.code,
      equipmentTypeName: equipment.equipmentType.name,
    },
    summary: {
      totalInspections: completed.length,
      passed: completed.filter((r) => r.result === 'PASS').length,
      failed: completed.filter((r) => r.result === 'FAIL').length,
      safetyCriticalFailures: completed.filter((r) => r.safetyCriticalFailure)
        .length,
      lastCompletedAt: completed[0]?.completedAt ?? '',
    },
    rows,
  };
}

// ============================================================================
// 4. Failed equipment — anything currently non-compliant
// ============================================================================

export interface FailedEquipmentRow {
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeName: string;
  equipmentStatus: string;
  lastFailPeriod: string;
  lastFailAt: string;
  safetyCriticalFailure: boolean;
  openCorrectiveActions: number;
}

export interface FailedEquipmentReport {
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalFailedEquipment: number;
    withSafetyCritical: number;
    withOpenCa: number;
    outOfService: number;
  };
  rows: FailedEquipmentRow[];
}

export async function failedEquipmentReport(opts: {
  actor: Actor;
  fromDate?: string;
  toDate?: string;
  periodKey?: string;
  unitId?: string;
}): Promise<FailedEquipmentReport> {
  // If no filter at all is passed, don't constrain by date (whole
  // history of failures). If any filter is supplied we honour it.
  const rangeSpecified = !!(opts.fromDate || opts.toDate || opts.periodKey);
  let range: DateRange | null = null;
  if (rangeSpecified) {
    range = resolveDateRange({
      fromDate: opts.fromDate,
      toDate: opts.toDate,
      periodKey: opts.periodKey,
    });
  }
  const unitId = scopeUnitId(opts.actor, opts.unitId);

  // Pull every equipment that has at least one failed inspection
  // in the range (or ever), or is currently non-active status.
  const failedInspections = await prisma.inspection.findMany({
    where: {
      result: 'FAIL',
      ...(range ? { periodKey: { in: range.periodKeys } } : {}),
      equipment: unitId ? { unitId } : undefined,
    },
    orderBy: { completedAt: 'desc' },
    select: {
      equipmentId: true,
      hasSafetyCriticalFailure: true,
      periodKey: true,
      completedAt: true,
    },
  });

  // Deduplicate — keep the latest failure per equipment.
  const failureByEquipment = new Map<
    string,
    { hasSafetyCriticalFailure: boolean; periodKey: string; completedAt: Date | null }
  >();
  for (const f of failedInspections) {
    if (!failureByEquipment.has(f.equipmentId)) {
      failureByEquipment.set(f.equipmentId, {
        hasSafetyCriticalFailure: f.hasSafetyCriticalFailure,
        periodKey: f.periodKey,
        completedAt: f.completedAt,
      });
    }
  }
  const failedIds = Array.from(failureByEquipment.keys());

  // Also include equipment that is out-of-service or under-maintenance.
  const nonActiveEquipment = await prisma.equipment.findMany({
    where: {
      status: { in: ['OUT_OF_SERVICE', 'UNDER_MAINTENANCE'] },
      isActive: true,
      unitId,
    },
    select: { id: true },
  });
  for (const e of nonActiveEquipment) {
    if (!failureByEquipment.has(e.id)) failedIds.push(e.id);
  }

  if (failedIds.length === 0) {
    return {
      fromDate: range?.fromDate.toISOString() ?? null,
      toDate: range?.toDate.toISOString() ?? null,
      summary: {
        totalFailedEquipment: 0,
        withSafetyCritical: 0,
        withOpenCa: 0,
        outOfService: 0,
      },
      rows: [],
    };
  }

  const equipment = await prisma.equipment.findMany({
    where: { id: { in: failedIds }, unitId },
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      status: true,
      unit: { select: { code: true } },
      equipmentType: { select: { name: true } },
      _count: {
        select: {
          correctiveActions: {
            where: { status: { not: 'CLOSED' } },
          },
        },
      },
    },
    orderBy: [{ unit: { code: 'asc' } }, { equipmentCode: 'asc' }],
  });

  const rows: FailedEquipmentRow[] = equipment.map((e) => {
    const failure = failureByEquipment.get(e.id);
    return {
      unitCode: e.unit.code,
      equipmentCode: e.equipmentCode,
      equipmentName: e.name,
      equipmentTypeName: e.equipmentType.name,
      equipmentStatus: e.status,
      lastFailPeriod: failure?.periodKey ?? '',
      lastFailAt: failure?.completedAt
        ? failure.completedAt.toISOString()
        : '',
      safetyCriticalFailure: failure?.hasSafetyCriticalFailure ?? false,
      openCorrectiveActions: e._count.correctiveActions,
    };
  });

  return {
    fromDate: range?.fromDate.toISOString() ?? null,
    toDate: range?.toDate.toISOString() ?? null,
    summary: {
      totalFailedEquipment: rows.length,
      withSafetyCritical: rows.filter((r) => r.safetyCriticalFailure).length,
      withOpenCa: rows.filter((r) => r.openCorrectiveActions > 0).length,
      outOfService: rows.filter((r) => r.equipmentStatus === 'OUT_OF_SERVICE')
        .length,
    },
    rows,
  };
}

// ============================================================================
// 5. Corrective actions report
// ============================================================================

export interface CorrectiveActionsReportRow {
  code: string;
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  title: string;
  priority: string;
  status: string;
  assigneeName: string;
  raisedByName: string;
  raisedAt: string;
  targetDate: string;
  resolvedAt: string;
  closedAt: string;
  daysOpen: number;
}

export interface CorrectiveActionsReport {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    overdue: number;
    avgDaysToClose: number;
  };
  rows: CorrectiveActionsReportRow[];
}

export async function correctiveActionsReport(opts: {
  actor: Actor;
  status?: string;
  priority?: string;
  unitId?: string;
  raisedFrom?: string;
  raisedTo?: string;
}): Promise<CorrectiveActionsReport> {
  const where: Prisma.CorrectiveActionWhereInput = {
    unitId: scopeUnitId(opts.actor, opts.unitId),
    status: opts.status,
    priority: opts.priority,
    raisedAt: {
      gte: opts.raisedFrom ? new Date(opts.raisedFrom) : undefined,
      lte: opts.raisedTo ? new Date(opts.raisedTo) : undefined,
    },
  };

  const cas = await prisma.correctiveAction.findMany({
    where,
    include: {
      equipment: { select: { equipmentCode: true, name: true } },
      unit: { select: { code: true } },
      raisedBy: { select: { fullName: true } },
      assignee: { select: { fullName: true } },
    },
    orderBy: [{ status: 'asc' }, { priority: 'asc' }, { raisedAt: 'desc' }],
  });

  const now = Date.now();
  const rows: CorrectiveActionsReportRow[] = cas.map((c) => {
    const start = c.raisedAt.getTime();
    const end = c.closedAt?.getTime() ?? now;
    const daysOpen = Math.max(0, Math.round((end - start) / 86_400_000));
    return {
      code: c.code,
      unitCode: c.unit.code,
      equipmentCode: c.equipment.equipmentCode,
      equipmentName: c.equipment.name,
      title: c.title,
      priority: c.priority,
      status: c.status,
      assigneeName: c.assignee?.fullName ?? '',
      raisedByName: c.raisedBy.fullName,
      raisedAt: c.raisedAt.toISOString(),
      targetDate: c.targetDate ? c.targetDate.toISOString() : '',
      resolvedAt: c.resolvedAt ? c.resolvedAt.toISOString() : '',
      closedAt: c.closedAt ? c.closedAt.toISOString() : '',
      daysOpen,
    };
  });

  const closed = cas.filter((c) => c.closedAt);
  const totalCloseDays = closed.reduce(
    (n, c) =>
      n +
      Math.max(
        0,
        Math.round(
          (c.closedAt!.getTime() - c.raisedAt.getTime()) / 86_400_000,
        ),
      ),
    0,
  );

  return {
    summary: {
      total: rows.length,
      open: rows.filter((r) => r.status === 'OPEN').length,
      inProgress: rows.filter((r) => r.status === 'IN_PROGRESS').length,
      resolved: rows.filter((r) => r.status === 'RESOLVED').length,
      closed: rows.filter((r) => r.status === 'CLOSED').length,
      overdue: cas.filter(
        (c) =>
          c.status !== 'CLOSED' &&
          c.targetDate &&
          c.targetDate.getTime() < now,
      ).length,
      avgDaysToClose:
        closed.length > 0 ? Math.round(totalCloseDays / closed.length) : 0,
    },
    rows,
  };
}

// ============================================================================
// 6. Equipment inspection log — per-equipment, one row per completed
//    inspection, one column per unique checklist question seen in range.
// ============================================================================

export interface InspectionLogQuestion {
  key: string; // ChecklistQuestion.id
  text: string;
  type: string;
  isSafetyCritical: boolean;
  isMandatory: boolean;
  sectionTitle: string;
  /** Composite sort key: (sectionSequence * 1000) + questionSequence */
  sortKey: number;
}

export interface InspectionLogAnswer {
  valueString: string | null;
  valueNumeric: number | null;
  valueDate: string | null;
  isFail: boolean;
  notes: string | null;
  attachmentCount: number;
  /** Pre-formatted for CSV/XLSX cells. */
  display: string;
}

export interface InspectionLogRow {
  inspectionId: string;
  periodKey: string;
  completedAt: string;
  inspectorName: string;
  inspectorUsername: string;
  confirmationName: string;
  result: string;
  hasSafetyCriticalFailure: boolean;
  remarks: string;
  templateName: string;
  templateVersion: number;
  answers: Record<string, InspectionLogAnswer>;
}

export interface InspectionLogReport {
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    qrCodeValue: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    capacity: string | null;
    assetNumber: string | null;
    building: string | null;
    floor: string | null;
    area: string | null;
    location: string | null;
    exactLocation: string | null;
    status: string;
    installationDate: string | null;
    unitCode: string;
    unitName: string;
    departmentCode: string | null;
    departmentName: string | null;
    equipmentTypeKey: string;
    equipmentTypeName: string;
  };
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalInspections: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
    lastCompletedAt: string;
  };
  questions: InspectionLogQuestion[];
  rows: InspectionLogRow[];
}

function formatAnswer(r: {
  questionType: string;
  valueString: string | null;
  valueNumeric: number | null;
  valueDate: Date | null;
  numericUnit: string | null;
  notes: string | null;
  attachments: unknown[];
}): string {
  let core: string;
  switch (r.questionType) {
    case 'PASS_FAIL':
    case 'YES_NO':
    case 'DROPDOWN':
    case 'RADIO':
    case 'TEXT':
    case 'REMARKS':
      core = r.valueString ?? '';
      break;
    case 'CHECKBOX': {
      // valueString is a JSON array; render as comma-joined for CSV/XLSX.
      if (!r.valueString) {
        core = '';
      } else {
        try {
          const arr = JSON.parse(r.valueString);
          core = Array.isArray(arr) ? arr.join(', ') : String(r.valueString);
        } catch {
          core = r.valueString;
        }
      }
      break;
    }
    case 'NUMERIC':
      core =
        r.valueNumeric == null
          ? ''
          : `${r.valueNumeric}${r.numericUnit ? ' ' + r.numericUnit : ''}`;
      break;
    case 'DATE':
      core = r.valueDate ? r.valueDate.toISOString().slice(0, 10) : '';
      break;
    case 'PHOTO':
      core = `${r.attachments.length} photo${r.attachments.length === 1 ? '' : 's'}`;
      break;
    default:
      core = r.valueString ?? '';
  }
  return core;
}

// ============================================================================
// 7. Equipment-type inspection log — one row per completed inspection,
//    across every equipment of a given type. Fixed columns identify the
//    equipment + inspector + inspection number; dynamic columns come
//    from every question ever answered on inspections in the range.
// ============================================================================

export interface EquipmentTypeLogRow {
  inspectionId: string;
  inspectionNumber: string;
  periodKey: string;
  completedAt: string;
  inspectorName: string;
  inspectorUsername: string;
  confirmationName: string;
  result: string;
  hasSafetyCriticalFailure: boolean;
  remarks: string;
  templateName: string;
  templateVersion: number;
  /// Equipment info per row (each inspection is a different equipment).
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  serialNumber: string;
  assetNumber: string;
  location: string;
  unitCode: string;
  departmentCode: string;
  answers: Record<string, InspectionLogAnswer>;
}

export interface EquipmentTypeLogReport {
  equipmentType: {
    id: string;
    key: string;
    name: string;
  };
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalInspections: number;
    equipmentCount: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
  };
  questions: InspectionLogQuestion[];
  rows: EquipmentTypeLogRow[];
}

export async function equipmentTypeInspectionLogReport(opts: {
  actor: Actor;
  equipmentTypeId: string;
  fromDate?: string;
  toDate?: string;
  unitId?: string;
}): Promise<EquipmentTypeLogReport> {
  const equipmentType = await prisma.equipmentType.findUnique({
    where: { id: opts.equipmentTypeId },
    select: { id: true, key: true, name: true },
  });
  if (!equipmentType) throw notFound('Equipment type not found.');

  const rangeSpecified = !!(opts.fromDate || opts.toDate);
  let range: DateRange | null = null;
  if (rangeSpecified) {
    range = resolveDateRange({
      fromDate: opts.fromDate,
      toDate: opts.toDate,
    });
  }

  const scopeUnit = scopeUnitId(opts.actor, opts.unitId);

  const inspections = await prisma.inspection.findMany({
    where: {
      status: 'COMPLETED',
      ...(range ? { periodKey: { in: range.periodKeys } } : {}),
      equipment: {
        equipmentTypeId: opts.equipmentTypeId,
        ...(scopeUnit ? { unitId: scopeUnit } : {}),
      },
    },
    include: {
      inspector: { select: { fullName: true, username: true } },
      equipment: {
        select: {
          id: true,
          equipmentCode: true,
          name: true,
          serialNumber: true,
          assetNumber: true,
          area: true,
          building: true,
          floor: true,
          location: true,
          exactLocation: true,
          unit: { select: { code: true } },
          department: { select: { code: true } },
        },
      },
      responses: {
        include: {
          attachments: { select: { id: true } },
        },
      },
      templateVersion: {
        select: {
          versionNumber: true,
          template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ completedAt: 'desc' }],
  });

  // Look up section + sequence for every question referenced.
  const allQuestionIds = new Set<string>();
  for (const insp of inspections) {
    for (const r of insp.responses) allQuestionIds.add(r.questionId);
  }
  const questionMeta = new Map<
    string,
    { sequence: number; sectionTitle: string; sectionSequence: number }
  >();
  if (allQuestionIds.size > 0) {
    const qRows = await prisma.checklistQuestion.findMany({
      where: { id: { in: Array.from(allQuestionIds) } },
      select: {
        id: true,
        sequence: true,
        section: { select: { title: true, sequence: true } },
      },
    });
    for (const q of qRows) {
      questionMeta.set(q.id, {
        sequence: q.sequence,
        sectionTitle: q.section.title,
        sectionSequence: q.section.sequence,
      });
    }
  }

  const seen = new Map<string, InspectionLogQuestion>();
  for (const insp of inspections) {
    for (const r of insp.responses) {
      if (seen.has(r.questionId)) continue;
      const meta = questionMeta.get(r.questionId);
      seen.set(r.questionId, {
        key: r.questionId,
        text: r.questionText,
        type: r.questionType,
        isSafetyCritical: r.isSafetyCritical,
        isMandatory: r.isMandatory,
        sectionTitle: meta?.sectionTitle ?? '',
        sortKey:
          (meta?.sectionSequence ?? 999) * 1000 + (meta?.sequence ?? 999),
      });
    }
  }
  const questions = Array.from(seen.values()).sort(
    (a, b) => a.sortKey - b.sortKey,
  );

  const rows: EquipmentTypeLogRow[] = inspections.map((insp) => {
    const answers: Record<string, InspectionLogAnswer> = {};
    for (const r of insp.responses) {
      answers[r.questionId] = {
        valueString: r.valueString,
        valueNumeric: r.valueNumeric,
        valueDate: r.valueDate ? r.valueDate.toISOString() : null,
        isFail: r.isFail,
        notes: r.notes,
        attachmentCount: r.attachments.length,
        display: formatAnswer(r),
      };
    }
    const eq = insp.equipment;
    const locationParts = [eq.building, eq.floor, eq.area, eq.location, eq.exactLocation]
      .filter((p) => !!p && String(p).trim().length > 0)
      .join(' · ');
    return {
      inspectionId: insp.id,
      inspectionNumber: insp.inspectionNumber ?? '',
      periodKey: insp.periodKey,
      completedAt: insp.completedAt ? insp.completedAt.toISOString() : '',
      inspectorName: insp.inspector.fullName,
      inspectorUsername: insp.inspector.username,
      confirmationName: insp.confirmationName ?? '',
      result: insp.result ?? '',
      hasSafetyCriticalFailure: insp.hasSafetyCriticalFailure,
      remarks: insp.remarks ?? '',
      templateName: insp.templateVersion.template.name,
      templateVersion: insp.templateVersion.versionNumber,
      equipmentId: eq.id,
      equipmentCode: eq.equipmentCode,
      equipmentName: eq.name,
      serialNumber: eq.serialNumber ?? '',
      assetNumber: eq.assetNumber ?? '',
      location: locationParts,
      unitCode: eq.unit.code,
      departmentCode: eq.department?.code ?? '',
      answers,
    };
  });

  const uniqueEquipment = new Set(rows.map((r) => r.equipmentId)).size;

  return {
    equipmentType: {
      id: equipmentType.id,
      key: equipmentType.key,
      name: equipmentType.name,
    },
    fromDate: range?.fromDate.toISOString() ?? null,
    toDate: range?.toDate.toISOString() ?? null,
    summary: {
      totalInspections: rows.length,
      equipmentCount: uniqueEquipment,
      passed: rows.filter((r) => r.result === 'PASS').length,
      failed: rows.filter((r) => r.result === 'FAIL').length,
      safetyCriticalFailures: rows.filter((r) => r.hasSafetyCriticalFailure)
        .length,
    },
    questions,
    rows,
  };
}

export async function equipmentInspectionLogReport(opts: {
  actor: Actor;
  equipmentId: string;
  fromDate?: string;
  toDate?: string;
}): Promise<InspectionLogReport> {
  const equipment = await prisma.equipment.findUnique({
    where: { id: opts.equipmentId },
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      qrCodeValue: true,
      serialNumber: true,
      manufacturer: true,
      model: true,
      capacity: true,
      assetNumber: true,
      area: true,
      building: true,
      floor: true,
      location: true,
      exactLocation: true,
      status: true,
      installationDate: true,
      unitId: true,
      unit: { select: { code: true, name: true } },
      department: { select: { code: true, name: true } },
      equipmentType: { select: { key: true, name: true } },
    },
  });
  if (!equipment) throw notFound('Equipment not found.');

  if (!isBroad(opts.actor)) {
    if (!opts.actor.unitId || opts.actor.unitId !== equipment.unitId) {
      throw badRequest(
        'You cannot view logs for equipment outside your unit.',
        'FORBIDDEN_UNIT',
      );
    }
  }

  const rangeSpecified = !!(opts.fromDate || opts.toDate);
  let range: DateRange | null = null;
  if (rangeSpecified) {
    range = resolveDateRange({
      fromDate: opts.fromDate,
      toDate: opts.toDate,
    });
  }

  const inspections = await prisma.inspection.findMany({
    where: {
      equipmentId: opts.equipmentId,
      status: 'COMPLETED',
      ...(range ? { periodKey: { in: range.periodKeys } } : {}),
    },
    include: {
      inspector: { select: { fullName: true, username: true } },
      responses: {
        include: {
          attachments: { select: { id: true } },
        },
      },
      templateVersion: {
        select: {
          versionNumber: true,
          template: { select: { name: true } },
        },
      },
    },
    orderBy: [{ periodKey: 'desc' }, { completedAt: 'desc' }],
  });

  // Look up section + sequence for every question referenced so we can
  // order the columns consistently.
  const allQuestionIds = new Set<string>();
  for (const insp of inspections) {
    for (const r of insp.responses) allQuestionIds.add(r.questionId);
  }
  const questionMeta = new Map<
    string,
    { sequence: number; sectionTitle: string; sectionSequence: number }
  >();
  if (allQuestionIds.size > 0) {
    const qRows = await prisma.checklistQuestion.findMany({
      where: { id: { in: Array.from(allQuestionIds) } },
      select: {
        id: true,
        sequence: true,
        section: { select: { title: true, sequence: true } },
      },
    });
    for (const q of qRows) {
      questionMeta.set(q.id, {
        sequence: q.sequence,
        sectionTitle: q.section.title,
        sectionSequence: q.section.sequence,
      });
    }
  }

  // Collect unique questions from all inspections in range.
  const seen = new Map<string, InspectionLogQuestion>();
  for (const insp of inspections) {
    for (const r of insp.responses) {
      if (seen.has(r.questionId)) continue;
      const meta = questionMeta.get(r.questionId);
      seen.set(r.questionId, {
        key: r.questionId,
        text: r.questionText,
        type: r.questionType,
        isSafetyCritical: r.isSafetyCritical,
        isMandatory: r.isMandatory,
        sectionTitle: meta?.sectionTitle ?? '',
        sortKey:
          (meta?.sectionSequence ?? 999) * 1000 + (meta?.sequence ?? 999),
      });
    }
  }
  const questions = Array.from(seen.values()).sort(
    (a, b) => a.sortKey - b.sortKey,
  );

  const rows: InspectionLogRow[] = inspections.map((insp) => {
    const answers: Record<string, InspectionLogAnswer> = {};
    for (const r of insp.responses) {
      answers[r.questionId] = {
        valueString: r.valueString,
        valueNumeric: r.valueNumeric,
        valueDate: r.valueDate ? r.valueDate.toISOString() : null,
        isFail: r.isFail,
        notes: r.notes,
        attachmentCount: r.attachments.length,
        display: formatAnswer(r),
      };
    }
    return {
      inspectionId: insp.id,
      periodKey: insp.periodKey,
      completedAt: insp.completedAt ? insp.completedAt.toISOString() : '',
      inspectorName: insp.inspector.fullName,
      inspectorUsername: insp.inspector.username,
      confirmationName: insp.confirmationName ?? '',
      result: insp.result ?? '',
      hasSafetyCriticalFailure: insp.hasSafetyCriticalFailure,
      remarks: insp.remarks ?? '',
      templateName: insp.templateVersion.template.name,
      templateVersion: insp.templateVersion.versionNumber,
      answers,
    };
  });

  return {
    equipment: {
      id: equipment.id,
      equipmentCode: equipment.equipmentCode,
      name: equipment.name,
      qrCodeValue: equipment.qrCodeValue,
      serialNumber: equipment.serialNumber,
      manufacturer: equipment.manufacturer,
      model: equipment.model,
      capacity: equipment.capacity,
      assetNumber: equipment.assetNumber,
      building: equipment.building,
      floor: equipment.floor,
      area: equipment.area,
      location: equipment.location,
      exactLocation: equipment.exactLocation,
      status: equipment.status,
      installationDate: equipment.installationDate
        ? equipment.installationDate.toISOString()
        : null,
      unitCode: equipment.unit.code,
      unitName: equipment.unit.name,
      departmentCode: equipment.department?.code ?? null,
      departmentName: equipment.department?.name ?? null,
      equipmentTypeKey: equipment.equipmentType.key,
      equipmentTypeName: equipment.equipmentType.name,
    },
    fromDate: range?.fromDate.toISOString() ?? null,
    toDate: range?.toDate.toISOString() ?? null,
    summary: {
      totalInspections: rows.length,
      passed: rows.filter((r) => r.result === 'PASS').length,
      failed: rows.filter((r) => r.result === 'FAIL').length,
      safetyCriticalFailures: rows.filter((r) => r.hasSafetyCriticalFailure)
        .length,
      lastCompletedAt: rows[0]?.completedAt ?? '',
    },
    questions,
    rows,
  };
}
