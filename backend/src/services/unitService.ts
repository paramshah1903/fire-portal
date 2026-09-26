import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export interface UnitInput {
  code: string;
  name: string;
  location?: string | null;
  description?: string | null;
  isActive?: boolean;
}

const unitInclude = {
  _count: { select: { departments: true, users: true } },
} as const;

export async function listUnits(options: { includeInactive?: boolean } = {}) {
  return prisma.unit.findMany({
    where: options.includeInactive ? {} : { isActive: true },
    include: unitInclude,
    orderBy: { code: 'asc' },
  });
}

export async function getUnit(id: string) {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      departments: { orderBy: { code: 'asc' } },
      _count: { select: { users: true, departments: true } },
    },
  });
  if (!unit) throw notFound('Unit not found.');
  return unit;
}

export async function createUnit(input: UnitInput) {
  const code = input.code.trim().toUpperCase();
  const exists = await prisma.unit.findUnique({ where: { code } });
  if (exists) throw conflict(`A unit with code "${code}" already exists.`, 'UNIT_CODE_EXISTS');

  return prisma.unit.create({
    data: {
      code,
      name: input.name.trim(),
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
    },
    include: unitInclude,
  });
}

export async function updateUnit(id: string, input: Partial<UnitInput>) {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw notFound('Unit not found.');

  if (input.code) {
    const nextCode = input.code.trim().toUpperCase();
    if (nextCode !== existing.code) {
      const clash = await prisma.unit.findUnique({ where: { code: nextCode } });
      if (clash) throw conflict(`A unit with code "${nextCode}" already exists.`, 'UNIT_CODE_EXISTS');
    }
  }

  return prisma.unit.update({
    where: { id },
    data: {
      code: input.code ? input.code.trim().toUpperCase() : undefined,
      name: input.name?.trim(),
      location:
        input.location === undefined
          ? undefined
          : input.location?.trim() || null,
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      isActive: input.isActive,
    },
    include: unitInclude,
  });
}
