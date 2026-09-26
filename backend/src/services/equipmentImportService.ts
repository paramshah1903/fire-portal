import Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma.js';
import { badRequest } from '../lib/errors.js';
import { isEquipmentStatus } from '../lib/equipmentCodes.js';

/**
 * Columns expected in the import file. Header matching is case- and
 * whitespace-insensitive; underscores/spaces are interchangeable.
 */
export const IMPORT_COLUMNS = [
  'equipment_code',
  'name',
  'equipment_type_key',
  'unit_code',
  'department_code',
  'serial_number',
  'manufacturer',
  'model',
  'capacity',
  'asset_number',
  'installation_date',
  'area',
  'building',
  'floor',
  'location',
  'exact_location',
  'status',
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];

export interface RawRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface ValidatedRow {
  rowNumber: number;
  equipmentCode: string;
  name: string;
  equipmentTypeId: string | null;
  equipmentTypeKey: string;
  unitId: string | null;
  unitCode: string;
  departmentId: string | null;
  departmentCode: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity: string | null;
  assetNumber: string | null;
  installationDate: Date | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  location: string | null;
  exactLocation: string | null;
  status: string;
  errors: string[];
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim().replace(/\s+/g, '_');
}

function toRawRows(records: Record<string, unknown>[]): RawRow[] {
  return records.map((rec, i) => {
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(rec)) {
      const key = normaliseHeader(k);
      raw[key] = v == null ? '' : String(v).trim();
    }
    return { rowNumber: i + 2, raw }; // +2 → 1-based, plus header row
  });
}

async function parseCsv(buf: Buffer): Promise<RawRow[]> {
  const text = buf.toString('utf8').replace(/^﻿/, '');
  const parsed = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h,
  });
  if (parsed.errors.length > 0) {
    const first = parsed.errors[0];
    throw badRequest(
      `CSV parse error on row ${(first.row ?? 0) + 1}: ${first.message}`,
      'CSV_PARSE_ERROR',
    );
  }
  return toRawRows(parsed.data);
}

async function parseXlsx(buf: Buffer): Promise<RawRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const sheet = wb.worksheets[0];
  if (!sheet) throw badRequest('The spreadsheet has no worksheets.', 'EMPTY_WORKBOOK');

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    headers[col - 1] = String(cell.value ?? '');
  });

  const records: Record<string, unknown>[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowIndex) => {
    if (rowIndex === 1) return;
    const rec: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const header = headers[col - 1];
      if (!header) return;
      const v = cell.value;
      if (v == null) {
        rec[header] = '';
      } else if (v instanceof Date) {
        rec[header] = v.toISOString().slice(0, 10);
      } else if (typeof v === 'object' && 'text' in (v as object)) {
        rec[header] = String((v as { text: unknown }).text ?? '');
      } else {
        rec[header] = String(v);
      }
    });
    // Skip fully-empty rows
    if (Object.values(rec).some((val) => String(val).trim() !== '')) {
      records.push(rec);
    }
  });
  return toRawRows(records);
}

export async function parseImportFile(
  file: Express.Multer.File,
): Promise<RawRow[]> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith('.csv') || file.mimetype.includes('csv')) {
    return parseCsv(file.buffer);
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    return parseXlsx(file.buffer);
  }
  // Best guess: try CSV first.
  return parseCsv(file.buffer);
}

interface Lookups {
  typesByKey: Map<string, string>;
  unitsByCode: Map<string, string>;
  departmentsByUnitAndCode: Map<string, string>; // `${unitId}::${code}` → id
  existingEquipmentCodes: Set<string>;
}

async function loadLookups(): Promise<Lookups> {
  const [types, units, departments, existing] = await Promise.all([
    prisma.equipmentType.findMany({
      where: { isActive: true },
      select: { id: true, key: true },
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      select: { id: true, code: true },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, code: true, unitId: true },
    }),
    prisma.equipment.findMany({ select: { equipmentCode: true } }),
  ]);

  return {
    typesByKey: new Map(types.map((t) => [t.key.toUpperCase(), t.id])),
    unitsByCode: new Map(units.map((u) => [u.code.toUpperCase(), u.id])),
    departmentsByUnitAndCode: new Map(
      departments.map((d) => [`${d.unitId}::${d.code.toUpperCase()}`, d.id]),
    ),
    existingEquipmentCodes: new Set(existing.map((e) => e.equipmentCode)),
  };
}

export interface ValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
}

