import { api } from './api';

export const CA_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type CaPriority = (typeof CA_PRIORITIES)[number];

export const CA_PRIORITY_LABELS: Record<CaPriority, string> = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export const CA_STATUSES = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;
export type CaStatus = (typeof CA_STATUSES)[number];

export const CA_STATUS_LABELS: Record<CaStatus, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export const CA_ATTACHMENT_STAGES = [
  'EVIDENCE',
  'RESOLUTION',
  'CLOSURE',
] as const;
export type CaAttachmentStage = (typeof CA_ATTACHMENT_STAGES)[number];

// ---------------- shapes ----------------

export interface CorrectiveActionAttachment {
  id: string;
  correctiveActionId: string;
  storedFilename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  stage: CaAttachmentStage;
  createdAt: string;
  createdById: string;
}

export interface CorrectiveActionListItem {
  id: string;
  code: string;
  equipmentId: string;
  unitId: string;
  sourceInspectionId: string | null;
  sourceResponseId: string | null;
  failedItemText: string | null;
  title: string;
  description: string;
  priority: CaPriority;
  status: CaStatus;
  raisedById: string;
  raisedAt: string;
  assigneeId: string | null;
  targetDate: string | null;
  resolutionRemarks: string | null;
  resolvedAt: string | null;
  resolvedById: string | null;
  closureRemarks: string | null;
  closedAt: string | null;
  closedById: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    unitId: string;
    equipmentType: { id: string; key: string; name: string };
  };
  unit: { id: string; code: string; name: string };
  raisedBy: { id: string; username: string; fullName: string };
  assignee: { id: string; username: string; fullName: string } | null;
  resolvedBy: { id: string; username: string; fullName: string } | null;
  closedBy: { id: string; username: string; fullName: string } | null;
  _count?: { attachments: number };
}

export interface CorrectiveActionDetail extends CorrectiveActionListItem {
  sourceInspection: {
    id: string;
    periodKey: string;
    completedAt: string | null;
    result: string | null;
    hasSafetyCriticalFailure: boolean;
  } | null;
  attachments: CorrectiveActionAttachment[];
}

export interface ListParams {
  equipmentId?: string;
  unitId?: string;
  status?: CaStatus;
  priority?: CaPriority;
  assigneeId?: string;
  sourceInspectionId?: string;
  page?: number;
  pageSize?: number;
}

export interface ListResult {
  total: number;
  page: number;
  pageSize: number;
  rows: CorrectiveActionListItem[];
}

// ---------------- API ----------------

export async function listCorrectiveActions(
  params: ListParams = {},
): Promise<ListResult> {
  const { data } = await api.get<ListResult>('/corrective-actions', {
    params: {
      equipmentId: params.equipmentId || undefined,
      unitId: params.unitId || undefined,
      status: params.status || undefined,
      priority: params.priority || undefined,
      assigneeId: params.assigneeId || undefined,
      sourceInspectionId: params.sourceInspectionId || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
    },
  });
  return data;
}

export async function getCorrectiveAction(
  id: string,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.get<{ correctiveAction: CorrectiveActionDetail }>(
    `/corrective-actions/${id}`,
  );
  return data.correctiveAction;
}

export async function listCorrectiveActionsForEquipment(
  equipmentId: string,
): Promise<CorrectiveActionListItem[]> {
  const { data } = await api.get<{
    correctiveActions: CorrectiveActionListItem[];
  }>(`/equipment/${equipmentId}/corrective-actions`);
  return data.correctiveActions;
}

export interface CreateInput {
  equipmentId: string;
  title: string;
  description: string;
  priority?: CaPriority;
  assigneeId?: string | null;
  targetDate?: string | null;
  sourceInspectionId?: string | null;
  sourceResponseId?: string | null;
  failedItemText?: string | null;
}

export async function createCorrectiveAction(
  input: CreateInput,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.post<{ correctiveAction: CorrectiveActionDetail }>(
    '/corrective-actions',
    input,
  );
  return data.correctiveAction;
}

export interface UpdateInput {
  title?: string;
  description?: string;
  priority?: CaPriority;
  assigneeId?: string | null;
  targetDate?: string | null;
}

export async function updateCorrectiveAction(
  id: string,
  input: UpdateInput,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.put<{ correctiveAction: CorrectiveActionDetail }>(
    `/corrective-actions/${id}`,
    input,
  );
  return data.correctiveAction;
}

export async function markCaInProgress(
  id: string,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.post<{ correctiveAction: CorrectiveActionDetail }>(
    `/corrective-actions/${id}/progress`,
  );
  return data.correctiveAction;
}

export async function markCaResolved(
  id: string,
  resolutionRemarks: string,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.post<{ correctiveAction: CorrectiveActionDetail }>(
    `/corrective-actions/${id}/resolve`,
    { resolutionRemarks },
  );
  return data.correctiveAction;
}

export async function closeCa(
  id: string,
  closureRemarks: string,
): Promise<CorrectiveActionDetail> {
  const { data } = await api.post<{ correctiveAction: CorrectiveActionDetail }>(
    `/corrective-actions/${id}/close`,
    { closureRemarks },
  );
  return data.correctiveAction;
}

export async function uploadCaAttachment(
  id: string,
  file: File,
  extras: { stage?: CaAttachmentStage; caption?: string | null } = {},
): Promise<CorrectiveActionAttachment> {
  const fd = new FormData();
  fd.append('file', file);
  if (extras.stage) fd.append('stage', extras.stage);
  if (extras.caption) fd.append('caption', extras.caption);
  const { data } = await api.post<{ attachment: CorrectiveActionAttachment }>(
    `/corrective-actions/${id}/attachments`,
    fd,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data.attachment;
}

export function caAttachmentUrl(id: string): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  return `${base}/corrective-action-attachments/${id}`;
}
