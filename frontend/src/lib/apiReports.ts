import { api } from './api';

// ---------- Row shapes ----------

export interface ComplianceRow {
  periodKey: string;
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeName: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'DUE' | 'OVERDUE';
  inspectionResult: 'PASS' | 'FAIL' | '';
  safetyCriticalFailure: boolean;
  inspectorName: string;
  completedAt: string;
  dueDate: string;
}

export interface ComplianceReport {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  summary: {
    totalEquipment: number;
    completed: number;
    inProgress: number;
    due: number;
    overdue: number;
    passRatePct: number;
    failCount: number;
    safetyCriticalFailCount: number;
  };
  rows: ComplianceRow[];
}

export interface UnitComplianceRow {
  unitId: string;
  unitCode: string;
  unitName: string;
  totalEquipment: number;
  completed: number;
  overdue: number;
  passed: number;
  failed: number;
  completionRatePct: number;
  passRatePct: number;
}

export interface UnitComplianceReport {
  fromDate: string;
  toDate: string;
  periodKeys: string[];
  summary: {
    totalUnits: number;
    totalEquipment: number;
    completed: number;
    overdue: number;
    passed: number;
    failed: number;
  };
  rows: UnitComplianceRow[];
}

export interface EquipmentHistoryRow {
  periodKey: string;
  result: 'PASS' | 'FAIL' | '';
  status: string;
  safetyCriticalFailure: boolean;
  inspectorName: string;
  completedAt: string;
  templateName: string;
  templateVersion: number;
}

export interface EquipmentHistoryReport {
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    unitCode: string;
    equipmentTypeName: string;
  };
  summary: {
    totalInspections: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
    lastCompletedAt: string;
  };
  rows: EquipmentHistoryRow[];
}

export interface FailedEquipmentRow {
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  equipmentTypeName: string;
  equipmentStatus: string;
  lastFailPeriod: string;
  lastFailAt: string;
  safetyCriticalFailure: boolean;
  openCorrectiveActions: number;
}

export interface FailedEquipmentReport {
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalFailedEquipment: number;
    withSafetyCritical: number;
    withOpenCa: number;
    outOfService: number;
  };
  rows: FailedEquipmentRow[];
}

export interface CorrectiveActionsReportRow {
  code: string;
  unitCode: string;
  equipmentCode: string;
  equipmentName: string;
  title: string;
  priority: string;
  status: string;
  assigneeName: string;
  raisedByName: string;
  raisedAt: string;
  targetDate: string;
  resolvedAt: string;
  closedAt: string;
  daysOpen: number;
}

export interface CorrectiveActionsReport {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    overdue: number;
    avgDaysToClose: number;
  };
  rows: CorrectiveActionsReportRow[];
}

// ---------- API ----------

export interface ComplianceParams {
  fromDate?: string;
  toDate?: string;
  unitId?: string;
  equipmentTypeId?: string;
}

export async function fetchComplianceReport(
  params: ComplianceParams = {},
): Promise<ComplianceReport> {
  const { data } = await api.get<ComplianceReport>('/reports/compliance', {
    params: normalise(params),
  });
  return data;
}

export interface UnitComplianceParams {
  fromDate?: string;
  toDate?: string;
  equipmentTypeId?: string;
}

export async function fetchUnitComplianceReport(
  params: UnitComplianceParams = {},
): Promise<UnitComplianceReport> {
  const { data } = await api.get<UnitComplianceReport>(
    '/reports/unit-compliance',
    { params: normalise(params) },
  );
  return data;
}

export async function fetchEquipmentHistoryReport(
  equipmentId: string,
): Promise<EquipmentHistoryReport> {
  const { data } = await api.get<EquipmentHistoryReport>(
    '/reports/equipment-history',
    { params: { equipmentId } },
  );
  return data;
}

export interface FailedEquipmentParams {
  fromDate?: string;
  toDate?: string;
  unitId?: string;
}

export async function fetchFailedEquipmentReport(
  params: FailedEquipmentParams = {},
): Promise<FailedEquipmentReport> {
  const { data } = await api.get<FailedEquipmentReport>(
    '/reports/failed-equipment',
    { params: normalise(params) },
  );
  return data;
}

export interface CorrectiveActionsReportParams {
  status?: string;
  priority?: string;
  unitId?: string;
  raisedFrom?: string;
  raisedTo?: string;
}

