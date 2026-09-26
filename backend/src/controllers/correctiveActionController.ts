import type { RequestHandler } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/correctiveActionService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import {
  CA_ATTACHMENT_STAGES,
  CA_PRIORITIES,
  CA_STATUSES,
  type CaAttachmentStage,
} from '../lib/correctiveActionTypes.js';
import {
  assertImageAcceptable,
  correctiveActionAttachmentPathFor,
  storeCorrectiveActionAttachment,
} from '../lib/fileStorage.js';

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const createSchema = z.object({
  equipmentId: z.string().min(1),
  title: z.string().min(1).max(300),
  description: z.string().min(1).max(4000),
  priority: z.enum(CA_PRIORITIES).optional(),
  assigneeId: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
  sourceInspectionId: z.string().optional().nullable(),
  sourceResponseId: z.string().optional().nullable(),
  failedItemText: z.string().max(2000).optional().nullable(),
});

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1).max(4000).optional(),
  priority: z.enum(CA_PRIORITIES).optional(),
  assigneeId: z.string().optional().nullable(),
  targetDate: z.string().optional().nullable(),
});

const resolveSchema = z.object({
  resolutionRemarks: z.string().min(1).max(4000),
});

const closeSchema = z.object({
  closureRemarks: z.string().min(1).max(4000),
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function actor(req: Parameters<RequestHandler>[0]) {
  const u = req.user!;
  return {
    id: u.id,
    roleKey: u.roleKey,
    unitId: u.unitId,
    permissions: u.permissions,
  };
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const page =
    typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number.parseInt(req.query.pageSize, 10)
      : 25;

  const status =
    typeof req.query.status === 'string' &&
    CA_STATUSES.includes(req.query.status as (typeof CA_STATUSES)[number])
      ? (req.query.status as (typeof CA_STATUSES)[number])
      : undefined;
  const priority =
    typeof req.query.priority === 'string' &&
    CA_PRIORITIES.includes(
      req.query.priority as (typeof CA_PRIORITIES)[number],
    )
      ? (req.query.priority as (typeof CA_PRIORITIES)[number])
      : undefined;

  const data = await service.listCorrectiveActions({
    actor: actor(req),
    equipmentId:
      typeof req.query.equipmentId === 'string' ? req.query.equipmentId : undefined,
    unitId:
      typeof req.query.unitId === 'string' ? req.query.unitId : undefined,
    assigneeId:
      typeof req.query.assigneeId === 'string' ? req.query.assigneeId : undefined,
    sourceInspectionId:
      typeof req.query.sourceInspectionId === 'string'
        ? req.query.sourceInspectionId
        : undefined,
    status,
    priority,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  });
  res.json(data);
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const item = await service.getCorrectiveAction(actor(req), req.params.id);
  res.json({ correctiveAction: item });
});

export const listForEquipment: RequestHandler = asyncHandler(async (req, res) => {
  const rows = await service.listForEquipment(actor(req), req.params.id);
  res.json({ correctiveActions: rows });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createSchema.parse(req.body);
  const ca = await service.createCorrectiveAction(actor(req), parsed);
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.CORRECTIVE_ACTION_CREATE,
    entityType: 'CorrectiveAction',
    entityId: ca.id,
    metadata: {
      code: ca.code,
      equipmentId: ca.equipmentId,
      priority: ca.priority,
      assigneeId: ca.assigneeId,
    },
  });
  res.status(201).json({ correctiveAction: ca });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateSchema.parse(req.body);
  const ca = await service.updateCorrectiveAction(
    actor(req),
    req.params.id,
    parsed,
  );
  const action =
    parsed.assigneeId !== undefined
      ? AUDIT_ACTIONS.CORRECTIVE_ACTION_ASSIGN
      : AUDIT_ACTIONS.CORRECTIVE_ACTION_UPDATE;
  await writeAudit({
    actorId: req.user!.id,
    action,
    entityType: 'CorrectiveAction',
    entityId: ca.id,
    metadata: { changes: parsed },
  });
  res.json({ correctiveAction: ca });
});

export const progress: RequestHandler = asyncHandler(async (req, res) => {
  const ca = await service.markInProgress(actor(req), req.params.id);
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.CORRECTIVE_ACTION_PROGRESS,
    entityType: 'CorrectiveAction',
    entityId: ca.id,
  });
  res.json({ correctiveAction: ca });
});

export const resolve: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = resolveSchema.parse(req.body);
  const ca = await service.markResolved(actor(req), req.params.id, parsed);
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.CORRECTIVE_ACTION_RESOLVE,
    entityType: 'CorrectiveAction',
    entityId: ca.id,
    metadata: { resolutionRemarks: parsed.resolutionRemarks },
  });
  res.json({ correctiveAction: ca });
});

export const close: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = closeSchema.parse(req.body);
  const ca = await service.closeCorrectiveAction(
    actor(req),
    req.params.id,
    parsed,
  );
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.CORRECTIVE_ACTION_CLOSE,
    entityType: 'CorrectiveAction',
    entityId: ca.id,
    metadata: { closureRemarks: parsed.closureRemarks },
  });
  res.json({ correctiveAction: ca });
});

// ------------- Attachments -------------

export const uploadAttachment: RequestHandler = asyncHandler(
  async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('No file uploaded (field "file").', 'NO_FILE');
    await service.assertCanUploadForCa(actor(req), req.params.id);

    assertImageAcceptable({
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });

    const rawStage =
      typeof req.body?.stage === 'string' ? req.body.stage.toUpperCase() : '';
    const stage: CaAttachmentStage = CA_ATTACHMENT_STAGES.includes(
      rawStage as CaAttachmentStage,
    )
      ? (rawStage as CaAttachmentStage)
      : 'EVIDENCE';

    const stored = await storeCorrectiveActionAttachment({
      correctiveActionId: req.params.id,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const attachment = await service.recordAttachment({
      correctiveActionId: req.params.id,
      storedFilename: stored.storedFilename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      caption:
        typeof req.body?.caption === 'string' ? req.body.caption : null,
      stage,
      createdById: req.user!.id,
    });

    await writeAudit({
      actorId: req.user!.id,
      action: AUDIT_ACTIONS.CORRECTIVE_ACTION_ATTACHMENT_UPLOAD,
      entityType: 'CorrectiveActionAttachment',
      entityId: attachment.id,
      metadata: {
        correctiveActionId: req.params.id,
        stage,
        sizeBytes: attachment.sizeBytes,
        mimeType: attachment.mimeType,
      },
    });

    res.status(201).json({ attachment });
  },
);

export const downloadAttachment: RequestHandler = asyncHandler(
  async (req, res) => {
    const att = await service.getAttachmentForRead(actor(req), req.params.id);
    const abs = correctiveActionAttachmentPathFor(
      att.correctiveActionId,
      att.storedFilename,
    );
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${att.originalName.replace(/"/g, '')}"`,
    );
    fs.createReadStream(abs).pipe(res);
  },
);
