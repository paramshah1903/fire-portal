import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as importService from '../services/equipmentImportService.js';
import { AUDIT_ACTIONS, writeAudit } from '../lib/audit.js';
import { badRequest } from '../lib/errors.js';
import { ROLE_KEYS } from '../lib/rbac.js';

const commitSchema = z.object({
  rows: z.array(
    z.object({
      rowNumber: z.number(),
      equipmentCode: z.string(),
      name: z.string(),
      equipmentTypeId: z.string().nullable(),
      equipmentTypeKey: z.string(),
      unitId: z.string().nullable(),
      unitCode: z.string(),
      departmentId: z.string().nullable(),
      departmentCode: z.string().nullable(),
      serialNumber: z.string().nullable(),
      manufacturer: z.string().nullable(),
      model: z.string().nullable(),
      capacity: z.string().nullable(),
      assetNumber: z.string().nullable(),
      installationDate: z.string().nullable(),
      area: z.string().nullable(),
      building: z.string().nullable(),
      floor: z.string().nullable(),
      location: z.string().nullable(),
      exactLocation: z.string().nullable(),
      status: z.string(),
      errors: z.array(z.string()),
    }),
  ),
});

export const downloadTemplate: RequestHandler = (_req, res) => {
  const csv = importService.buildTemplateCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="upl-equipment-import-template.csv"',
  );
  res.send(csv);
};

export const preview: RequestHandler = asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest('No file uploaded (field name "file").', 'NO_FILE');
  const rawRows = await importService.parseImportFile(file);
  const { validated, summary } = await importService.validateRows(rawRows);
  res.json({ rows: validated, summary });
});

export const commit: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = commitSchema.parse(req.body);
  const actor = req.user!;

  // Re-validate rows on commit — client data is not trusted for
  // FKs, and existing-equipment set may have changed since preview.
  const revalidated = await importService.validateRows(
    parsed.rows.map((r) => ({
      rowNumber: r.rowNumber,
      raw: {
        equipment_code: r.equipmentCode,
        name: r.name,
        equipment_type_key: r.equipmentTypeKey,
        unit_code: r.unitCode,
        department_code: r.departmentCode ?? '',
        serial_number: r.serialNumber ?? '',
        manufacturer: r.manufacturer ?? '',
        model: r.model ?? '',
        capacity: r.capacity ?? '',
        asset_number: r.assetNumber ?? '',
        installation_date: r.installationDate ?? '',
        area: r.area ?? '',
        building: r.building ?? '',
        floor: r.floor ?? '',
        location: r.location ?? '',
        exact_location: r.exactLocation ?? '',
        status: r.status,
      },
    })),
  );

  // For non-central-admins, restrict to their own unit.
  const scopeUnitIds =
    actor.roleKey === ROLE_KEYS.SUPER_ADMIN ||
    actor.roleKey === ROLE_KEYS.CENTRAL_ADMIN
      ? null
      : actor.unitId
        ? [actor.unitId]
        : [];

  const { inserted, skipped } = await importService.commitRows(
    scopeUnitIds,
    revalidated.validated,
  );

  await writeAudit({
    actorId: actor.id,
    action: AUDIT_ACTIONS.EQUIPMENT_BULK_IMPORT,
    entityType: 'Equipment',
    metadata: {
      inserted,
      skipped,
      previewed: revalidated.summary.total,
      invalid: revalidated.summary.invalid,
    },
  });

  res.json({
    inserted,
    skipped,
    summary: revalidated.summary,
  });
});
