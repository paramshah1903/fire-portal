import { api } from './api';
import type { QuestionType } from './apiChecklists';

export type InspectionStatus = 'PENDING' | 'COMPLETED';
export type InspectionResult = 'PASS' | 'FAIL';
export type ScheduleStatus = 'DUE' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export interface InspectionListItem {
  id: string;
  /// Assigned at submission time; null while PENDING.
  inspectionNumber: string | null;
  equipmentId: string;
  templateVersionId: string;
  unitId: string;
  inspectorId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  status: InspectionStatus;
  result: InspectionResult | null;
  startedAt: string;
  completedAt: string | null;
  remarks: string | null;
  hasSafetyCriticalFailure: boolean;
  confirmationName: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    qrCodeValue: string;
    unitId: string;
    equipmentType: { id: string; key: string; name: string };
  };
  unit: { id: string; code: string; name: string };
  inspector: { id: string; username: string; fullName: string };
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { id: string; name: string };
  };
  _count?: { responses: number; attachments: number };
}

export interface InspectionResponseRow {
  id: string;
  inspectionId: string;
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  isMandatory: boolean;
  isSafetyCritical: boolean;
  requiresCorrectiveActionOnFail: boolean;
  numericMin: number | null;
  numericMax: number | null;
  numericUnit: string | null;
  optionsJson: string | null;
  valueString: string | null;
  valueNumeric: number | null;
  valueDate: string | null;
  isFail: boolean;
  notes: string | null;
  createdAt: string;
  attachments: InspectionAttachment[];
}

export interface InspectionAttachment {
  id: string;
  inspectionId: string;
  responseId: string | null;
  storedFilename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  createdAt: string;
}

export interface InspectionQuestion {
  id: string;
  text: string;
  helpText: string | null;
  questionType: QuestionType;
  isMandatory: boolean;
  isSafetyCritical: boolean;
  requiresCorrectiveActionOnFail: boolean;
  optionsJson: string | null;
  numericMin: number | null;
  numericMax: number | null;
  numericUnit: string | null;
  sequence: number;
}

export interface InspectionSection {
  id: string;
  title: string;
  description: string | null;
  sequence: number;
  questions: InspectionQuestion[];
}

export interface InspectionEquipmentContext {
  id: string;
  equipmentCode: string;
  name: string;
  qrCodeValue: string;
  unitId: string;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  capacity: string | null;
  assetNumber: string | null;
  area: string | null;
  building: string | null;
  floor: string | null;
  location: string | null;
  exactLocation: string | null;
  status: string;
  isActive: boolean;
  installationDate: string | null;
  equipmentType: { id: string; key: string; name: string };
  department: { id: string; code: string; name: string } | null;
}

export interface InspectionDetail extends Omit<InspectionListItem, 'equipment'> {
  equipment: InspectionEquipmentContext;
  templateVersion: InspectionListItem['templateVersion'] & {
    versionNumber: number;
    template: {
      id: string;
      name: string;
      description: string | null;
      headerText: string | null;
      footerText: string | null;
      signatureLine: string | null;
    };
    sections: InspectionSection[];
  };
  responses: InspectionResponseRow[];
  attachments: InspectionAttachment[];
}

export interface CurrentInspectionResult {
  equipmentId: string;
  periodKey: string;
  inspection: InspectionListItem | null;
  eligibleToStart: boolean;
  ineligibleReason:
    | null
    | 'EQUIPMENT_INACTIVE'
    | 'EQUIPMENT_RETIRED'
    | 'EQUIPMENT_OUT_OF_SERVICE';
}

export async function getCurrentInspectionForEquipment(
  equipmentId: string,
  periodKey?: string,
): Promise<CurrentInspectionResult> {
  const { data } = await api.get<CurrentInspectionResult>(
    `/equipment/${equipmentId}/current-inspection`,
    { params: { periodKey: periodKey || undefined } },
  );
  return data;
}

