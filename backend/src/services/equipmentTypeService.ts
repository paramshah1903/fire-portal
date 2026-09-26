import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export interface EquipmentTypeInput {
  key: string;
  name: string;
  description?: string | null;
  inspectionFrequencyDays?: number;
  isActive?: boolean;
}

const equipmentTypeInclude = {
  _count: { select: { equipment: true } },
} as const;

export async function listEquipmentTypes(
  opts: { includeInactive?: boolean } = {},
) {
  return prisma.equipmentType.findMany({
    where: opts.includeInactive ? {} : { isActive: true },
    include: equipmentTypeInclude,
    orderBy: { name: 'asc' },
  });
}

export async function getEquipmentType(id: string) {
  const item = await prisma.equipmentType.findUnique({
    where: { id },
    include: equipmentTypeInclude,
  });
  if (!item) throw notFound('Equipment type not found.');
  return item;
}

function normaliseKey(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export async function createEquipmentType(input: EquipmentTypeInput) {
  const key = normaliseKey(input.key);
  if (!key) {
    throw conflict('Type key cannot be empty.', 'INVALID_KEY');
  }
  const clash = await prisma.equipmentType.findUnique({ where: { key } });
  if (clash) {
    throw conflict(
      `An equipment type with key "${key}" already exists.`,
      'EQUIPMENT_TYPE_KEY_EXISTS',
    );
  }
  return prisma.equipmentType.create({
    data: {
      key,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      inspectionFrequencyDays: input.inspectionFrequencyDays ?? 30,
      isActive: input.isActive ?? true,
    },
    include: equipmentTypeInclude,
  });
}

export async function updateEquipmentType(
  id: string,
  input: Partial<EquipmentTypeInput>,
) {
  const existing = await prisma.equipmentType.findUnique({ where: { id } });
  if (!existing) throw notFound('Equipment type not found.');

  let nextKey: string | undefined;
  if (input.key) {
    nextKey = normaliseKey(input.key);
    if (nextKey && nextKey !== existing.key) {
      const clash = await prisma.equipmentType.findUnique({
        where: { key: nextKey },
      });
      if (clash) {
        throw conflict(
          `An equipment type with key "${nextKey}" already exists.`,
          'EQUIPMENT_TYPE_KEY_EXISTS',
        );
      }
    }
  }

  return prisma.equipmentType.update({
    where: { id },
    data: {
      key: nextKey,
      name: input.name?.trim(),
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      inspectionFrequencyDays: input.inspectionFrequencyDays,
      isActive: input.isActive,
    },
    include: equipmentTypeInclude,
  });
}
