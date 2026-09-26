import { api } from './api';

export interface Unit {
  id: string;
  code: string;
  name: string;
  location: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { departments: number; users: number };
}

export interface Department {
  id: string;
  unitId: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  unit?: { id: string; code: string; name: string };
  _count?: { users: number };
}

export async function listUnits(includeInactive = false): Promise<Unit[]> {
  const { data } = await api.get<{ units: Unit[] }>('/units', {
    params: { includeInactive: includeInactive || undefined },
  });
  return data.units;
}

export async function getUnit(id: string): Promise<Unit & { departments: Department[] }> {
  const { data } = await api.get<{ unit: Unit & { departments: Department[] } }>(
    `/units/${id}`,
  );
  return data.unit;
}

export interface UnitInput {
  code: string;
  name: string;
  location?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export async function createUnit(input: UnitInput): Promise<Unit> {
  const { data } = await api.post<{ unit: Unit }>('/units', input);
  return data.unit;
}

export async function updateUnit(
  id: string,
  input: Partial<UnitInput>,
): Promise<Unit> {
  const { data } = await api.put<{ unit: Unit }>(`/units/${id}`, input);
  return data.unit;
}

// -- departments --

export interface DepartmentInput {
  unitId: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
}

export async function listDepartments(
  unitId?: string,
  includeInactive = false,
): Promise<Department[]> {
  const { data } = await api.get<{ departments: Department[] }>('/departments', {
    params: {
      unitId: unitId || undefined,
      includeInactive: includeInactive || undefined,
    },
  });
  return data.departments;
}

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const { data } = await api.post<{ department: Department }>(
    '/departments',
    input,
  );
  return data.department;
}

export async function updateDepartment(
  id: string,
  input: Partial<DepartmentInput>,
): Promise<Department> {
  const { data } = await api.put<{ department: Department }>(
    `/departments/${id}`,
    input,
  );
  return data.department;
}
