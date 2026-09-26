import type { RequestHandler } from 'express';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/reportsService.js';
import {
  parseFormat,
  sendCsv,
  sendXlsx,
  type ColumnSpec,
} from '../lib/exporters.js';

function actor(req: Parameters<RequestHandler>[0]) {
  const u = req.user!;
  return { id: u.id, roleKey: u.roleKey, unitId: u.unitId };
}

function queryString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

// ============================================================================
// Column specs — one per report, drives CSV+XLSX headers and JSON shape too.
// ============================================================================

const complianceColumns: ColumnSpec<service.ComplianceRow>[] = [
  { header: 'Period', accessor: (r) => r.periodKey },
  { header: 'Unit', accessor: (r) => r.unitCode },
  { header: 'Equipment Code', accessor: (r) => r.equipmentCode },
  { header: 'Equipment Name', accessor: (r) => r.equipmentName },
  { header: 'Type', accessor: (r) => r.equipmentTypeName },
  { header: 'Status', accessor: (r) => r.status },
  { header: 'Result', accessor: (r) => r.inspectionResult },
  {
    header: 'Safety-critical Failure',
    accessor: (r) => (r.safetyCriticalFailure ? 'Yes' : ''),
  },
  { header: 'Inspector', accessor: (r) => r.inspectorName },
  { header: 'Completed', accessor: (r) => r.completedAt },
  { header: 'Due Date', accessor: (r) => r.dueDate },
];

const unitComplianceColumns: ColumnSpec<service.UnitComplianceRow>[] = [
  { header: 'Unit Code', accessor: (r) => r.unitCode },
  { header: 'Unit Name', accessor: (r) => r.unitName },
  { header: 'Total Equipment', accessor: (r) => r.totalEquipment },
  { header: 'Completed', accessor: (r) => r.completed },
  { header: 'Overdue', accessor: (r) => r.overdue },
  { header: 'Passed', accessor: (r) => r.passed },
  { header: 'Failed', accessor: (r) => r.failed },
  { header: 'Completion Rate (%)', accessor: (r) => r.completionRatePct },
  { header: 'Pass Rate (%)', accessor: (r) => r.passRatePct },
];

const equipmentHistoryColumns: ColumnSpec<service.EquipmentHistoryRow>[] = [
  { header: 'Period', accessor: (r) => r.periodKey },
  { header: 'Status', accessor: (r) => r.status },
  { header: 'Result', accessor: (r) => r.result },
  {
    header: 'Safety-critical Failure',
    accessor: (r) => (r.safetyCriticalFailure ? 'Yes' : ''),
  },
  { header: 'Inspector', accessor: (r) => r.inspectorName },
  { header: 'Completed', accessor: (r) => r.completedAt },
  { header: 'Template', accessor: (r) => r.templateName },
  { header: 'Version', accessor: (r) => r.templateVersion },
];

const failedEquipmentColumns: ColumnSpec<service.FailedEquipmentRow>[] = [
  { header: 'Unit', accessor: (r) => r.unitCode },
  { header: 'Equipment Code', accessor: (r) => r.equipmentCode },
  { header: 'Equipment Name', accessor: (r) => r.equipmentName },
  { header: 'Type', accessor: (r) => r.equipmentTypeName },
  { header: 'Equipment Status', accessor: (r) => r.equipmentStatus },
  { header: 'Last Fail Period', accessor: (r) => r.lastFailPeriod },
  { header: 'Last Fail At', accessor: (r) => r.lastFailAt },
  {
    header: 'Safety-critical Failure',
    accessor: (r) => (r.safetyCriticalFailure ? 'Yes' : ''),
  },
  {
    header: 'Open Corrective Actions',
    accessor: (r) => r.openCorrectiveActions,
  },
];

const correctiveActionsColumns: ColumnSpec<service.CorrectiveActionsReportRow>[] = [
  { header: 'Code', accessor: (r) => r.code },
  { header: 'Unit', accessor: (r) => r.unitCode },
  { header: 'Equipment Code', accessor: (r) => r.equipmentCode },
  { header: 'Equipment Name', accessor: (r) => r.equipmentName },
  { header: 'Title', accessor: (r) => r.title },
  { header: 'Priority', accessor: (r) => r.priority },
  { header: 'Status', accessor: (r) => r.status },
  { header: 'Assignee', accessor: (r) => r.assigneeName },
  { header: 'Raised By', accessor: (r) => r.raisedByName },
  { header: 'Raised At', accessor: (r) => r.raisedAt },
  { header: 'Target Date', accessor: (r) => r.targetDate },
  { header: 'Resolved At', accessor: (r) => r.resolvedAt },
  { header: 'Closed At', accessor: (r) => r.closedAt },
  { header: 'Days Open', accessor: (r) => r.daysOpen },
];

// ============================================================================
// Handlers
// ============================================================================

function rangeSlug(fromDateIso: string, toDateIso: string): string {
  return `${fromDateIso.slice(0, 10)}_to_${toDateIso.slice(0, 10)}`;
}

export const compliance: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.complianceReport({
    actor: actor(req),
    fromDate: queryString(req.query.fromDate),
    toDate: queryString(req.query.toDate),
    periodKey: queryString(req.query.periodKey),
    unitId: queryString(req.query.unitId),
    equipmentTypeId: queryString(req.query.equipmentTypeId),
  });
  const format = parseFormat(req.query.format);
  const filename = `compliance-${rangeSlug(data.fromDate, data.toDate)}`;
  if (format === 'csv') return sendCsv(res, filename, complianceColumns, data.rows);
  if (format === 'xlsx')
    return sendXlsx(res, filename, complianceColumns, data.rows, 'Compliance');
  res.json(data);
});

