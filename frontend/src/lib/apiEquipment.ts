import { api } from './api';

export const EQUIPMENT_STATUSES = [
  'ACTIVE',
  'UNDER_MAINTENANCE',
  'OUT_OF_SERVICE',
  'RETIRED',
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];

export const EQUIPMENT_STATUS_LABELS: Record<EquipmentStatus, string> = {
  ACTIVE: 'Active',
  UNDER_MAINTENANCE: 'Under Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
  RETIRED: 'Retired',
};

export interface EquipmentType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  inspectionFrequencyDays: number;
  isActive: boolean;
  _count?: { equipment: number };
}

export interface EquipmentTypeInput {
  key: string;
  name: string;
  description?: string | null;
  inspectionFrequencyDays?: number;
  isActive?: boolean;
}

export interface Equipment {
  id: string;
  equipmentCode: string;
  qrCodeValue: string;
  name: string;
  equipmentType: {
    id: string;
    key: string;
    name: string;
    inspectionFrequencyDays: number;
  };
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity: string | null;
  assetNumber: string | null;
  installationDate: string | null;
  unit: { id: string; code: string; name: string };
  department: { id: string; code: string; name: string } | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  location: string | null;
  exactLocation: string | null;
  status: EquipmentStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentInput {
  equipmentCode: string;
  name: string;
  equipmentTypeId: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: string | null;
  assetNumber?: string | null;
  installationDate?: string | null;
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

export interface ListEquipmentResult {
  total: number;
  page: number;
  pageSize: number;
  rows: Equipment[];
}

export interface ListEquipmentParams {
  search?: string;
  unitId?: string;
  equipmentTypeId?: string;
  status?: EquipmentStatus;
  includeInactive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listEquipmentTypes(
  includeInactive = false,
): Promise<EquipmentType[]> {
  const { data } = await api.get<{ equipmentTypes: EquipmentType[] }>(
    '/equipment-types',
    { params: { includeInactive: includeInactive || undefined } },
  );
  return data.equipmentTypes;
}

export async function createEquipmentType(
  input: EquipmentTypeInput,
): Promise<EquipmentType> {
  const { data } = await api.post<{ equipmentType: EquipmentType }>(
    '/equipment-types',
    input,
  );
  return data.equipmentType;
}

export async function updateEquipmentType(
  id: string,
  input: Partial<EquipmentTypeInput>,
): Promise<EquipmentType> {
  const { data } = await api.put<{ equipmentType: EquipmentType }>(
    `/equipment-types/${id}`,
    input,
  );
  return data.equipmentType;
}

export async function listEquipment(
  params: ListEquipmentParams = {},
): Promise<ListEquipmentResult> {
  const { data } = await api.get<ListEquipmentResult>('/equipment', {
    params: {
      search: params.search || undefined,
      unitId: params.unitId || undefined,
      equipmentTypeId: params.equipmentTypeId || undefined,
      status: params.status || undefined,
      includeInactive: params.includeInactive || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return data;
}

export async function getEquipment(id: string): Promise<Equipment> {
  const { data } = await api.get<{ equipment: Equipment }>(`/equipment/${id}`);
  return data.equipment;
}

export async function lookupEquipment(value: string): Promise<Equipment> {
  const { data } = await api.get<{ equipment: Equipment }>('/equipment/lookup', {
    params: { value },
  });
  return data.equipment;
}

export async function createEquipment(
  input: EquipmentInput,
): Promise<Equipment> {
  const { data } = await api.post<{ equipment: Equipment }>('/equipment', input);
  return data.equipment;
}

export async function updateEquipment(
  id: string,
  input: Partial<EquipmentInput>,
): Promise<Equipment> {
  const { data } = await api.put<{ equipment: Equipment }>(
    `/equipment/${id}`,
    input,
  );
  return data.equipment;
}

// -- bulk import ------------------------------------------------------------

export interface ImportRow {
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
  installationDate: string | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  location: string | null;
  exactLocation: string | null;
  status: string;
  errors: string[];
}

export interface ImportSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicatesInFile: number;
  duplicatesInDb: number;
}

export interface ImportPreview {
  rows: ImportRow[];
  summary: ImportSummary;
}

export interface ImportCommitResult {
  inserted: number;
  skipped: number;
  summary: ImportSummary;
}

export async function previewImport(file: File): Promise<ImportPreview> {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post<ImportPreview>(
    '/equipment/import/preview',
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function commitImport(
  rows: ImportRow[],
): Promise<ImportCommitResult> {
  const { data } = await api.post<ImportCommitResult>(
    '/equipment/import/commit',
    { rows },
  );
  return data;
}

export function templateDownloadUrl(): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ??
    (import.meta.env.PROD ? '/api' : 'http://localhost:4000/api');
  return `${base}/equipment/import/template`;
}
