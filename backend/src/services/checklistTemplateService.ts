import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import {
  isQuestionType,
  type QuestionType,
} from '../lib/checklistTypes.js';

// -----------------------------------------------------------------------------
// Read-side (include shapes)
// -----------------------------------------------------------------------------

const templateSummaryInclude = {
  equipmentType: { select: { id: true, key: true, name: true } },
  applicableUnits: {
    include: { unit: { select: { id: true, code: true, name: true } } },
  },
  versions: {
    select: {
      id: true,
      versionNumber: true,
      status: true,
      isCurrent: true,
      publishedAt: true,
      createdAt: true,
      _count: { select: { sections: true } },
    },
    orderBy: { versionNumber: 'desc' },
  },
  _count: { select: { versions: true } },
} as const;

const versionFullInclude = {
  publishedBy: { select: { id: true, username: true, fullName: true } },
  sections: {
    orderBy: { sequence: 'asc' },
    include: {
      questions: { orderBy: { sequence: 'asc' } },
    },
  },
} as const;

// -----------------------------------------------------------------------------
// Input shapes
// -----------------------------------------------------------------------------

export interface TemplateCreateInput {
  name: string;
  description?: string | null;
  equipmentTypeId: string;
  frequencyDays?: number;
  applicableUnitIds?: string[];
}

export interface TemplateUpdateInput {
  name?: string;
  description?: string | null;
  frequencyDays?: number;
  applicableUnitIds?: string[];
  isActive?: boolean;
}

export interface DraftQuestionInput {
  id?: string;
  text: string;
  helpText?: string | null;
  questionType: QuestionType;
  isMandatory: boolean;
  isSafetyCritical: boolean;
  requiresCorrectiveActionOnFail: boolean;
  optionsJson?: string | null;
  numericMin?: number | null;
  numericMax?: number | null;
  numericUnit?: string | null;
  isActive?: boolean;
}

export interface DraftSectionInput {
  id?: string;
  title: string;
  description?: string | null;
  questions: DraftQuestionInput[];
}

// -----------------------------------------------------------------------------
// Read
// -----------------------------------------------------------------------------

export async function listTemplates(opts: { includeInactive?: boolean } = {}) {
  return prisma.checklistTemplate.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    include: templateSummaryInclude,
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
  });
}

export async function getTemplate(id: string) {
  const item = await prisma.checklistTemplate.findUnique({
    where: { id },
    include: templateSummaryInclude,
  });
  if (!item) throw notFound('Checklist template not found.');
  return item;
}

export async function getVersion(id: string) {
  const item = await prisma.checklistTemplateVersion.findUnique({
    where: { id },
    include: {
      ...versionFullInclude,
      template: {
        include: {
          equipmentType: { select: { id: true, key: true, name: true } },
          applicableUnits: {
            include: { unit: { select: { id: true, code: true, name: true } } },
          },
        },
      },
    },
  });
  if (!item) throw notFound('Checklist version not found.');
  return item;
}

/**
 * Look up the applicable checklist for a given equipment. Preference:
 *   1. A published, current version whose template both:
 *      - matches equipment.equipmentTypeId, AND
 *      - explicitly lists equipment.unitId in applicableUnits
 *   2. Otherwise a published, current version whose template matches
 *      the equipment type and has no applicableUnits (applies to all).
 *   3. Otherwise none.
 */
