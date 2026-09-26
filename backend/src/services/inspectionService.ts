import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors.js';
import {
  computeDueDate,
  currentPeriod,
  periodFromKey,
} from '../lib/inspectionPeriod.js';
import { findApplicableChecklistForEquipment } from './checklistTemplateService.js';
import { autoCreateForFailedResponse } from './correctiveActionService.js';
import { ROLE_KEYS, type RoleKey } from '../lib/rbac.js';

// ---------------------------------------------------------------------------
// Read shapes
// ---------------------------------------------------------------------------

const inspectionListInclude = {
  equipment: {
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      qrCodeValue: true,
      unitId: true,
      equipmentType: { select: { id: true, key: true, name: true } },
    },
  },
  unit: { select: { id: true, code: true, name: true } },
  inspector: { select: { id: true, username: true, fullName: true } },
  templateVersion: {
    select: {
      id: true,
      versionNumber: true,
      template: { select: { id: true, name: true } },
    },
  },
  _count: { select: { responses: true, attachments: true } },
} as const;

const inspectionDetailInclude = {
  equipment: {
    // Full context so the perform page can show location, department,
    // serial etc. right next to the checklist without extra round-trips.
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      qrCodeValue: true,
      unitId: true,
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
      isActive: true,
      installationDate: true,
      equipmentType: { select: { id: true, key: true, name: true } },
      department: { select: { id: true, code: true, name: true } },
    },
  },
  unit: { select: { id: true, code: true, name: true } },
  inspector: { select: { id: true, username: true, fullName: true } },
  // Full template + sections + questions so the perform UI has
  // everything it needs to render without a second round-trip.
  templateVersion: {
    include: {
      template: { select: { id: true, name: true, description: true } },
      sections: {
        orderBy: { sequence: 'asc' },
        include: {
          questions: { orderBy: { sequence: 'asc' } },
        },
      },
    },
  },
  responses: {
    orderBy: { createdAt: 'asc' },
    include: { attachments: true },
  },
  attachments: true,
  _count: { select: { responses: true, attachments: true } },
} as const;

// ---------------------------------------------------------------------------
// Actor scope
// ---------------------------------------------------------------------------

export interface Actor {
  id: string;
  roleKey: string;
  unitId: string | null;
}

function isBroadRole(actor: Actor): boolean {
  return (
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
  );
}

function assertCanActOnUnit(actor: Actor, targetUnitId: string): void {
  if (isBroadRole(actor)) return;
  if (!actor.unitId || actor.unitId !== targetUnitId) {
    throw forbidden('You cannot act on equipment outside your unit.');
  }
}

// ---------------------------------------------------------------------------
// List / detail
// ---------------------------------------------------------------------------

export interface ListInspectionsOptions {
  actor: Actor;
  equipmentId?: string;
  unitId?: string;
  status?: 'PENDING' | 'COMPLETED';
  result?: 'PASS' | 'FAIL';
  inspectorId?: string;
  periodKey?: string;
  page?: number;
  pageSize?: number;
}

export async function listInspections(opts: ListInspectionsOptions) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));

  const scopeUnitId = isBroadRole(opts.actor)
    ? opts.unitId
    : opts.actor.unitId ?? '__none__';

  const where: Prisma.InspectionWhereInput = {
    equipmentId: opts.equipmentId,
    unitId: scopeUnitId,
    status: opts.status,
    result: opts.result,
    inspectorId: opts.inspectorId,
    periodKey: opts.periodKey,
  };

  const [total, rows] = await Promise.all([
    prisma.inspection.count({ where }),
    prisma.inspection.findMany({
      where,
      include: inspectionListInclude,
      orderBy: [{ status: 'asc' }, { completedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, rows };
}

export async function getInspection(actor: Actor, id: string) {
  const item = await prisma.inspection.findUnique({
    where: { id },
    include: inspectionDetailInclude,
  });
  if (!item) throw notFound('Inspection not found.');
  assertCanActOnUnit(actor, item.unitId);
  return item;
}

/**
 * List every past inspection for a given equipment, latest first.
 * Used by the equipment detail page.
 */
export async function listInspectionsForEquipment(
  actor: Actor,
  equipmentId: string,
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, unitId: true },
  });
  if (!equipment) throw notFound('Equipment not found.');
  assertCanActOnUnit(actor, equipment.unitId);

  return prisma.inspection.findMany({
    where: { equipmentId },
    include: inspectionListInclude,
    orderBy: [{ periodKey: 'desc' }, { createdAt: 'desc' }],
  });
}

/**
 * Read-only lookup of the current-period inspection for an equipment.
 * Used by the scan flow and the equipment detail page to decide
 * whether to show "Start", "Continue", or "View" as the next action —
 * without triggering the side-effect of creating one.
 *
 * Returns null if no inspection exists yet for the given period.
 */
export async function getCurrentInspectionForEquipment(
  actor: Actor,
  equipmentId: string,
  periodKey?: string,
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      unitId: true,
      isActive: true,
      status: true,
      equipmentType: { select: { inspectionFrequencyDays: true } },
    },
  });
  if (!equipment) throw notFound('Equipment not found.');
  assertCanActOnUnit(actor, equipment.unitId);

  const period = periodKey ? periodFromKey(periodKey) : currentPeriod();

  const inspection = await prisma.inspection.findUnique({
    where: {
      equipmentId_periodKey: { equipmentId, periodKey: period.periodKey },
    },
    include: inspectionListInclude,
  });

  // Explain why an inspection can't be started, so the UI can render
  // a helpful message alongside the eligibility flag.
  let ineligibleReason: string | null = null;
  if (!equipment.isActive) ineligibleReason = 'EQUIPMENT_INACTIVE';
  else if (equipment.status === 'RETIRED') ineligibleReason = 'EQUIPMENT_RETIRED';
  else if (equipment.status === 'OUT_OF_SERVICE')
    ineligibleReason = 'EQUIPMENT_OUT_OF_SERVICE';

  return {
    equipmentId,
    periodKey: period.periodKey,
    inspection,
    eligibleToStart: ineligibleReason === null,
    ineligibleReason,
  };
}

