import { api } from './api';

export interface AuditLogRow {
  id: string;
  createdAt: string;
  actorId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: string | null;
  actor: { id: string; username: string; fullName: string } | null;
}

export interface AuditLogListParams {
  actorId?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  search?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogListResult {
  total: number;
  page: number;
  pageSize: number;
  rows: AuditLogRow[];
}

export async function listAuditLogs(
  params: AuditLogListParams = {},
): Promise<AuditLogListResult> {
  const { data } = await api.get<AuditLogListResult>('/audit-logs', {
    params: {
      actorId: params.actorId || undefined,
      action: params.action || undefined,
      entityType: params.entityType || undefined,
      entityId: params.entityId || undefined,
      search: params.search || undefined,
      fromDate: params.fromDate || undefined,
      toDate: params.toDate || undefined,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    },
  });
  return data;
}

export async function listAuditActions(): Promise<string[]> {
  const { data } = await api.get<{ actions: string[] }>('/audit-logs/actions');
  return data.actions;
}

export async function listAuditEntityTypes(): Promise<string[]> {
  const { data } = await api.get<{ entityTypes: string[] }>(
    '/audit-logs/entity-types',
  );
  return data.entityTypes;
}