export async function fetchCorrectiveActionsReport(
  params: CorrectiveActionsReportParams = {},
): Promise<CorrectiveActionsReport> {
  const { data } = await api.get<CorrectiveActionsReport>(
    '/reports/corrective-actions',
    { params: normalise(params) },
  );
  return data;
}

// ---------- Equipment inspection log ----------

export interface InspectionLogQuestion {
  key: string;
  text: string;
  type: string;
  isSafetyCritical: boolean;
  isMandatory: boolean;
  sectionTitle: string;
  sortKey: number;
}

export interface InspectionLogAnswer {
  valueString: string | null;
  valueNumeric: number | null;
  valueDate: string | null;
  isFail: boolean;
  notes: string | null;
  attachmentCount: number;
  display: string;
}

export interface InspectionLogRow {
  inspectionId: string;
  periodKey: string;
  completedAt: string;
  inspectorName: string;
  inspectorUsername: string;
  confirmationName: string;
  result: string;
  hasSafetyCriticalFailure: boolean;
  remarks: string;
  templateName: string;
  templateVersion: number;
  answers: Record<string, InspectionLogAnswer>;
}

export interface InspectionLogReport {
  equipment: {
    id: string;
    equipmentCode: string;
    name: string;
    qrCodeValue: string;
    serialNumber: string | null;
    manufacturer: string | null;
    model: string | null;
    capacity: string | null;
    assetNumber: string | null;
    building: string | null;
    floor: string | null;
    area: string | null;
    location: string | null;
    exactLocation: string | null;
    status: string;
    installationDate: string | null;
    unitCode: string;
    unitName: string;
    departmentCode: string | null;
    departmentName: string | null;
    equipmentTypeKey: string;
    equipmentTypeName: string;
  };
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalInspections: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
    lastCompletedAt: string;
  };
  questions: InspectionLogQuestion[];
  rows: InspectionLogRow[];
}

export interface InspectionLogParams {
  equipmentId: string;
  fromDate?: string;
  toDate?: string;
}

export async function fetchEquipmentInspectionLogReport(
  params: InspectionLogParams,
): Promise<InspectionLogReport> {
  const { data } = await api.get<InspectionLogReport>(
    '/reports/equipment-inspection-log',
    { params: normalise(params) },
  );
  return data;
}

// ---------- Equipment-type inspection log ----------

export interface EquipmentTypeLogRow {
  inspectionId: string;
  inspectionNumber: string;
  periodKey: string;
  completedAt: string;
  inspectorName: string;
  inspectorUsername: string;
  confirmationName: string;
  result: string;
  hasSafetyCriticalFailure: boolean;
  remarks: string;
  templateName: string;
  templateVersion: number;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  serialNumber: string;
  assetNumber: string;
  location: string;
  unitCode: string;
  departmentCode: string;
  answers: Record<string, InspectionLogAnswer>;
}

export interface EquipmentTypeLogReport {
  equipmentType: {
    id: string;
    key: string;
    name: string;
  };
  fromDate: string | null;
  toDate: string | null;
  summary: {
    totalInspections: number;
    equipmentCount: number;
    passed: number;
    failed: number;
    safetyCriticalFailures: number;
  };
  questions: InspectionLogQuestion[];
  rows: EquipmentTypeLogRow[];
}

export interface EquipmentTypeLogParams {
  equipmentTypeId: string;
  fromDate?: string;
  toDate?: string;
  unitId?: string;
}

export async function fetchEquipmentTypeInspectionLogReport(
  params: EquipmentTypeLogParams,
): Promise<EquipmentTypeLogReport> {
  const { data } = await api.get<EquipmentTypeLogReport>(
    '/reports/equipment-type-inspection-log',
    { params: normalise(params) },
  );
  return data;
}

/**
 * Build a full URL for a CSV / XLSX export. Used to render an
 * `<a href>` so the browser's download dialog kicks in.
 */
export function reportExportUrl(
  slug:
    | 'compliance'
    | 'unit-compliance'
    | 'equipment-history'
    | 'failed-equipment'
    | 'corrective-actions'
    | 'equipment-inspection-log'
    | 'equipment-type-inspection-log',
  format: 'csv' | 'xlsx',
  params: Record<string, string | undefined>,
): string {
  const base =
    import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api';
  const q = new URLSearchParams();
  q.set('format', format);
  for (const [k, v] of Object.entries(params)) {
    if (v && v.length > 0) q.set(k, v);
  }
  return `${base}/reports/${slug}?${q.toString()}`;
}

function normalise(params: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') out[k] = v;
  }
  return out;
}