// ---------------------------------------------------------------------------
// Schedule — combine equipment + this month's inspection status
// ---------------------------------------------------------------------------

export type ScheduleRowStatus = 'DUE' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface ScheduleRow {
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    qrCodeValue: string;
    unit: { id: string; code: string; name: string };
    equipmentType: { id: string; key: string; name: string };
    status: string;
    isActive: boolean;
  };
  monthlyStatus: ScheduleRowStatus;
  inspection: {
    id: string;
    status: 'PENDING' | 'COMPLETED';
    result: string | null;
    completedAt: Date | null;
    dueDate: Date;
    hasSafetyCriticalFailure: boolean;
    inspector: { id: string; fullName: string } | null;
  } | null;
}

export interface ScheduleOptions {
  actor: Actor;
  periodKey?: string;
  unitId?: string;
  equipmentTypeId?: string;
  monthlyStatus?: ScheduleRowStatus;
}

export async function listSchedule(opts: ScheduleOptions): Promise<{
  periodKey: string;
  summary: Record<ScheduleRowStatus, number>;
  rows: ScheduleRow[];
}> {
  const period = opts.periodKey
    ? periodFromKey(opts.periodKey)
    : currentPeriod();

  const scopeUnitId = isBroadRole(opts.actor)
    ? opts.unitId
    : opts.actor.unitId ?? '__none__';

  const equipment = await prisma.equipment.findMany({
    where: {
      isActive: true,
      status: { not: 'RETIRED' },
      unitId: scopeUnitId,
      equipmentTypeId: opts.equipmentTypeId,
    },
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      qrCodeValue: true,
      status: true,
      isActive: true,
      unit: { select: { id: true, code: true, name: true } },
      equipmentType: {
        select: {
          id: true,
          key: true,
          name: true,
          inspectionFrequencyDays: true,
        },
      },
    },
    orderBy: [{ unit: { code: 'asc' } }, { equipmentCode: 'asc' }],
  });

  const inspections = await prisma.inspection.findMany({
    where: {
      periodKey: period.periodKey,
      equipmentId: { in: equipment.map((e) => e.id) },
    },
    select: {
      id: true,
      equipmentId: true,
      status: true,
      result: true,
      completedAt: true,
      dueDate: true,
      hasSafetyCriticalFailure: true,
      inspector: { select: { id: true, fullName: true } },
    },
  });
  const byEquipment = new Map(inspections.map((i) => [i.equipmentId, i]));

  const now = new Date();
  const summary: Record<ScheduleRowStatus, number> = {
    DUE: 0,
    IN_PROGRESS: 0,
    COMPLETED: 0,
    OVERDUE: 0,
  };
  const rows: ScheduleRow[] = [];

  for (const eq of equipment) {
    const insp = byEquipment.get(eq.id);
    let monthlyStatus: ScheduleRowStatus;
    if (!insp) {
      const dueDate = computeDueDate(
        period,
        eq.equipmentType.inspectionFrequencyDays,
      );
      monthlyStatus = dueDate.getTime() < now.getTime() ? 'OVERDUE' : 'DUE';
    } else if (insp.status === 'COMPLETED') {
      monthlyStatus = 'COMPLETED';
    } else {
      monthlyStatus =
        insp.dueDate.getTime() < now.getTime() ? 'OVERDUE' : 'IN_PROGRESS';
    }

    summary[monthlyStatus]++;

    if (opts.monthlyStatus && opts.monthlyStatus !== monthlyStatus) continue;

    rows.push({
      equipment: {
        id: eq.id,
        equipmentCode: eq.equipmentCode,
        name: eq.name,
        qrCodeValue: eq.qrCodeValue,
        unit: eq.unit,
        equipmentType: {
          id: eq.equipmentType.id,
          key: eq.equipmentType.key,
          name: eq.equipmentType.name,
        },
        status: eq.status,
        isActive: eq.isActive,
      },
      monthlyStatus,
      inspection: insp
        ? {
            id: insp.id,
            status: insp.status as 'PENDING' | 'COMPLETED',
            result: insp.result,
            completedAt: insp.completedAt,
            dueDate: insp.dueDate,
            hasSafetyCriticalFailure: insp.hasSafetyCriticalFailure,
            inspector: insp.inspector,
          }
        : null,
    });
  }

  return { periodKey: period.periodKey, summary, rows };
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

