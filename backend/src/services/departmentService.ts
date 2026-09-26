import { prisma } from '../lib/prisma.js';
import { conflict, notFound } from '../lib/errors.js';

export interface DepartmentInput {
  unitId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export interface ListOptions {
  unitId?: string;
  includeInactive?: boolean;
}

export async function listDepartments(options: ListOptions = {}) {
  return prisma.department.findMany({
    where: {
      unitId: options.unitId,
      isActive: options.includeInactive ? undefined : true,
    },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      _count: { select: { users: true } },
    },
    orderBy: [{ unit: { code: 'asc' } }, { code: 'asc' }],
  });
}

export async function getDepartment(id: string) {
  const dept = await prisma.department.findUnique({
    where: { id },
    include: { unit: { select: { id: true, code: true, name: true } } },
  });
  if (!dept) throw notFound('Department not found.');
  return dept;
}

export async function createDepartment(input: DepartmentInput) {
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw notFound('Parent unit not found.');

  const code = input.code.trim().toUpperCase();
  const clash = await prisma.department.findUnique({
    where: { unitId_code: { unitId: input.unitId, code } },
  });
  if (clash) {
    throw conflict(
      `A department with code "${code}" already exists in this unit.`,
      'DEPARTMENT_CODE_EXISTS',
    );
  }

  return prisma.department.create({
    data: {
      unitId: input.unitId,
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
    },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      _count: { select: { users: true } },
    },
  });
}

export async function updateDepartment(
  id: string,
  input: Partial<DepartmentInput>,
) {
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) throw notFound('Department not found.');

  const nextUnitId = input.unitId ?? existing.unitId;
  const nextCode = input.code
    ? input.code.trim().toUpperCase()
    : existing.code;

  if (nextUnitId !== existing.unitId || nextCode !== existing.code) {
    const clash = await prisma.department.findUnique({
      where: { unitId_code: { unitId: nextUnitId, code: nextCode } },
    });
    if (clash && clash.id !== id) {
      throw conflict(
        `A department with code "${nextCode}" already exists in that unit.`,
        'DEPARTMENT_CODE_EXISTS',
      );
    }
  }

  return prisma.department.update({
    where: { id },
    data: {
      unitId: input.unitId,
      code: input.code ? input.code.trim().toUpperCase() : undefined,
      name: input.name?.trim(),
      description:
        input.description === undefined
          ? undefined
          : input.description?.trim() || null,
      isActive: input.isActive,
    },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      _count: { select: { users: true } },
    },
  });
}