export async function findApplicableChecklistForEquipment(
  equipmentId: string,
) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, equipmentTypeId: true, unitId: true },
  });
  if (!equipment) throw notFound('Equipment not found.');

  const candidates = await prisma.checklistTemplate.findMany({
    where: {
      equipmentTypeId: equipment.equipmentTypeId,
      isActive: true,
      versions: { some: { isCurrent: true, status: 'PUBLISHED' } },
    },
    include: {
      applicableUnits: { select: { unitId: true } },
      versions: {
        where: { isCurrent: true, status: 'PUBLISHED' },
        take: 1,
        include: versionFullInclude,
      },
      equipmentType: { select: { id: true, key: true, name: true } },
    },
  });

  const scoped = candidates.find((t) =>
    t.applicableUnits.some((au) => au.unitId === equipment.unitId),
  );
  const global = candidates.find((t) => t.applicableUnits.length === 0);
  const chosen = scoped ?? global ?? null;
  if (!chosen) return null;

  const version = chosen.versions[0];
  return {
    template: {
      id: chosen.id,
      name: chosen.name,
      description: chosen.description,
      frequencyDays: chosen.frequencyDays,
      equipmentType: chosen.equipmentType,
    },
    version,
  };
}

// -----------------------------------------------------------------------------
// Write — templates
// -----------------------------------------------------------------------------

export async function createTemplate(input: TemplateCreateInput) {
  const type = await prisma.equipmentType.findUnique({
    where: { id: input.equipmentTypeId },
    select: { id: true, inspectionFrequencyDays: true, isActive: true },
  });
  if (!type) throw badRequest('Equipment type not found.', 'UNKNOWN_EQUIPMENT_TYPE');
  if (!type.isActive) throw badRequest('Equipment type is inactive.', 'INACTIVE_EQUIPMENT_TYPE');

  if (input.applicableUnitIds && input.applicableUnitIds.length > 0) {
    const validCount = await prisma.unit.count({
      where: { id: { in: input.applicableUnitIds }, isActive: true },
    });
    if (validCount !== input.applicableUnitIds.length) {
      throw badRequest(
        'One or more applicable units are invalid or inactive.',
        'INVALID_APPLICABLE_UNITS',
      );
    }
  }

  return prisma.$transaction(async (tx) => {
    const template = await tx.checklistTemplate.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        equipmentTypeId: input.equipmentTypeId,
        frequencyDays: input.frequencyDays ?? type.inspectionFrequencyDays,
        applicableUnits: input.applicableUnitIds
          ? {
              create: input.applicableUnitIds.map((unitId) => ({ unitId })),
            }
          : undefined,
      },
    });

    await tx.checklistTemplateVersion.create({
      data: {
        templateId: template.id,
        versionNumber: 1,
        status: 'DRAFT',
        isCurrent: false,
      },
    });

    return tx.checklistTemplate.findUniqueOrThrow({
      where: { id: template.id },
      include: templateSummaryInclude,
    });
  });
}

export async function updateTemplate(id: string, input: TemplateUpdateInput) {
  const existing = await prisma.checklistTemplate.findUnique({ where: { id } });
  if (!existing) throw notFound('Checklist template not found.');

  if (input.applicableUnitIds) {
    if (input.applicableUnitIds.length > 0) {
      const validCount = await prisma.unit.count({
        where: { id: { in: input.applicableUnitIds }, isActive: true },
      });
      if (validCount !== input.applicableUnitIds.length) {
        throw badRequest(
          'One or more applicable units are invalid or inactive.',
          'INVALID_APPLICABLE_UNITS',
        );
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.checklistTemplate.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description:
          input.description === undefined
            ? undefined
            : input.description?.trim() || null,
        frequencyDays: input.frequencyDays,
        isActive: input.isActive,
      },
    });

    if (input.applicableUnitIds) {
      await tx.checklistTemplateUnit.deleteMany({ where: { templateId: id } });
      if (input.applicableUnitIds.length > 0) {
        await tx.checklistTemplateUnit.createMany({
          data: input.applicableUnitIds.map((unitId) => ({
            templateId: id,
            unitId,
          })),
        });
      }
    }

    return tx.checklistTemplate.findUniqueOrThrow({
      where: { id },
      include: templateSummaryInclude,
    });
  });
}

// -----------------------------------------------------------------------------
// Write — versions
// -----------------------------------------------------------------------------