/**
 * Start (or resume) an inspection for the given equipment in the
 * current period. If a PENDING inspection already exists, returns
 * that one. If a COMPLETED inspection already exists, refuses with
 * `409 ALREADY_COMPLETED_THIS_PERIOD`.
 */
export async function startInspection(actor: Actor, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      isActive: true,
      status: true,
      unitId: true,
      equipmentType: {
        select: { inspectionFrequencyDays: true },
      },
    },
  });
  if (!equipment) throw notFound('Equipment not found.');
  assertCanActOnUnit(actor, equipment.unitId);

  if (!equipment.isActive) {
    throw badRequest('Equipment is deactivated.', 'EQUIPMENT_INACTIVE');
  }
  if (equipment.status === 'RETIRED') {
    throw badRequest('Equipment is retired.', 'EQUIPMENT_RETIRED');
  }
  if (equipment.status === 'OUT_OF_SERVICE') {
    throw badRequest(
      'Equipment is out of service. Reactivate it before performing an inspection.',
      'EQUIPMENT_OUT_OF_SERVICE',
    );
  }

  const period = currentPeriod();
  const dueDate = computeDueDate(
    period,
    equipment.equipmentType.inspectionFrequencyDays,
  );

  const existing = await prisma.inspection.findUnique({
    where: {
      equipmentId_periodKey: {
        equipmentId,
        periodKey: period.periodKey,
      },
    },
    include: inspectionDetailInclude,
  });

  if (existing) {
    if (existing.status === 'COMPLETED') {
      throw conflict(
        'An inspection for this equipment has already been submitted this month.',
        'ALREADY_COMPLETED_THIS_PERIOD',
      );
    }
    return existing;
  }

  const checklist = await findApplicableChecklistForEquipment(equipmentId);
  if (!checklist) {
    throw badRequest(
      'No published checklist template applies to this equipment. Ask an admin to publish one first.',
      'NO_APPLICABLE_CHECKLIST',
    );
  }

  const created = await prisma.inspection.create({
    data: {
      equipmentId,
      templateVersionId: checklist.version.id,
      unitId: equipment.unitId,
      inspectorId: actor.id,
      periodKey: period.periodKey,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      dueDate,
      status: 'PENDING',
    },
    include: inspectionDetailInclude,
  });
  return created;
}

// ---------------------------------------------------------------------------
// Save / submit
// ---------------------------------------------------------------------------

export interface ResponseInput {
  questionId: string;
  valueString?: string | null;
  valueNumeric?: number | null;
  valueDate?: string | null;
  notes?: string | null;
}

function assertPending(inspection: { status: string }) {
  if (inspection.status !== 'PENDING') {
    throw badRequest(
      'This inspection has been submitted and cannot be edited.',
      'INSPECTION_LOCKED',
    );
  }
}

function assertOwnership(actor: Actor, inspection: { inspectorId: string; unitId: string }) {
  if (isBroadRole(actor)) return;
  if (inspection.inspectorId !== actor.id) {
    throw forbidden('Only the inspector who started this inspection can edit it.');
  }
}

/**
 * Compute whether an answer is a "fail" for auto-fail rules.
 * The inspector's explicit valueString wins for PASS_FAIL / YES_NO,
 * NUMERIC uses range if defined, other types are informational.
 */
