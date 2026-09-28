import type { RequestHandler } from 'express';
import fs from 'node:fs';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/inspectionService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import {
  assertImageAcceptable,
  attachmentPathFor,
  storeInspectionAttachment,
} from '../lib/fileStorage.js';

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const responseSchema = z.object({
  questionId: z.string().min(1),
  valueString: z.string().max(4000).optional().nullable(),
  valueNumeric: z.number().optional().nullable(),
  valueDate: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

const startSchema = z.object({
  equipmentId: z.string().min(1),
});

const saveSchema = z.object({
  responses: z.array(responseSchema).default([]),
  remarks: z.string().max(4000).optional().nullable(),
});

const submitSchema = z.object({
  responses: z.array(responseSchema).default([]),
  remarks: z.string().max(4000).optional().nullable(),
  confirmationName: z.string().min(1).max(200),
});

const scheduleStatusEnum = z.enum([
  'DUE',
  'IN_PROGRESS',
  'COMPLETED',
  'OVERDUE',
]);

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function actor(req: Parameters<RequestHandler>[0]) {
  const u = req.user!;
  return { id: u.id, roleKey: u.roleKey, unitId: u.unitId };
}

// -----------------------------------------------------------------------------
// Handlers
// -----------------------------------------------------------------------------

export const listInspections: RequestHandler = asyncHandler(async (req, res) => {
  const page =
    typeof req.query.page === 'string' ? Number.parseInt(req.query.page, 10) : 1;
  const pageSize =
    typeof req.query.pageSize === 'string'
      ? Number.parseInt(req.query.pageSize, 10)
      : 25;

  const status =
    req.query.status === 'PENDING' ||
    req.query.status === 'PENDING_APPROVAL' ||
    req.query.status === 'COMPLETED'
      ? req.query.status
      : undefined;
  const result =
    req.query.result === 'PASS' || req.query.result === 'FAIL'
      ? req.query.result
      : undefined;

  const data = await service.listInspections({
    actor: actor(req),
    equipmentId:
      typeof req.query.equipmentId === 'string'
        ? req.query.equipmentId
        : undefined,
    unitId:
      typeof req.query.unitId === 'string' ? req.query.unitId : undefined,
    inspectorId:
      typeof req.query.inspectorId === 'string'
        ? req.query.inspectorId
        : undefined,
    periodKey:
      typeof req.query.periodKey === 'string'
        ? req.query.periodKey
        : undefined,
    status,
    result,
    page: Number.isFinite(page) ? page : 1,
    pageSize: Number.isFinite(pageSize) ? pageSize : 25,
  });
  res.json(data);
});

export const getInspection: RequestHandler = asyncHandler(async (req, res) => {
  const item = await service.getInspection(actor(req), req.params.id);
  res.json({ inspection: item });
});

export const listForEquipment: RequestHandler = asyncHandler(
  async (req, res) => {
    const rows = await service.listInspectionsForEquipment(
      actor(req),
      req.params.id,
    );
    res.json({ inspections: rows });
  },
);

export const currentForEquipment: RequestHandler = asyncHandler(
  async (req, res) => {
    const data = await service.getCurrentInspectionForEquipment(
      actor(req),
      req.params.id,
      typeof req.query.periodKey === 'string' ? req.query.periodKey : undefined,
    );
    res.json(data);
  },
);

export const listSchedule: RequestHandler = asyncHandler(async (req, res) => {
  const parsedStatus = req.query.monthlyStatus
    ? scheduleStatusEnum.safeParse(req.query.monthlyStatus)
    : null;

  const data = await service.listSchedule({
    actor: actor(req),
    periodKey:
      typeof req.query.periodKey === 'string' ? req.query.periodKey : undefined,
    unitId:
      typeof req.query.unitId === 'string' ? req.query.unitId : undefined,
    equipmentTypeId:
      typeof req.query.equipmentTypeId === 'string'
        ? req.query.equipmentTypeId
        : undefined,
    monthlyStatus:
      parsedStatus && parsedStatus.success ? parsedStatus.data : undefined,
  });
  res.json(data);
});

export const startInspection: RequestHandler = asyncHandler(
  async (req, res) => {
    const parsed = startSchema.parse(req.body);
    const inspection = await service.startInspection(
      actor(req),
      parsed.equipmentId,
    );
    await writeAudit({
      actorId: req.user!.id,
      action: AUDIT_ACTIONS.INSPECTION_START,
      entityType: 'Inspection',
      entityId: inspection.id,
      metadata: {
        equipmentId: parsed.equipmentId,
        periodKey: inspection.periodKey,
      },
    });
    // 200 if resumed, 201 if fresh — cheap heuristic:
    const brandNew =
      inspection.createdAt.getTime() > Date.now() - 5 * 1000 &&
      inspection.responses.length === 0;
    res.status(brandNew ? 201 : 200).json({ inspection });
  },
);

export const saveProgress: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = saveSchema.parse(req.body);
  const inspection = await service.saveInspectionProgress(
    actor(req),
    req.params.id,
    parsed,
  );
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.INSPECTION_SAVE_PROGRESS,
    entityType: 'Inspection',
    entityId: inspection.id,
    metadata: { responses: parsed.responses.length },
  });
  res.json({ inspection });
});