/**
 * Create a new DRAFT version. If a version is currently PUBLISHED it is
 * cloned as the starting point of the new draft; otherwise the new
 * draft is empty.
 */
export async function createDraftVersion(templateId: string) {
  const template = await prisma.checklistTemplate.findUnique({
    where: { id: templateId },
    include: {
      versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
    },
  });
  if (!template) throw notFound('Checklist template not found.');

  const existingDraft = await prisma.checklistTemplateVersion.findFirst({
    where: { templateId, status: 'DRAFT' },
    select: { id: true, versionNumber: true },
  });
  if (existingDraft) {
    throw conflict(
      `A draft (v${existingDraft.versionNumber}) already exists for this template.`,
      'DRAFT_EXISTS',
    );
  }

  const nextVersionNumber = (template.versions[0]?.versionNumber ?? 0) + 1;

  return prisma.$transaction(async (tx) => {
    const current = await tx.checklistTemplateVersion.findFirst({
      where: { templateId, isCurrent: true },
      include: {
        sections: { include: { questions: true }, orderBy: { sequence: 'asc' } },
      },
    });

    const draft = await tx.checklistTemplateVersion.create({
      data: {
        templateId,
        versionNumber: nextVersionNumber,
        status: 'DRAFT',
        isCurrent: false,
      },
    });

    if (current) {
      // clone sections + questions
      let secSeq = 1;
      for (const section of current.sections) {
        const cloned = await tx.checklistSection.create({
          data: {
            versionId: draft.id,
            title: section.title,
            description: section.description,
            sequence: secSeq++,
          },
        });
        let qSeq = 1;
        for (const q of section.questions) {
          await tx.checklistQuestion.create({
            data: {
              sectionId: cloned.id,
              text: q.text,
              helpText: q.helpText,
              questionType: q.questionType,
              isMandatory: q.isMandatory,
              isSafetyCritical: q.isSafetyCritical,
              requiresCorrectiveActionOnFail: q.requiresCorrectiveActionOnFail,
              optionsJson: q.optionsJson,
              numericMin: q.numericMin,
              numericMax: q.numericMax,
              numericUnit: q.numericUnit,
              sequence: qSeq++,
              isActive: q.isActive,
            },
          });
        }
      }
    }

    return tx.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: draft.id },
      include: versionFullInclude,
    });
  });
}

/**
 * Bulk-save the full section/question tree of a DRAFT version. Runs in
 * a transaction — the old tree is deleted and rebuilt so the client
 * can freely add/remove/reorder without granular endpoints.
 */