function computeIsFail(
  questionType: string,
  value: {
    valueString?: string | null;
    valueNumeric?: number | null;
  },
  extras: { numericMin?: number | null; numericMax?: number | null },
): boolean {
  const s = value.valueString?.toUpperCase();
  switch (questionType) {
    case 'PASS_FAIL':
      return s === 'FAIL';
    case 'YES_NO':
      return s === 'NO';
    case 'NUMERIC': {
      if (value.valueNumeric == null) return false;
      const v = value.valueNumeric;
      if (extras.numericMin != null && v < extras.numericMin) return true;
      if (extras.numericMax != null && v > extras.numericMax) return true;
      return false;
    }
    default:
      return false;
  }
}

function isAnswered(
  questionType: string,
  value: {
    valueString?: string | null;
    valueNumeric?: number | null;
    valueDate?: string | null;
  },
  attachmentCount: number,
): boolean {
  switch (questionType) {
    case 'PASS_FAIL':
    case 'YES_NO':
    case 'DROPDOWN':
    case 'TEXT':
    case 'REMARKS':
      return !!value.valueString && value.valueString.trim().length > 0;
    case 'NUMERIC':
      return value.valueNumeric != null;
    case 'DATE':
      return !!value.valueDate;
    case 'PHOTO':
      return attachmentCount > 0;
    default:
      return false;
  }
}

/**
 * Save-in-progress: upserts responses on a PENDING inspection.
 * Does not validate mandatory answers — that's checked at submit.
 */
export async function saveInspectionProgress(
  actor: Actor,
  id: string,
  input: { responses: ResponseInput[]; remarks?: string | null },
) {
  const existing = await prisma.inspection.findUnique({
    where: { id },
    include: {
      templateVersion: {
        include: {
          sections: { include: { questions: true } },
        },
      },
      responses: { include: { attachments: true } },
    },
  });
  if (!existing) throw notFound('Inspection not found.');
  assertCanActOnUnit(actor, existing.unitId);
  assertOwnership(actor, existing);
  assertPending(existing);

  const questionsById = new Map(
    existing.templateVersion.sections
      .flatMap((s) => s.questions)
      .map((q) => [q.id, q]),
  );

  await prisma.$transaction(async (tx) => {
    for (const r of input.responses) {
      const q = questionsById.get(r.questionId);
      if (!q) {
        throw badRequest(
          `Unknown question id "${r.questionId}" for this inspection.`,
          'UNKNOWN_QUESTION',
        );
      }
      const valueDate = r.valueDate ? new Date(r.valueDate) : null;
      if (r.valueDate && Number.isNaN(valueDate?.getTime())) {
        throw badRequest(`Invalid date value for question "${q.text}".`, 'INVALID_DATE');
      }
      if (q.questionType === 'DROPDOWN' && r.valueString && q.optionsJson) {
        try {
          const opts = JSON.parse(q.optionsJson) as string[];
          if (Array.isArray(opts) && !opts.includes(r.valueString)) {
            throw badRequest(
              `"${r.valueString}" is not a valid option for question "${q.text}".`,
              'INVALID_DROPDOWN_ANSWER',
            );
          }
        } catch {
          // If optionsJson is malformed we skip validation rather than crash.
        }
      }

      const isFail = computeIsFail(q.questionType, r, {
        numericMin: q.numericMin,
        numericMax: q.numericMax,
      });

      await tx.inspectionResponse.upsert({
        where: {
          inspectionId_questionId: {
            inspectionId: id,
            questionId: r.questionId,
          },
        },
        create: {
          inspectionId: id,
          questionId: r.questionId,
          questionText: q.text,
          questionType: q.questionType,
          isMandatory: q.isMandatory,
          isSafetyCritical: q.isSafetyCritical,
          requiresCorrectiveActionOnFail: q.requiresCorrectiveActionOnFail,
          numericMin: q.numericMin,
          numericMax: q.numericMax,
          numericUnit: q.numericUnit,
          optionsJson: q.optionsJson,
          valueString: r.valueString ?? null,
          valueNumeric: r.valueNumeric ?? null,
          valueDate,
          notes: r.notes ?? null,
          isFail,
        },
        update: {
          valueString: r.valueString ?? null,
          valueNumeric: r.valueNumeric ?? null,
          valueDate,
          notes: r.notes ?? null,
          isFail,
        },
      });
    }

    if (input.remarks !== undefined) {
      await tx.inspection.update({
        where: { id },
        data: { remarks: input.remarks?.trim() || null },
      });
    }
  });

  return prisma.inspection.findUniqueOrThrow({
    where: { id },
    include: inspectionDetailInclude,
  });
}