export async function validateRows(rows: RawRow[]): Promise<{
  validated: ValidatedRow[];
  summary: ValidationSummary;
}> {
  const lookups = await loadLookups();
  const seenInFile = new Set<string>();
  const validated: ValidatedRow[] = [];
  let duplicatesInFile = 0;
  let duplicatesInDb = 0;

  for (const { rowNumber, raw } of rows) {
    const errors: string[] = [];

    const equipmentCode = raw.equipment_code?.trim().toUpperCase() || '';
    const name = raw.name?.trim() || '';
    const equipmentTypeKey = raw.equipment_type_key?.trim().toUpperCase() || '';
    const unitCode = raw.unit_code?.trim().toUpperCase() || '';
    const departmentCode =
      raw.department_code?.trim().toUpperCase() || '';

    if (!equipmentCode) errors.push('equipment_code is required');
    if (!name) errors.push('name is required');
    if (!equipmentTypeKey) errors.push('equipment_type_key is required');
    if (!unitCode) errors.push('unit_code is required');

    const equipmentTypeId = equipmentTypeKey
      ? lookups.typesByKey.get(equipmentTypeKey) ?? null
      : null;
    if (equipmentTypeKey && !equipmentTypeId) {
      errors.push(`Unknown equipment_type_key "${equipmentTypeKey}"`);
    }

    const unitId = unitCode ? lookups.unitsByCode.get(unitCode) ?? null : null;
    if (unitCode && !unitId) {
      errors.push(`Unknown unit_code "${unitCode}"`);
    }

    let departmentId: string | null = null;
    if (departmentCode) {
      if (unitId) {
        departmentId =
          lookups.departmentsByUnitAndCode.get(
            `${unitId}::${departmentCode}`,
          ) ?? null;
        if (!departmentId) {
          errors.push(
            `Unknown department_code "${departmentCode}" for unit "${unitCode}"`,
          );
        }
      } else {
        errors.push('department_code provided but unit_code is missing/invalid');
      }
    }

    let installationDate: Date | null = null;
    if (raw.installation_date) {
      const d = new Date(raw.installation_date);
      if (Number.isNaN(d.getTime())) {
        errors.push(
          `installation_date "${raw.installation_date}" is not a valid ISO date`,
        );
      } else {
        installationDate = d;
      }
    }

    let status = (raw.status?.trim().toUpperCase() || 'ACTIVE').replace(
      /\s+/g,
      '_',
    );
    if (!isEquipmentStatus(status)) {
      errors.push(
        `status "${raw.status}" is not one of ACTIVE, UNDER_MAINTENANCE, OUT_OF_SERVICE, RETIRED`,
      );
      status = 'ACTIVE';
    }

    if (equipmentCode) {
      if (seenInFile.has(equipmentCode)) {
        errors.push(
          `equipment_code "${equipmentCode}" appears more than once in the file`,
        );
        duplicatesInFile++;
      } else {
        seenInFile.add(equipmentCode);
      }
      if (lookups.existingEquipmentCodes.has(equipmentCode)) {
        errors.push(
          `equipment_code "${equipmentCode}" already exists in the database`,
        );
        duplicatesInDb++;
      }
    }

    validated.push({
      rowNumber,
      equipmentCode,
      name,
      equipmentTypeId,
      equipmentTypeKey,
      unitId,
      unitCode,
      departmentId,
      departmentCode: departmentCode || null,
      serialNumber: raw.serial_number || null,
      manufacturer: raw.manufacturer || null,
      model: raw.model || null,
      capacity: raw.capacity || null,
      assetNumber: raw.asset_number || null,
      installationDate,
      area: raw.area || null,
      building: raw.building || null,
      floor: raw.floor || null,
      location: raw.location || null,
      exactLocation: raw.exact_location || null,
      status,
      errors,
    });
  }

  const invalid = validated.filter((r) => r.errors.length > 0).length;
  return {
    validated,
    summary: {
      total: validated.length,
      valid: validated.length - invalid,
      invalid,
      duplicatesInFile,
      duplicatesInDb,
    },
  };
}

/**
 * Commit only the rows that have no errors. Each equipment gets a
 * freshly-generated unique QR value. Runs in a transaction so a
 * mid-flight failure rolls back everything.
 */
export async function commitRows(
  scopeUnitIds: string[] | null,
  validated: ValidatedRow[],
): Promise<{ inserted: number; skipped: number }> {
  const eligible = validated.filter((r) => r.errors.length === 0);

  const filtered = scopeUnitIds
    ? eligible.filter((r) => r.unitId && scopeUnitIds.includes(r.unitId))
    : eligible;

  let inserted = 0;
  await prisma.$transaction(async (tx) => {
    for (const row of filtered) {
      const qrCodeValue = await generateUniqueQrCodeValueTx(tx);
      await tx.equipment.create({
        data: {
          equipmentCode: row.equipmentCode,
          qrCodeValue,
          name: row.name,
          equipmentTypeId: row.equipmentTypeId!,
          unitId: row.unitId!,
          departmentId: row.departmentId,
          serialNumber: row.serialNumber,
          manufacturer: row.manufacturer,
          model: row.model,
          capacity: row.capacity,
          assetNumber: row.assetNumber,
          installationDate: row.installationDate,
          area: row.area,
          building: row.building,
          floor: row.floor,
          location: row.location,
          exactLocation: row.exactLocation,
          status: row.status,
        },
      });
      inserted++;
    }
  });

  return {
    inserted,
    skipped: eligible.length - filtered.length + (validated.length - eligible.length),
  };
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function generateUniqueQrCodeValueTx(tx: Tx): Promise<string> {
  const { randomBytes } = await import('node:crypto');
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = 'EQ-' + randomBytes(6).toString('hex').toUpperCase();
    const clash = await tx.equipment.findUnique({
      where: { qrCodeValue: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  throw new Error('Could not allocate a unique QR value in transaction');
}

/**
 * CSV template a user can download, fill in, and re-upload.
 */
export function buildTemplateCsv(): string {
  const headers = IMPORT_COLUMNS.join(',');
  const sampleRow = [
    'FE-A-9001',
    'Fire Extinguisher (ABC 6kg)',
    'FIRE_EXTINGUISHER',
    'UNIT-A',
    'PROD',
    'SN-123456',
    'Acme Safety',
    'ABC-6K',
    '6 kg',
    'ASSET-0001',
    '2024-01-15',
    'Production Block A',
    'Block A',
    'Ground',
    'Near Reception',
    'Wall bracket, west side',
    'ACTIVE',
  ].join(',');
  return `${headers}\n${sampleRow}\n`;
}