export const submit: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = submitSchema.parse(req.body);
  const inspection = await service.submitInspection(
    actor(req),
    req.params.id,
    parsed,
  );
  await writeAudit({
    actorId: req.user!.id,
    action: AUDIT_ACTIONS.INSPECTION_SUBMIT,
    entityType: 'Inspection',
    entityId: inspection.id,
    metadata: {
      status: inspection.status,
      result: inspection.result,
      hasSafetyCriticalFailure: inspection.hasSafetyCriticalFailure,
    },
  });
  res.json({ inspection });
});

const rejectSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const listPendingApprovals: RequestHandler = asyncHandler(
  async (req, res) => {
    const rows = await service.listPendingApprovals(actor(req));
    res.json({ inspections: rows });
  },
);

export const approve: RequestHandler = asyncHandler(async (req, res) => {
  const inspection = await service.approveInspection(actor(req), req.params.id);
  await writeAudit({
    actorId: req.user!.id,
    action: 'inspection.approve',
    entityType: 'Inspection',
    entityId: inspection.id,
    metadata: { inspectionNumber: inspection.inspectionNumber },
  });
  res.json({ inspection });
});

export const reject: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = rejectSchema.parse(req.body);
  const inspection = await service.rejectInspection(
    actor(req),
    req.params.id,
    parsed.reason,
  );
  await writeAudit({
    actorId: req.user!.id,
    action: 'inspection.reject',
    entityType: 'Inspection',
    entityId: inspection.id,
    metadata: { reason: parsed.reason },
  });
  res.json({ inspection });
});

// ---------------- Attachments ----------------

export const uploadAttachment: RequestHandler = asyncHandler(
  async (req, res) => {
    const file = req.file;
    if (!file) throw badRequest('No file uploaded (field "file").', 'NO_FILE');

    // Authorise + resolve the inspection first.
    await service.assertCanUploadForInspection(actor(req), req.params.id);

    assertImageAcceptable({
      mimetype: file.mimetype,
      originalname: file.originalname,
      size: file.size,
    });

    const stored = await storeInspectionAttachment({
      inspectionId: req.params.id,
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    const attachment = await service.recordAttachment({
      inspectionId: req.params.id,
      responseId:
        typeof req.body?.responseId === 'string' && req.body.responseId.length > 0
          ? req.body.responseId
          : null,
      storedFilename: stored.storedFilename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: stored.sizeBytes,
      caption:
        typeof req.body?.caption === 'string' ? req.body.caption : null,
      createdById: req.user!.id,
    });

    await writeAudit({
      actorId: req.user!.id,
      action: AUDIT_ACTIONS.INSPECTION_ATTACHMENT_UPLOAD,
      entityType: 'InspectionAttachment',
      entityId: attachment.id,
      metadata: {
        inspectionId: req.params.id,
        responseId: attachment.responseId,
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
    const abs = attachmentPathFor(att.inspectionId, att.storedFilename);
    res.setHeader('Content-Type', att.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${att.originalName.replace(/"/g, '')}"`,
    );
    fs.createReadStream(abs).pipe(res);
  },
);

export const deleteAttachment: RequestHandler = asyncHandler(
  async (req, res) => {
    await service.deleteInspectionAttachment(actor(req), req.params.id);
    await writeAudit({
      actorId: req.user!.id,
      action: 'inspection.attachment.delete',
      entityType: 'InspectionAttachment',
      entityId: req.params.id,
    });
    res.status(204).end();
  },
);
