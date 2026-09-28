import { api } from './api';

export const QUESTION_TYPES = [
  'PASS_FAIL',
  'YES_NO',
  'NUMERIC',
  'TEXT',
  'DROPDOWN',
  'RADIO',
  'CHECKBOX',
  'DATE',
  'PHOTO',
  'REMARKS',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  PASS_FAIL: 'Pass / Fail',
  YES_NO: 'Yes / No',
  NUMERIC: 'Numeric',
  TEXT: 'Text',
  DROPDOWN: 'Dropdown',
  RADIO: 'Radio buttons',
  CHECKBOX: 'Checkboxes (multi-select)',
  DATE: 'Date',
  PHOTO: 'Photo',
  REMARKS: 'Remarks',
};

export const CHECKLIST_VERSION_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type ChecklistVersionStatus = (typeof CHECKLIST_VERSION_STATUSES)[number];

// ---------------- shapes ----------------

export interface ChecklistTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  equipmentTypeId: string;
  /// Null means "use equipment type's default frequency".
  frequencyDays: number | null;
  headerText: string | null;
  footerText: string | null;
  signatureLine: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  equipmentType: { id: string; key: string; name: string };
  applicableUnits: {
    templateId: string;
    unitId: string;
    unit: { id: string; code: string; name: string };
  }[];
  approvers: {
    templateId: string;
    userId: string;
    user: {
      id: string;
      username: string;
      fullName: string;
      unitId: string | null;
      role: { key: string; name: string };
    };
  }[];
  versions: ChecklistVersionSummary[];
  _count?: { versions: number };
}

export interface ChecklistVersionSummary {
  id: string;
  versionNumber: number;
  status: ChecklistVersionStatus;
  isCurrent: boolean;
  publishedAt: string | null;
  createdAt: string;
  _count?: { sections: number };
}

export interface ChecklistQuestion {
  id?: string;
  sectionId?: string;
  text: string;
  helpText: string | null;
  questionType: QuestionType;
  isMandatory: boolean;
  isSafetyCritical: boolean;
  requiresCorrectiveActionOnFail: boolean;
  optionsJson: string | null;
  /// Pre-selected default for DROPDOWN / RADIO — must be one of the options.
  defaultOptionValue?: string | null;
  numericMin: number | null;
  numericMax: number | null;
  numericUnit: string | null;
  sequence?: number;
  isActive?: boolean;
}

export interface ChecklistSection {
  id?: string;
  versionId?: string;
  title: string;
  description: string | null;
  sequence?: number;
  questions: ChecklistQuestion[];
}

export interface ChecklistVersion {
  id: string;
  templateId: string;
  versionNumber: number;
  status: ChecklistVersionStatus;
  isCurrent: boolean;
  publishedAt: string | null;
  publishedById: string | null;
  publishedBy: { id: string; username: string; fullName: string } | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sections: ChecklistSection[];
  template?: {
    id: string;
    name: string;
    description: string | null;
    frequencyDays: number | null;
    equipmentType: { id: string; key: string; name: string };
    applicableUnits: {
      templateId: string;
      unitId: string;
      unit: { id: string; code: string; name: string };
    }[];
  };
}

// ---------------- API ----------------

export interface TemplateCreateInput {
  name: string;
  description?: string | null;
  equipmentTypeId: string;
  frequencyDays?: number | null;
  headerText?: string | null;
  footerText?: string | null;
  signatureLine?: string | null;
  applicableUnitIds?: string[];
  approverUserIds?: string[];
}

export interface TemplateUpdateInput {
  name?: string;
  description?: string | null;
  frequencyDays?: number | null;
  headerText?: string | null;
  footerText?: string | null;
  signatureLine?: string | null;
  applicableUnitIds?: string[];
  approverUserIds?: string[];
  isActive?: boolean;
}

export async function listTemplates(
  includeInactive = false,
): Promise<ChecklistTemplateSummary[]> {
  const { data } = await api.get<{ templates: ChecklistTemplateSummary[] }>(
    '/checklist-templates',
    { params: { includeInactive: includeInactive || undefined } },
  );
  return data.templates;
}

export async function getTemplate(
  id: string,
): Promise<ChecklistTemplateSummary> {
  const { data } = await api.get<{ template: ChecklistTemplateSummary }>(
    `/checklist-templates/${id}`,
  );
  return data.template;
}

export async function createTemplate(
  input: TemplateCreateInput,
): Promise<ChecklistTemplateSummary> {
  const { data } = await api.post<{ template: ChecklistTemplateSummary }>(
    '/checklist-templates',
    input,
  );
  return data.template;
}

export async function updateTemplate(
  id: string,
  input: TemplateUpdateInput,
): Promise<ChecklistTemplateSummary> {
  const { data } = await api.put<{ template: ChecklistTemplateSummary }>(
    `/checklist-templates/${id}`,
    input,
  );
  return data.template;
}

export async function deleteTemplate(id: string): Promise<void> {
  await api.delete(`/checklist-templates/${id}`);
}

export async function createDraftVersion(
  templateId: string,
): Promise<ChecklistVersion> {
  const { data } = await api.post<{ version: ChecklistVersion }>(
    `/checklist-templates/${templateId}/versions`,
  );
  return data.version;
}

export async function getVersion(id: string): Promise<ChecklistVersion> {
  const { data } = await api.get<{ version: ChecklistVersion }>(
    `/checklist-versions/${id}`,
  );
  return data.version;
}

export async function updateDraftVersion(
  id: string,
  sections: ChecklistSection[],
): Promise<ChecklistVersion> {
  const { data } = await api.put<{ version: ChecklistVersion }>(
    `/checklist-versions/${id}`,
    { sections },
  );
  return data.version;
}

export async function publishDraftVersion(
  id: string,
): Promise<ChecklistVersion> {
  const { data } = await api.post<{ version: ChecklistVersion }>(
    `/checklist-versions/${id}/publish`,
  );
  return data.version;
}

// ---------- applicable checklist (equipment) ----------

export interface ApplicableChecklist {
  template: {
    id: string;
    name: string;
    description: string | null;
    frequencyDays: number | null;
    equipmentType: { id: string; key: string; name: string };
  };
  version: ChecklistVersion;
}

export async function getApplicableChecklistForEquipment(
  equipmentId: string,
): Promise<ApplicableChecklist | null> {
  const { data } = await api.get<{ checklist: ApplicableChecklist | null }>(
    `/equipment/${equipmentId}/applicable-checklist`,
  );
  return data.checklist;
}
