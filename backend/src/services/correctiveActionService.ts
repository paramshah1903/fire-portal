import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, forbidden, notFound } from '../lib/errors.js';
import { ROLE_KEYS } from '../lib/rbac.js';
import {
  isCaPriority,
  type CaAttachmentStage,
  type CaPriority,
  type CaStatus,
} from '../lib/correctiveActionTypes.js';

// -----------------------------------------------------------------------------
// Shapes
// -----------------------------------------------------------------------------

const caListInclude = {
  equipment: {
    select: {
      id: true,
      equipmentCode: true,
      name: true,
      unitId: true,
      equipmentType: { select: { id: true, key: true, name: true } },
    },
  },
  unit: { select: { id: true, code: true, name: true } },
  raisedBy: { select: { id: true, username: true, fullName: true } },
  assignee: { select: { id: true, username: true, fullName: true } },
  resolvedBy: { select: { id: true, username: true, fullName: true } },
  closedBy: { select: { id: true, username: true, fullName: true } },
  _count: { select: { attachments: true } },
} as const;

const caDetailInclude = {
  ...caListInclude,
  sourceInspection: {
    select: {
      id: true,
      periodKey: true,
      completedAt: true,
      result: true,
      hasSafetyCriticalFailure: true,
    },
  },
  attachments: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      correctiveActionId: true,
      storedFilename: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      caption: true,
      stage: true,
      createdAt: true,
      createdById: true,
    },
  },
} as const;

// -----------------------------------------------------------------------------
// Actor scope
// -----------------------------------------------------------------------------

export interface Actor {
  id: string;
  roleKey: string;
  unitId: string | null;
  permissions: string[];
}

function isBroadRole(actor: Actor): boolean {
  return (
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
  );
}

function assertCanTouchUnit(actor: Actor, targetUnitId: string): void {
  if (isBroadRole(actor)) return;
  if (!actor.unitId || actor.unitId !== targetUnitId) {
    throw forbidden('You cannot act on records outside your unit.');
  }
}

function assertHasPermission(actor: Actor, key: string): void {
  if (!actor.permissions.includes(key)) {
    throw forbidden('You do not have permission to perform this action.');
  }
}

// -----------------------------------------------------------------------------
// Code generation
// -----------------------------------------------------------------------------

async function nextCode(
  tx: Pick<PrismaClient, 'correctiveAction'>,
  unitCode: string,
): Promise<string> {
  const suffix =
    unitCode.replace(/^UNIT-?/i, '').toUpperCase() || unitCode.toUpperCase();
  const prefix = `CA-${suffix}-`;
  const last = await tx.correctiveAction.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: 'desc' },
    select: { code: true },
  });
  const nextSeq =
    last && /\d+$/.test(last.code)
      ? Number.parseInt(last.code.match(/\d+$/)![0], 10) + 1
      : 1;
  return `${prefix}${String(nextSeq).padStart(5, '0')}`;
}

// -----------------------------------------------------------------------------
// List / detail
// -----------------------------------------------------------------------------

export interface ListOptions {
  actor: Actor;
  equipmentId?: string;
  unitId?: string;
  status?: CaStatus;
  priority?: CaPriority;
  assigneeId?: string;
  sourceInspectionId?: string;
  page?: number;
  pageSize?: number;
}

