import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/checklistTemplateService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { QUESTION_TYPES } from '../lib/checklistTypes.js';

// -----------------------------------------------------------------------------
// Schemas
// -----------------------------------------------------------------------------

const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  equipmentTypeId: z.string().min(1),
  frequencyDays: z.number().int().min(1).max(3650).nullable().optional(),
  applicableUnitIds: z.array(z.string()).optional(),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  frequencyDays: z.number().int().min(1).max(3650).nullable().optional(),
  applicableUnitIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

const questionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1).max(1000),
  helpText: z.string().max(2000).optional().nullable(),
  questionType: z.enum(QUESTION_TYPES),
  isMandatory: z.boolean(),
  isSafetyCritical: z.boolean(),
  requiresCorrectiveActionOnFail: z.boolean(),
  optionsJson: z.string().max(4000).optional().nullable(),
  numericMin: z.number().optional().nullable(),
  numericMax: z.number().optional().nullable(),
  numericUnit: z.string().max(50).optional().nullable(),
  isActive: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  questions: z.array(questionSchema),
});

const updateDraftSchema = z.object({
  sections: z.array(sectionSchema),
});

// -----------------------------------------------------------------------------
// Handlers — templates
// -----------------------------------------------------------------------------

export const listTemplates: RequestHandler = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const items = await service.listTemplates({ includeInactive });
  res.json({ templates: items });
});

export const getTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const item = await service.getTemplate(req.params.id);
  res.json({ template: item });
});

export const createTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createTemplateSchema.parse(req.body);
  const template = await service.createTemplate(parsed);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.CHECKLIST_TEMPLATE_CREATE,
    entityType: 'ChecklistTemplate',
    entityId: template.id,
    metadata: {
      name: template.name,
      equipmentTypeId: template.equipmentTypeId,
    },
  });
  res.status(201).json({ template });
});

export const updateTemplate: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateTemplateSchema.parse(req.body);
  const template = await service.updateTemplate(req.params.id, parsed);
  await writeAudit({
    actorId: req.user?.id,
    action:
      parsed.isActive === false
        ? AUDIT_ACTIONS.CHECKLIST_TEMPLATE_DEACTIVATE
        : AUDIT_ACTIONS.CHECKLIST_TEMPLATE_UPDATE,
    entityType: 'ChecklistTemplate',
    entityId: template.id,
    metadata: parsed,
  });
  res.json({ template });
});

// -----------------------------------------------------------------------------
// Handlers — versions
// -----------------------------------------------------------------------------

export const getVersion: RequestHandler = asyncHandler(async (req, res) => {
  const version = await service.getVersion(req.params.id);
  res.json({ version });
});

export const createDraft: RequestHandler = asyncHandler(async (req, res) => {
  const version = await service.createDraftVersion(req.params.id);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.CHECKLIST_VERSION_CREATE_DRAFT,
    entityType: 'ChecklistTemplateVersion',
    entityId: version.id,
    metadata: {
      templateId: req.params.id,
      versionNumber: version.versionNumber,
    },
  });
  res.status(201).json({ version });
});

export const updateDraft: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateDraftSchema.parse(req.body);
  const version = await service.updateDraftContent(
    req.params.id,
    parsed.sections,
  );
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.CHECKLIST_VERSION_UPDATE_DRAFT,
    entityType: 'ChecklistTemplateVersion',
    entityId: version.id,
    metadata: {
      sections: parsed.sections.length,
      questions: parsed.sections.reduce((n, s) => n + s.questions.length, 0),
    },
  });
  res.json({ version });
});

export const publishDraft: RequestHandler = asyncHandler(async (req, res) => {
  const version = await service.publishVersion(req.params.id, req.user!.id);
  await writeAudit({
    actorId: req.user?.id,
    action: AUDIT_ACTIONS.CHECKLIST_VERSION_PUBLISH,
    entityType: 'ChecklistTemplateVersion',
    entityId: version.id,
    metadata: {
      versionNumber: version.versionNumber,
      templateId: version.templateId,
    },
  });
  res.json({ version });
});
