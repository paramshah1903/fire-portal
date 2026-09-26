import { api } from './api';

export interface DashboardUnitCompletionRow {
  unitId: string;
  unitCode: string;
  unitName: string;
  completed: number;
  inProgress: number;
  overdue: number;
  due: number;
  total: number;
  completionPct: number;
}

export interface DashboardTopFailedItem {
  questionText: string;
  failCount: number;
  safetyCriticalFailCount: number;
}

export interface Dashboard {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  scope: {
    unitId: string | null;
    equipmentTypeId: string | null;
    roleKey: string;
    unitScoped: boolean;
  };
  kpis: {
    totalEquipment: number;
    activeEquipment: number;
    dueInRange: number;
    completed: number;
    inProgress: number;
    overdue: number;
    failedEquipment: number;
    openCorrectiveActions: number;
  };
  charts: {
    overallCompletionPct: number;
    unitCompletion: DashboardUnitCompletionRow[];
    statusDistribution: {
      completed: number;
      inProgress: number;
      due: number;
      overdue: number;
    };
    topFailedItems: DashboardTopFailedItem[];
    openCorrectiveActionsByPriority: {
      CRITICAL: number;
      HIGH: number;
      MEDIUM: number;
      LOW: number;
    };
  };
}

export interface DashboardParams {
  fromDate?: string;
  toDate?: string;
  unitId?: string;
  equipmentTypeId?: string;
}

export async function fetchDashboard(
  params: DashboardParams = {},
): Promise<Dashboard> {
  const { data } = await api.get<Dashboard>('/dashboard', {
    params: {
      fromDate: params.fromDate || undefined,
      toDate: params.toDate || undefined,
      unitId: params.unitId || undefined,
      equipmentTypeId: params.equipmentTypeId || undefined,
    },
  });
  return data;
}