export async function listCorrectiveActions(opts: ListOptions) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));

  const scopeUnitId = isBroadRole(opts.actor)
    ? opts.unitId
    : opts.actor.unitId ?? '__none__';

  const where: Prisma.CorrectiveActionWhereInput = {
    equipmentId: opts.equipmentId,
    unitId: scopeUnitId,
    status: opts.status,
    priority: opts.priority,
    assigneeId: opts.assigneeId,
    sourceInspectionId: opts.sourceInspectionId,
  };

  // Custom order: open items first (priority CRITICAL/HIGH first), closed last.
  const [total, rows] = await Promise.all([
    prisma.correctiveAction.count({ where }),
    prisma.correctiveAction.findMany({
      where,
      include: caListInclude,
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' }, // string ordering: CRITICAL < HIGH < LOW < MEDIUM — but "CRITICAL" < "HIGH" ✓
        { targetDate: 'asc' },
        { createdAt: 'desc' },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, rows };
}

export async function getCorrectiveAction(actor: Actor, id: string) {
  const item = await prisma.correctiveAction.findUnique({
    where: { id },
    include: caDetailInclude,
  });
  if (!item) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, item.unitId);
  return item;
}

export async function listForEquipment(actor: Actor, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, unitId: true },
  });
  if (!equipment) throw notFound('Equipment not found.');
  assertCanTouchUnit(actor, equipment.unitId);
  return prisma.correctiveAction.findMany({
    where: { equipmentId },
    include: caListInclude,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

// -----------------------------------------------------------------------------
// Manual create
// -----------------------------------------------------------------------------

export interface CreateInput {
  equipmentId: string;
  title: string;
  description: string;
  priority?: CaPriority;
  assigneeId?: string | null;
  targetDate?: string | Date | null;
  sourceInspectionId?: string | null;
  sourceResponseId?: string | null;
  failedItemText?: string | null;
}

export async function createCorrectiveAction(actor: Actor, input: CreateInput) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    select: {
      id: true,
      unitId: true,
      unit: { select: { code: true } },
    },
  });
  if (!equipment) throw badRequest('Equipment not found.', 'UNKNOWN_EQUIPMENT');
  assertCanTouchUnit(actor, equipment.unitId);

  if (input.assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, isActive: true, unitId: true },
    });
    if (!assignee) throw badRequest('Assignee not found.', 'UNKNOWN_ASSIGNEE');
    if (!assignee.isActive) {
      throw badRequest('Assignee is inactive.', 'INACTIVE_ASSIGNEE');
    }
  }

  const priority: CaPriority =
    input.priority && isCaPriority(input.priority) ? input.priority : 'MEDIUM';

  const targetDate = parseDate(input.targetDate);

  return prisma.$transaction(async (tx) => {
    const code = await nextCode(tx as unknown as PrismaClient, equipment.unit.code);
    return tx.correctiveAction.create({
      data: {
        code,
        equipmentId: input.equipmentId,
        unitId: equipment.unitId,
        title: input.title.trim(),
        description: input.description.trim(),
        priority,
        raisedById: actor.id,
        assigneeId: input.assigneeId ?? null,
        targetDate,
        sourceInspectionId: input.sourceInspectionId ?? null,
        sourceResponseId: input.sourceResponseId ?? null,
        failedItemText: input.failedItemText?.trim() || null,
      },
      include: caDetailInclude,
    });
  });
}

function parseDate(raw: string | Date | null | undefined): Date | null {
  if (raw == null || raw === '') return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw badRequest('Invalid date.', 'INVALID_DATE');
  }
  return d;
}

// -----------------------------------------------------------------------------
// Auto-create hook (called by inspectionService.submitInspection)
// -----------------------------------------------------------------------------

export interface AutoCreateSource {
  inspectionId: string;
  responseId: string;
  equipmentId: string;
  unitId: string;
  questionText: string;
  isSafetyCritical: boolean;
  raisedById: string;
  unitCode: string;
}

