import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';
import {
  EQUIPMENT_STATUSES,
  generateUniqueQrCodeValue,
  isEquipmentStatus,
  type EquipmentStatus,
} from '../lib/equipmentCodes.js';

export const EQUIPMENT_STATUS_LIST = EQUIPMENT_STATUSES;

export interface EquipmentInput {
  equipmentCode: string;
  name: string;
  equipmentTypeId: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: string | null;
  assetNumber?: string | null;
  installationDate?: string | Date | null;
  unitId: string;
  departmentId?: string | null;
  area?: string | null;
  building?: string | null;
  floor?: string | null;
  location?: string | null;
  exactLocation?: string | null;
  status?: EquipmentStatus;
  isActive?: boolean;
}

const equipmentInclude = {
  equipmentType: { select: { id: true, key: true, name: true, inspectionFrequencyDays: true } },
  unit: { select: { id: true, code: true, name: true } },
  department: { select: { id: true, code: true, name: true } },
} as const;

export interface ListOptions {
  search?: string;
  unitId?: string;
  equipmentTypeId?: string;
  status?: EquipmentStatus;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
  /** Scope: applied by controller for non-central/super roles. */
  scopeUnitId?: string;
}

export async function listEquipment(opts: ListOptions = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, opts.pageSize ?? 25));

  const search = opts.search?.trim();
  const where: Prisma.EquipmentWhereInput = {
    unitId: opts.scopeUnitId ?? opts.unitId,
    equipmentTypeId: opts.equipmentTypeId,
    status: opts.status,
    isActive: opts.includeInactive ? undefined : true,
    OR: search
      ? [
          { equipmentCode: { contains: search } },
          { name: { contains: search } },
          { qrCodeValue: { contains: search } },
          { serialNumber: { contains: search } },
          { assetNumber: { contains: search } },
          { manufacturer: { contains: search } },
        ]
      : undefined,
  };

  const [total, rows] = await Promise.all([
    prisma.equipment.count({ where }),
    prisma.equipment.findMany({
      where,
      include: equipmentInclude,
      orderBy: [{ isActive: 'desc' }, { equipmentCode: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { total, page, pageSize, rows };
}

export async function getEquipment(id: string) {
  const item = await prisma.equipment.findUnique({
    where: { id },
    include: equipmentInclude,
  });
  if (!item) throw notFound('Equipment not found.');
  return item;
}

export async function getEquipmentByCodeOrQr(value: string) {
  const item = await prisma.equipment.findFirst({
    where: { OR: [{ equipmentCode: value }, { qrCodeValue: value }] },
    include: equipmentInclude,
  });
  if (!item) throw notFound('Equipment not found.');
  return item;
}

async function validateReferences(
  equipmentTypeId: string,
  unitId: string,
  departmentId: string | null | undefined,
) {
  const type = await prisma.equipmentType.findUnique({
    where: { id: equipmentTypeId },
    select: { id: true, isActive: true },
  });
  if (!type) throw badRequest('Equipment type not found.', 'UNKNOWN_EQUIPMENT_TYPE');
  if (!type.isActive) {
    throw badRequest('Equipment type is inactive.', 'INACTIVE_EQUIPMENT_TYPE');
  }
  const unit = await prisma.unit.findUnique({
    where: { id: unitId },
    select: { id: true, isActive: true },
  });
  if (!unit) throw badRequest('Unit not found.', 'UNKNOWN_UNIT');
  if (!unit.isActive) throw badRequest('Unit is inactive.', 'INACTIVE_UNIT');
  if (departmentId) {
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { unitId: true, isActive: true },
    });
    if (!dept) throw badRequest('Department not found.', 'UNKNOWN_DEPARTMENT');
    if (!dept.isActive) throw badRequest('Department is inactive.', 'INACTIVE_DEPARTMENT');
    if (dept.unitId !== unitId) {
      throw badRequest(
        'Department does not belong to the selected unit.',
        'DEPARTMENT_UNIT_MISMATCH',
      );
    }
  }
}

function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

function parseInstallationDate(raw: string | Date | null | undefined): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw badRequest('Installation date must be a valid ISO date.', 'INVALID_DATE');
  }
  return d;
}

export async function createEquipment(input: EquipmentInput) {
  if (input.status && !isEquipmentStatus(input.status)) {
    throw badRequest('Invalid status value.', 'INVALID_STATUS');
  }
  await validateReferences(input.equipmentTypeId, input.unitId, input.departmentId ?? null);

  const equipmentCode = normaliseCode(input.equipmentCode);
  if (!equipmentCode) {
    throw badRequest('Equipment code is required.', 'INVALID_EQUIPMENT_CODE');
  }
  const clash = await prisma.equipment.findUnique({
    where: { equipmentCode },
    select: { id: true },
  });
  if (clash) {
    throw conflict(
      `An equipment with code "${equipmentCode}" already exists.`,
      'EQUIPMENT_CODE_EXISTS',
    );
  }

  const qrCodeValue = await generateUniqueQrCodeValue();

  return prisma.equipment.create({
    data: {
      equipmentCode,
      qrCodeValue,
      name: input.name.trim(),
      equipmentTypeId: input.equipmentTypeId,
      serialNumber: input.serialNumber?.trim() || null,
      manufacturer: input.manufacturer?.trim() || null,
      model: input.model?.trim() || null,
      capacity: input.capacity?.trim() || null,
      assetNumber: input.assetNumber?.trim() || null,
      installationDate: parseInstallationDate(input.installationDate) ?? null,
      unitId: input.unitId,
      departmentId: input.departmentId ?? null,
      area: input.area?.trim() || null,
      building: input.building?.trim() || null,
      floor: input.floor?.trim() || null,
      location: input.location?.trim() || null,
      exactLocation: input.exactLocation?.trim() || null,
      status: input.status ?? 'ACTIVE',
      isActive: input.isActive ?? true,
    },
    include: equipmentInclude,
  });
}

export async function updateEquipment(
  id: string,
  input: Partial<EquipmentInput>,
): Promise<{
  before: Awaited<ReturnType<typeof getEquipment>>;
  after: Awaited<ReturnType<typeof getEquipment>>;
}> {
  const existing = await prisma.equipment.findUnique({ where: { id } });
  if (!existing) throw notFound('Equipment not found.');

  if (input.status && !isEquipmentStatus(input.status)) {
    throw badRequest('Invalid status value.', 'INVALID_STATUS');
  }

  const nextEquipmentTypeId = input.equipmentTypeId ?? existing.equipmentTypeId;
  const nextUnitId = input.unitId ?? existing.unitId;
  const nextDepartmentId =
    input.departmentId === undefined ? existing.departmentId : input.departmentId;

  if (
    nextEquipmentTypeId !== existing.equipmentTypeId ||
    nextUnitId !== existing.unitId ||
    nextDepartmentId !== existing.departmentId
  ) {
    await validateReferences(nextEquipmentTypeId, nextUnitId, nextDepartmentId);
  }

  if (input.equipmentCode) {
    const nextCode = normaliseCode(input.equipmentCode);
    if (nextCode !== existing.equipmentCode) {
      const clash = await prisma.equipment.findUnique({
        where: { equipmentCode: nextCode },
      });
      if (clash && clash.id !== id) {
        throw conflict(
          `An equipment with code "${nextCode}" already exists.`,
          'EQUIPMENT_CODE_EXISTS',
        );
      }
    }
  }

  const before = await getEquipment(id);
  const after = await prisma.equipment.update({
    where: { id },
    data: {
      equipmentCode: input.equipmentCode
        ? normaliseCode(input.equipmentCode)
        : undefined,
      name: input.name?.trim(),
      equipmentTypeId: input.equipmentTypeId,
      serialNumber:
        input.serialNumber === undefined
          ? undefined
          : input.serialNumber?.trim() || null,
      manufacturer:
        input.manufacturer === undefined
          ? undefined
          : input.manufacturer?.trim() || null,
      model:
        input.model === undefined ? undefined : input.model?.trim() || null,
      capacity:
        input.capacity === undefined
          ? undefined
          : input.capacity?.trim() || null,
      assetNumber:
        input.assetNumber === undefined
          ? undefined
          : input.assetNumber?.trim() || null,
      installationDate: parseInstallationDate(input.installationDate),
      unitId: input.unitId,
      departmentId: input.departmentId,
      area: input.area === undefined ? undefined : input.area?.trim() || null,
      building:
        input.building === undefined ? undefined : input.building?.trim() || null,
      floor: input.floor === undefined ? undefined : input.floor?.trim() || null,
      location:
        input.location === undefined ? undefined : input.location?.trim() || null,
      exactLocation:
        input.exactLocation === undefined
          ? undefined
          : input.exactLocation?.trim() || null,
      status: input.status,
      isActive: input.isActive,
    },
    include: equipmentInclude,
  });
  return { before, after };
}

/**
 * Hard-delete an equipment record. Refuses if any inspection or
 * corrective action references it — that history would otherwise be
 * silently orphaned. Operators should deactivate + retire instead.
 *
 * Super-Admin-only endpoint — see `routes/equipment.ts`.
 */
export async function deleteEquipment(id: string) {
  const existing = await prisma.equipment.findUnique({
    where: { id },
    include: {
      _count: {
        select: { inspections: true, correctiveActions: true },
      },
    },
  });
  if (!existing) throw notFound('Equipment not found.');

  const { inspections, correctiveActions } = existing._count;
  if (inspections > 0 || correctiveActions > 0) {
    throw conflict(
      `Cannot delete: ${inspections} inspection(s) and ${correctiveActions} corrective action(s) reference this equipment. Retire it instead.`,
      'EQUIPMENT_HAS_HISTORY',
    );
  }
  await prisma.equipment.delete({ where: { id } });
}