export interface ScheduleResponse {
  periodKey: string;
  summary: Record<ScheduleStatus, number>;
  rows: {
    equipment: {
      id: string;
      equipmentCode: string;
      name: string;
      qrCodeValue: string;
      unit: { id: string; code: string; name: string };
      equipmentType: { id: string; key: string; name: string };
      status: string;
      isActive: boolean;
    };
    monthlyStatus: ScheduleStatus;
    inspection: {
      id: string;
      status: InspectionStatus;
      result: InspectionResult | null;
      completedAt: string | null;
      dueDate: string;
      hasSafetyCriticalFailure: boolean;
      inspector: { id: string; fullName: string } | null;
    } | null;
  }[];
}

export interface ListInspectionsParams {
  equipmentId?: string;
  unitId?: string;
  status?: InspectionStatus;
  result?: InspectionResult;
  periodKey?: string;
  inspectorId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListInspectionsResult {
  total: number;
  page: number;
  pageSize: number;
  rows: InspectionListItem[];
}

// ---------------- API ----------------

export async function listSchedule(params: {
  periodKey?: string;
  unitId?: string;
  equipmentTypeId?: string;
  monthlyStatus?: ScheduleStatus;
}): Promise<ScheduleResponse> {
  const { data } = await api.get<ScheduleResponse>('/inspections/schedule', {
    params: {
      periodKey: params.periodKey || undefined,
      unitId: params.unitId || undefined,
      equipmentTypeId: params.equipmentTypeId || undefined,
      monthlyStatus: params.monthlyStatus || undefined,
    },
  });
  return data;
}

export async function listInspections(
  params: ListInspectionsParams = {},
): Promise<ListInspectionsResult> {
  const { data } = await api.get<ListInspectionsResult>('/inspections', {
    params: {
      equipmentId: params.equipmentId || undefined,
      unitId: params.unitId || undefined,
      status: params.status || undefined,
      result: params.result || undefined,
      periodKey: params.periodKey || undefined,
      inspectorId: params.inspectorId || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return data;
}

export async function listInspectionsForEquipment(
  equipmentId: string,
): Promise<InspectionListItem[]> {
  const { data } = await api.get<{ inspections: InspectionListItem[] }>(
    `/equipment/${equipmentId}/inspections`,
  );
  return data.inspections;
}

export async function startInspection(
  equipmentId: string,
): Promise<InspectionDetail> {
  const { data } = await api.post<{ inspection: InspectionDetail }>(
    '/inspections/start',
    { equipmentId },
  );
  return data.inspection;
}

export async function getInspection(id: string): Promise<InspectionDetail> {
  const { data } = await api.get<{ inspection: InspectionDetail }>(
    `/inspections/${id}`,
  );
  return data.inspection;
}

export interface SaveResponseInput {
  questionId: string;
  valueString?: string | null;
  valueNumeric?: number | null;
  valueDate?: string | null;
  notes?: string | null;
}

export async function saveInspectionProgress(
  id: string,
  input: { responses: SaveResponseInput[]; remarks?: string | null },
): Promise<InspectionDetail> {
  const { data } = await api.put<{ inspection: InspectionDetail }>(
    `/inspections/${id}`,
    input,
  );
  return data.inspection;
}

export async function submitInspection(
  id: string,
  input: {
    responses: SaveResponseInput[];
    remarks?: string | null;
    confirmationName: string;
  },
): Promise<InspectionDetail> {
  const { data } = await api.post<{ inspection: InspectionDetail }>(
    `/inspections/${id}/submit`,
    input,
  );
  return data.inspection;
}

export async function uploadInspectionAttachment(
  inspectionId: string,
  file: File,
  extras: { responseId?: string | null; caption?: string | null } = {},
): Promise<InspectionAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  if (extras.responseId) fd.append('responseId', extras.responseId);
  if (extras.caption) fd.append('caption', extras.caption);
  const { data } = await api.post<{ attachment: InspectionAttachment }>(
    `/inspections/${inspectionId}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachment;
}

export function inspectionAttachmentUrl(id: string): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  return `${base}/inspection-attachments/${id}`;
}