export async function autoCreateForFailedResponse(
  tx: Pick<PrismaClient, 'correctiveAction'>,
  source: AutoCreateSource,
) {
  const code = await nextCode(tx, source.unitCode);
  const priority: CaPriority = source.isSafetyCritical ? 'HIGH' : 'MEDIUM';
  const title = truncate(source.questionText, 120);
  const description = `Auto-created because the inspection recorded a ${source.isSafetyCritical ? 'safety-critical ' : ''}failure on:\n\n"${source.questionText}"`;

  return tx.correctiveAction.create({
    data: {
      code,
      equipmentId: source.equipmentId,
      unitId: source.unitId,
      title,
      description,
      priority,
      raisedById: source.raisedById,
      sourceInspectionId: source.inspectionId,
      sourceResponseId: source.responseId,
      failedItemText: source.questionText,
    },
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// -----------------------------------------------------------------------------
// Update / lifecycle
// -----------------------------------------------------------------------------

export interface UpdateInput {
  title?: string;
  description?: string;
  priority?: CaPriority;
  assigneeId?: string | null;
  targetDate?: string | Date | null;
}

function assertNotClosed(ca: { status: string }) {
  if (ca.status === 'CLOSED') {
    throw badRequest(
      'This corrective action is closed and cannot be edited.',
      'CA_CLOSED',
    );
  }
}

export async function updateCorrectiveAction(
  actor: Actor,
  id: string,
  input: UpdateInput,
) {
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, existing.unitId);
  assertNotClosed(existing);

  if (input.priority && !isCaPriority(input.priority)) {
    throw badRequest('Invalid priority.', 'INVALID_PRIORITY');
  }

  if (input.assigneeId !== undefined && input.assigneeId !== null) {
    const assignee = await prisma.user.findUnique({
      where: { id: input.assigneeId },
      select: { id: true, isActive: true },
    });
    if (!assignee) throw badRequest('Assignee not found.', 'UNKNOWN_ASSIGNEE');
    if (!assignee.isActive) {
      throw badRequest('Assignee is inactive.', 'INACTIVE_ASSIGNEE');
    }
  }

  return prisma.correctiveAction.update({
    where: { id },
    data: {
      title: input.title?.trim(),
      description: input.description?.trim(),
      priority: input.priority,
      assigneeId:
        input.assigneeId === undefined ? undefined : input.assigneeId ?? null,
      targetDate:
        input.targetDate === undefined ? undefined : parseDate(input.targetDate),
    },
    include: caDetailInclude,
  });
}

export async function markInProgress(actor: Actor, id: string) {
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, existing.unitId);
  assertNotClosed(existing);
  if (existing.status !== 'OPEN' && existing.status !== 'IN_PROGRESS') {
    throw badRequest(
      `Cannot move to In Progress from ${existing.status}.`,
      'INVALID_TRANSITION',
    );
  }
  return prisma.correctiveAction.update({
    where: { id },
    data: { status: 'IN_PROGRESS' },
    include: caDetailInclude,
  });
}

export interface ResolveInput {
  resolutionRemarks: string;
}

export async function markResolved(
  actor: Actor,
  id: string,
  input: ResolveInput,
) {
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, existing.unitId);
  assertNotClosed(existing);
  if (existing.status === 'RESOLVED') return existing; // idempotent
  if (existing.status !== 'OPEN' && existing.status !== 'IN_PROGRESS') {
    throw badRequest(
      `Cannot resolve from ${existing.status}.`,
      'INVALID_TRANSITION',
    );
  }
  if (!input.resolutionRemarks?.trim()) {
    throw badRequest(
      'Resolution remarks are required.',
      'RESOLUTION_REMARKS_REQUIRED',
    );
  }
  return prisma.correctiveAction.update({
    where: { id },
    data: {
      status: 'RESOLVED',
      resolutionRemarks: input.resolutionRemarks.trim(),
      resolvedAt: new Date(),
      resolvedById: actor.id,
    },
    include: caDetailInclude,
  });
}

export interface CloseInput {
  closureRemarks: string;
}

export async function closeCorrectiveAction(
  actor: Actor,
  id: string,
  input: CloseInput,
) {
  assertHasPermission(actor, 'corrective_action.close');
  const existing = await prisma.correctiveAction.findUnique({ where: { id } });
  if (!existing) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, existing.unitId);
  if (existing.status === 'CLOSED') return existing;
  if (existing.status !== 'RESOLVED') {
    throw badRequest(
      'Only resolved corrective actions can be closed.',
      'INVALID_TRANSITION',
    );
  }
  if (!input.closureRemarks?.trim()) {
    throw badRequest(
      'Closure remarks are required.',
      'CLOSURE_REMARKS_REQUIRED',
    );
  }
  return prisma.correctiveAction.update({
    where: { id },
    data: {
      status: 'CLOSED',
      closureRemarks: input.closureRemarks.trim(),
      closedAt: new Date(),
      closedById: actor.id,
    },
    include: caDetailInclude,
  });
}

// -----------------------------------------------------------------------------
// Attachments
// -----------------------------------------------------------------------------

export async function assertCanUploadForCa(
  actor: Actor,
  id: string,
): Promise<{ id: string; unitId: string; status: string }> {
  const ca = await prisma.correctiveAction.findUnique({
    where: { id },
    select: { id: true, unitId: true, status: true },
  });
  if (!ca) throw notFound('Corrective action not found.');
  assertCanTouchUnit(actor, ca.unitId);
  if (ca.status === 'CLOSED') {
    throw badRequest(
      'Cannot attach evidence to a closed corrective action.',
      'CA_CLOSED',
    );
  }
  return ca;
}

export async function recordAttachment(input: {
  correctiveActionId: string;
  storedFilename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  stage: CaAttachmentStage;
  createdById: string;
}) {
  return prisma.correctiveActionAttachment.create({
    data: input,
  });
}

export async function getAttachmentForRead(actor: Actor, id: string) {
  const att = await prisma.correctiveActionAttachment.findUnique({
    where: { id },
    include: { correctiveAction: { select: { id: true, unitId: true } } },
  });
  if (!att) throw notFound('Attachment not found.');
  assertCanTouchUnit(actor, att.correctiveAction.unitId);
  return att;
}
