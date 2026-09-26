import { useEffect, useMemo, useState } from 'react';
import { toApiError } from '../../lib/api';
import {
  fetchUnitComplianceReport,
  reportExportUrl,
  type UnitComplianceReport,
} from '../../lib/apiReports';
import { listEquipmentTypes, type EquipmentType } from '../../lib/apiEquipment';
import {
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

export function UnitComplianceReportPage() {
  const [fromDate, setFromDate] = useState(defaultFromDate());
  const [toDate, setToDate] = useState(defaultToDate());
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [data, setData] = useState<UnitComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEquipmentTypes(true).then(setTypes).catch(() => setTypes([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      setData(
        await fetchUnitComplianceReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
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
  }, [fromDate, toDate, equipmentTypeId]);

  const exportParams = useMemo(
    () => ({ fromDate, toDate, equipmentTypeId }),
    [fromDate, toDate, equipmentTypeId],
  );

  return (
    <div>
      <PageHeader
        title="Unit compliance report"
        description={
          data
            ? `${data.periodKeys.length} month${data.periodKeys.length === 1 ? '' : 's'} · ${data.summary.totalUnits} unit${data.summary.totalUnits === 1 ? '' : 's'}`
            : 'Compliance roll-up per unit across a date range.'
        }
        actions={
          <ExportBar
            csvUrl={reportExportUrl('unit-compliance', 'csv', exportParams)}
            xlsxUrl={reportExportUrl('unit-compliance', 'xlsx', exportParams)}
          />
        }
      />

      <div className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={({ fromDate: f, toDate: t }) => {
            setFromDate(f);
            setToDate(t);
          }}
        />
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
            { label: 'Units', value: data.summary.totalUnits },
            { label: 'Total equipment', value: data.summary.totalEquipment },
            { label: 'Completed', value: data.summary.completed, tone: 'green' },
            { label: 'Overdue', value: data.summary.overdue, tone: 'red' },
            { label: 'Passed', value: data.summary.passed, tone: 'green' },
            { label: 'Failed', value: data.summary.failed, tone: 'amber' },
          ]}
        />
      )}

      {data === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState title="No units match" />
      ) : (
        <ReportTable
          headers={[
            'Unit',
            'Name',
            'Total',
            'Completed',
            'Overdue',
            'Passed',
            'Failed',
            'Completion',
            'Pass rate',
          ]}
        >
          {data.rows.map((r) => (
            <tr key={r.unitId} className="hover:bg-slate-50">
              <Td className="font-mono text-xs">{r.unitCode}</Td>
              <Td className="font-medium text-slate-900">{r.unitName}</Td>
              <Td>{r.totalEquipment}</Td>
              <Td>{r.completed}</Td>
              <Td>{r.overdue}</Td>
              <Td>{r.passed}</Td>
              <Td>{r.failed}</Td>
              <Td>
                <BarPct pct={r.completionRatePct} />
              </Td>
              <Td>
                <BarPct pct={r.passRatePct} />
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
    <td className={`whitespace-nowrap px-3 py-2 text-sm text-slate-700 ${className}`}>
      {children}
    </td>
  );
}

function BarPct({ pct }: { pct: number }) {
  const tone =
    pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-slate-200">
        <div
          className={`h-1.5 rounded-full ${tone}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-xs text-slate-700">{pct}%</span>
    </div>
  );
}