export async function updateDraftContent(
  versionId: string,
  sections: DraftSectionInput[],
) {
  const version = await prisma.checklistTemplateVersion.findUnique({
    where: { id: versionId },
    select: { id: true, status: true },
  });
  if (!version) throw notFound('Checklist version not found.');
  if (version.status !== 'DRAFT') {
    throw badRequest(
      'Only draft versions can be edited. Create a new draft to change a published template.',
      'NOT_A_DRAFT',
    );
  }

  // Validate question types and per-type constraints.
  for (const section of sections) {
    if (!section.title?.trim()) {
      throw badRequest('Every section must have a title.', 'INVALID_SECTION');
    }
    for (const q of section.questions) {
      if (!q.text?.trim()) {
        throw badRequest(
          `Section "${section.title}" contains a question with no text.`,
          'INVALID_QUESTION',
        );
      }
      if (!isQuestionType(q.questionType)) {
        throw badRequest(
          `Unknown question type "${q.questionType}".`,
          'INVALID_QUESTION_TYPE',
        );
      }
      if (q.questionType === 'DROPDOWN') {
        const opts = parseOptions(q.optionsJson);
        if (!opts || opts.length === 0) {
          throw badRequest(
            `Dropdown question "${q.text}" must have at least one option.`,
            'INVALID_DROPDOWN',
          );
        }
      }
      if (q.questionType === 'NUMERIC' && q.numericMin != null && q.numericMax != null) {
        if (q.numericMin > q.numericMax) {
          throw badRequest(
            `Question "${q.text}" has numericMin greater than numericMax.`,
            'INVALID_NUMERIC_RANGE',
          );
        }
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    // Delete old sections (cascades to questions).
    await tx.checklistSection.deleteMany({ where: { versionId } });

    let secSeq = 1;
    for (const section of sections) {
      const created = await tx.checklistSection.create({
        data: {
          versionId,
          title: section.title.trim(),
          description: section.description?.trim() || null,
          sequence: secSeq++,
        },
      });
      let qSeq = 1;
      for (const q of section.questions) {
        await tx.checklistQuestion.create({
          data: {
            sectionId: created.id,
            text: q.text.trim(),
            helpText: q.helpText?.trim() || null,
            questionType: q.questionType,
            isMandatory: q.isMandatory,
            isSafetyCritical: q.isSafetyCritical,
            requiresCorrectiveActionOnFail: q.requiresCorrectiveActionOnFail,
            optionsJson:
              q.questionType === 'DROPDOWN'
                ? normaliseOptionsJson(q.optionsJson)
                : null,
            numericMin: q.questionType === 'NUMERIC' ? q.numericMin ?? null : null,
            numericMax: q.questionType === 'NUMERIC' ? q.numericMax ?? null : null,
            numericUnit: q.questionType === 'NUMERIC' ? q.numericUnit?.trim() || null : null,
            sequence: qSeq++,
            isActive: q.isActive ?? true,
          },
        });
      }
    }

    await tx.checklistTemplateVersion.update({
      where: { id: versionId },
      data: {}, // triggers updatedAt
    });

    return tx.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: versionFullInclude,
    });
  });
}

export async function publishVersion(versionId: string, actorId: string) {
  const version = await prisma.checklistTemplateVersion.findUnique({
    where: { id: versionId },
    include: {
      sections: { select: { id: true, _count: { select: { questions: true } } } },
    },
  });
  if (!version) throw notFound('Checklist version not found.');
  if (version.status !== 'DRAFT') {
    throw badRequest(
      'Only draft versions can be published.',
      'NOT_A_DRAFT',
    );
  }
  if (version.sections.length === 0) {
    throw badRequest(
      'A checklist must have at least one section before publishing.',
      'EMPTY_TEMPLATE',
    );
  }
  const totalQuestions = version.sections.reduce(
    (n, s) => n + s._count.questions,
    0,
  );
  if (totalQuestions === 0) {
    throw badRequest(
      'A checklist must have at least one question before publishing.',
      'EMPTY_TEMPLATE',
    );
  }

  return prisma.$transaction(async (tx) => {
    // Archive any currently-published version for the same template.
    await tx.checklistTemplateVersion.updateMany({
      where: {
        templateId: version.templateId,
        isCurrent: true,
      },
      data: {
        isCurrent: false,
        status: 'ARCHIVED',
        archivedAt: new Date(),
      },
    });

    await tx.checklistTemplateVersion.update({
      where: { id: versionId },
      data: {
        status: 'PUBLISHED',
        isCurrent: true,
        publishedAt: new Date(),
        publishedById: actorId,
      },
    });

    return tx.checklistTemplateVersion.findUniqueOrThrow({
      where: { id: versionId },
      include: versionFullInclude,
    });
  });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseOptions(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed.map((x) => x.trim()).filter((x) => x.length > 0);
    }
  } catch {
    return null;
  }
  return null;
}

function normaliseOptionsJson(json: string | null | undefined): string | null {
  const opts = parseOptions(json);
  return opts && opts.length > 0 ? JSON.stringify(opts) : null;
}

// Re-export helper for callers to satisfy the compiler on the tx type
export type ChecklistTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];
export type ChecklistWhere = Prisma.ChecklistTemplateWhereInput;