// ---------------------------------------------------------------------------
// Submit
// ---------------------------------------------------------------------------

export interface SubmitInput {
  responses: ResponseInput[];
  remarks?: string | null;
  confirmationName: string;
}

export async function submitInspection(
  actor: Actor,
  id: string,
  input: SubmitInput,
) {
  if (!input.confirmationName?.trim()) {
    throw badRequest(
      'Please type your name to confirm the submission.',
      'CONFIRMATION_REQUIRED',
    );
  }

  // First: save all responses (this also validates them) — so the
  // submission has the latest values even if the client didn't call
  // save-progress separately.
  await saveInspectionProgress(actor, id, {
    responses: input.responses,
    remarks: input.remarks,
  });

  const existing = await prisma.inspection.findUnique({
    where: { id },
    include: {
      templateVersion: {
        include: { sections: { include: { questions: true } } },
      },
      responses: { include: { attachments: true } },
    },
  });
  if (!existing) throw notFound('Inspection not found.');
  assertPending(existing);

  // Validate: every mandatory question is answered.
  const responseByQ = new Map(existing.responses.map((r) => [r.questionId, r]));
  const unanswered: string[] = [];
  for (const section of existing.templateVersion.sections) {
    for (const q of section.questions) {
      if (!q.isMandatory) continue;
      const r = responseByQ.get(q.id);
      const answered =
        !!r &&
        isAnswered(
          q.questionType,
          {
            valueString: r.valueString,
            valueNumeric: r.valueNumeric,
            valueDate: r.valueDate ? r.valueDate.toISOString() : null,
          },
          r.attachments.length,
        );
      if (!answered) unanswered.push(q.text);
    }
  }
  if (unanswered.length > 0) {
    throw badRequest(
      `${unanswered.length} mandatory question${unanswered.length === 1 ? '' : 's'} still need${unanswered.length === 1 ? 's' : ''} an answer: ${unanswered
        .slice(0, 3)
        .join('; ')}${unanswered.length > 3 ? '…' : ''}`,
      'MANDATORY_UNANSWERED',
    );
  }

  const anyFail = existing.responses.some((r) => r.isFail);
  const anySafetyFail = existing.responses.some(
    (r) => r.isFail && r.isSafetyCritical,
  );

  // Update the inspection and auto-create corrective actions atomically.
  const unit = await prisma.unit.findUnique({
    where: { id: existing.unitId },
    select: { code: true },
  });
  if (!unit) throw notFound('Inspection unit not found.');

  const submitted = await prisma.$transaction(async (tx) => {
    const updated = await tx.inspection.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        result: anyFail ? 'FAIL' : 'PASS',
        hasSafetyCriticalFailure: anySafetyFail,
        completedAt: new Date(),
        confirmationName: input.confirmationName.trim(),
      },
      include: inspectionDetailInclude,
    });

    const autoCandidates = existing.responses.filter(
      (r) => r.isFail && r.requiresCorrectiveActionOnFail,
    );
    for (const r of autoCandidates) {
      await autoCreateForFailedResponse(tx as unknown as PrismaClient, {
        inspectionId: id,
        responseId: r.id,
        equipmentId: updated.equipmentId,
        unitId: updated.unitId,
        questionText: r.questionText,
        isSafetyCritical: r.isSafetyCritical,
        raisedById: actor.id,
        unitCode: unit.code,
      });
    }

    return updated;
  });
  return submitted;
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function assertCanUploadForInspection(
  actor: Actor,
  inspectionId: string,
): Promise<{ id: string; unitId: string; inspectorId: string; status: string }> {
  const insp = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    select: { id: true, unitId: true, inspectorId: true, status: true },
  });
  if (!insp) throw notFound('Inspection not found.');
  assertCanActOnUnit(actor, insp.unitId);
  assertOwnership(actor, insp);
  assertPending(insp);
  return insp;
}

export async function recordAttachment(input: {
  inspectionId: string;
  responseId: string | null;
  storedFilename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  createdById: string;
}) {
  return prisma.inspectionAttachment.create({
    data: input,
    select: {
      id: true,
      inspectionId: true,
      responseId: true,
      storedFilename: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      caption: true,
      createdAt: true,
    },
  });
}

export async function getAttachmentForRead(actor: Actor, id: string) {
  const att = await prisma.inspectionAttachment.findUnique({
    where: { id },
    include: {
      inspection: { select: { id: true, unitId: true } },
    },
  });
  if (!att) throw notFound('Attachment not found.');
  assertCanActOnUnit(actor as Actor, att.inspection.unitId);
  return att;
}

// Re-export for callers that just need the role type
export type { RoleKey };
