import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchComplianceReport,
  reportExportUrl,
  type ComplianceReport,
} from '../../lib/apiReports';
import { listEquipmentTypes, type EquipmentType } from '../../lib/apiEquipment';
import { listUnits, type Unit } from '../../lib/apiUnits';
import { ROLES } from '../../lib/permissions';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Select,
} from '../../components/ui';
import {
  DateRangeFilter,
  defaultFromDate,
  defaultToDate,
} from '../../components/DateRangeFilter';
import { ExportBar, ReportSummary, ReportTable } from './ReportShell';

export function ComplianceReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [fromDate, setFromDate] = useState<string>(defaultFromDate());
  const [toDate, setToDate] = useState<string>(defaultToDate());
  const [unitId, setUnitId] = useState<string>('');
  const [equipmentTypeId, setEquipmentTypeId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [data, setData] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => setUnits([]));
    listEquipmentTypes(true).then(setTypes).catch(() => setTypes([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      setData(
        await fetchComplianceReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          unitId: centralOrSuper ? unitId || undefined : undefined,
          equipmentTypeId: equipmentTypeId || undefined,
        }),
      );
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, unitId, equipmentTypeId]);

  const exportParams = useMemo(
    () => ({
      fromDate,
      toDate,
      unitId: centralOrSuper ? unitId : undefined,
      equipmentTypeId,
    }),
    [fromDate, toDate, unitId, equipmentTypeId, centralOrSuper],
  );

  return (
    <div>
      <PageHeader
        title="Compliance report"
        description={
          data
            ? `${data.periodKeys.length} month${data.periodKeys.length === 1 ? '' : 's'} · ${data.summary.totalEquipment} active equipment`
            : 'Per-equipment inspection compliance across a date range.'
        }
        actions={
          <ExportBar
            csvUrl={reportExportUrl('compliance', 'csv', exportParams)}
            xlsxUrl={reportExportUrl('compliance', 'xlsx', exportParams)}
          />
        }
      />

      <div className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={({ fromDate: f, toDate: t }) => {
            setFromDate(f);
            setToDate(t);
          }}
        />
        {centralOrSuper && (
          <Select
            label="Unit"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </Select>
        )}
        <Select
          label="Equipment type"
          value={equipmentTypeId}
          onChange={(e) => setEquipmentTypeId(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && (
        <ReportSummary
          items={[
            { label: 'Total equipment', value: data.summary.totalEquipment },
            { label: 'Completed', value: data.summary.completed, tone: 'green' },
            {
              label: 'In progress',
              value: data.summary.inProgress,
              tone: 'amber',
            },
            { label: 'Due', value: data.summary.due, tone: 'slate' },
            { label: 'Overdue', value: data.summary.overdue, tone: 'red' },
            {
              label: 'Pass rate',
              value: `${data.summary.passRatePct}%`,
              tone: 'blue',
            },
            {
              label: 'Failed',
              value: data.summary.failCount,
              tone: data.summary.failCount ? 'amber' : 'slate',
            },
            {
              label: 'Safety-critical failures',
              value: data.summary.safetyCriticalFailCount,
              tone: data.summary.safetyCriticalFailCount ? 'red' : 'slate',
            },
          ]}
        />
      )}

      {data === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState title="No equipment matches this filter" />
      ) : (
        <ReportTable
          headers={[
            'Period',
            'Unit',
            'Code',
            'Name',
            'Type',
            'Status',
            'Result',
            'Inspector',
            'Completed',
          ]}
        >
          {data.rows.map((r, i) => (
            <tr key={`${r.equipmentCode}-${r.periodKey}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800">
              <Td className="font-mono text-xs">{r.periodKey}</Td>
              <Td className="font-mono text-xs">{r.unitCode}</Td>
              <Td className="font-mono text-xs">{r.equipmentCode}</Td>
              <Td className="font-medium text-slate-900 dark:text-slate-100">{r.equipmentName}</Td>
              <Td>{r.equipmentTypeName}</Td>
              <Td>
                <Badge
                  tone={
                    r.status === 'COMPLETED'
                      ? 'green'
                      : r.status === 'OVERDUE'
                        ? 'red'
                        : r.status === 'IN_PROGRESS'
                          ? 'amber'
                          : 'slate'
                  }
                >
                  {r.status.replace('_', ' ')}
                </Badge>
              </Td>
              <Td>
                {r.inspectionResult ? (
                  <Badge
                    tone={
                      r.safetyCriticalFailure
                        ? 'red'
                        : r.inspectionResult === 'FAIL'
                          ? 'amber'
                          : 'green'
                    }
                  >
                    {r.inspectionResult}
                    {r.safetyCriticalFailure ? ' · SC' : ''}
                  </Badge>
                ) : (
                  '—'
                )}
              </Td>
              <Td>{r.inspectorName || '—'}</Td>
              <Td>
                {r.completedAt
                  ? new Date(r.completedAt).toLocaleString()
                  : '—'}
              </Td>
            </tr>
          ))}
        </ReportTable>
      )}
    </div>
  );
}

function Td({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`whitespace-nowrap px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>
      {children}
    </td>
  );
}