export const unitCompliance: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.unitComplianceReport({
    actor: actor(req),
    fromDate: queryString(req.query.fromDate),
    toDate: queryString(req.query.toDate),
    periodKey: queryString(req.query.periodKey),
    equipmentTypeId: queryString(req.query.equipmentTypeId),
  });
  const format = parseFormat(req.query.format);
  const filename = `unit-compliance-${rangeSlug(data.fromDate, data.toDate)}`;
  if (format === 'csv')
    return sendCsv(res, filename, unitComplianceColumns, data.rows);
  if (format === 'xlsx')
    return sendXlsx(
      res,
      filename,
      unitComplianceColumns,
      data.rows,
      'Unit Compliance',
    );
  res.json(data);
});

export const equipmentHistory: RequestHandler = asyncHandler(async (req, res) => {
  const equipmentId = queryString(req.query.equipmentId);
  if (!equipmentId) {
    res.status(400).json({
      error: {
        code: 'MISSING_EQUIPMENT_ID',
        message: 'Provide equipmentId query parameter.',
      },
    });
    return;
  }
  const data = await service.equipmentHistoryReport({
    actor: actor(req),
    equipmentId,
  });
  const format = parseFormat(req.query.format);
  const filename = `equipment-history-${data.equipment.equipmentCode}`;
  if (format === 'csv')
    return sendCsv(res, filename, equipmentHistoryColumns, data.rows);
  if (format === 'xlsx')
    return sendXlsx(
      res,
      filename,
      equipmentHistoryColumns,
      data.rows,
      'Equipment History',
    );
  res.json(data);
});

export const failedEquipment: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.failedEquipmentReport({
    actor: actor(req),
    fromDate: queryString(req.query.fromDate),
    toDate: queryString(req.query.toDate),
    periodKey: queryString(req.query.periodKey),
    unitId: queryString(req.query.unitId),
  });
  const format = parseFormat(req.query.format);
  const filename =
    data.fromDate && data.toDate
      ? `failed-equipment-${rangeSlug(data.fromDate, data.toDate)}`
      : 'failed-equipment';
  if (format === 'csv')
    return sendCsv(res, filename, failedEquipmentColumns, data.rows);
  if (format === 'xlsx')
    return sendXlsx(
      res,
      filename,
      failedEquipmentColumns,
      data.rows,
      'Failed Equipment',
    );
  res.json(data);
});

export const correctiveActions: RequestHandler = asyncHandler(async (req, res) => {
  const data = await service.correctiveActionsReport({
    actor: actor(req),
    status: queryString(req.query.status),
    priority: queryString(req.query.priority),
    unitId: queryString(req.query.unitId),
    raisedFrom: queryString(req.query.raisedFrom),
    raisedTo: queryString(req.query.raisedTo),
  });
  const format = parseFormat(req.query.format);
  const filename = 'corrective-actions';
  if (format === 'csv')
    return sendCsv(res, filename, correctiveActionsColumns, data.rows);
  if (format === 'xlsx')
    return sendXlsx(
      res,
      filename,
      correctiveActionsColumns,
      data.rows,
      'Corrective Actions',
    );
  res.json(data);
});

export const equipmentInspectionLog: RequestHandler = asyncHandler(
  async (req, res) => {
    const equipmentId = queryString(req.query.equipmentId);
    if (!equipmentId) {
      res.status(400).json({
        error: {
          code: 'MISSING_EQUIPMENT_ID',
          message: 'Provide equipmentId query parameter.',
        },
      });
      return;
    }
    const data = await service.equipmentInspectionLogReport({
      actor: actor(req),
      equipmentId,
      fromDate: queryString(req.query.fromDate),
      toDate: queryString(req.query.toDate),
    });

    const format = parseFormat(req.query.format);
    const filename = `inspection-log-${data.equipment.equipmentCode}`;
    if (format === 'json') {
      res.json(data);
      return;
    }

    // Build the column set dynamically: fixed inspection metadata
    // first, then one column per unique question in the range.
    const staticCols: ColumnSpec<service.InspectionLogRow>[] = [
      { header: 'Period', accessor: (r) => r.periodKey },
      { header: 'Completed At', accessor: (r) => r.completedAt },
      { header: 'Inspector', accessor: (r) => r.inspectorName },
      { header: 'Signed As', accessor: (r) => r.confirmationName },
      { header: 'Result', accessor: (r) => r.result },
      {
        header: 'Safety-Critical Fail',
        accessor: (r) => (r.hasSafetyCriticalFailure ? 'Yes' : ''),
      },
      {
        header: 'Template',
        accessor: (r) => `${r.templateName} v${r.templateVersion}`,
      },
      { header: 'Overall Remarks', accessor: (r) => r.remarks },
    ];
    const questionCols: ColumnSpec<service.InspectionLogRow>[] =
      data.questions.map((q) => ({
        header: q.sectionTitle ? `[${q.sectionTitle}] ${q.text}` : q.text,
        accessor: (r) => r.answers[q.key]?.display ?? '',
      }));
    const columns = [...staticCols, ...questionCols];

    if (format === 'csv') return sendCsv(res, filename, columns, data.rows);
    return sendXlsx(res, filename, columns, data.rows, 'Inspection Log');
  },
);
