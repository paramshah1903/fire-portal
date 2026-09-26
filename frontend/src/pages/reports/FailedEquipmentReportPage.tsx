import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchFailedEquipmentReport,
  reportExportUrl,
  type FailedEquipmentReport,
} from '../../lib/apiReports';
import { listUnits, type Unit } from '../../lib/apiUnits';
import { ROLES } from '../../lib/permissions';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Select,
} from '../../components/ui';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { ExportBar, ReportSummary, ReportTable } from './ReportShell';

export function FailedEquipmentReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  // Blank defaults = "all time" — this report is often used to see
  // every currently-failing item regardless of when it failed.
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [data, setData] = useState<FailedEquipmentReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => setUnits([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      setData(
        await fetchFailedEquipmentReport({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          unitId: centralOrSuper ? unitId || undefined : undefined,
        }),
      );
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate, unitId]);

  const exportParams = useMemo(
    () => ({
      fromDate,
      toDate,
      unitId: centralOrSuper ? unitId : undefined,
    }),
    [fromDate, toDate, unitId, centralOrSuper],
  );

  return (
    <div>
      <PageHeader
        title="Failed equipment report"
        description="Currently non-compliant equipment (optionally restricted to a date range) with open corrective-action counts."
        actions={
          <ExportBar
            csvUrl={reportExportUrl('failed-equipment', 'csv', exportParams)}
            xlsxUrl={reportExportUrl('failed-equipment', 'xlsx', exportParams)}
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
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && (
        <ReportSummary
          items={[
            {
              label: 'Failed equipment',
              value: data.summary.totalFailedEquipment,
              tone: data.summary.totalFailedEquipment ? 'amber' : 'slate',
            },
            {
              label: 'With safety-critical failure',
              value: data.summary.withSafetyCritical,
              tone: data.summary.withSafetyCritical ? 'red' : 'slate',
            },
            {
              label: 'With open corrective actions',
              value: data.summary.withOpenCa,
              tone: 'amber',
            },
            {
              label: 'Out of service',
              value: data.summary.outOfService,
              tone: data.summary.outOfService ? 'red' : 'slate',
            },
          ]}
        />
      )}

      {data === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState
          title="No failed equipment"
          description="Every active equipment is compliant."
        />
      ) : (
        <ReportTable
          headers={[
            'Unit',
            'Code',
            'Name',
            'Type',
            'Equipment status',
            'Last fail',
            'Safety-critical',
            'Open CAs',
          ]}
        >
          {data.rows.map((r) => (
            <tr key={r.equipmentCode} className="hover:bg-slate-50">
              <Td className="font-mono text-xs">{r.unitCode}</Td>
              <Td className="font-mono text-xs">{r.equipmentCode}</Td>
              <Td className="font-medium text-slate-900">{r.equipmentName}</Td>
              <Td>{r.equipmentTypeName}</Td>
              <Td>
                <Badge
                  tone={
                    r.equipmentStatus === 'ACTIVE'
                      ? 'green'
                      : r.equipmentStatus === 'OUT_OF_SERVICE'
                        ? 'red'
                        : 'amber'
                  }
                >
                  {r.equipmentStatus.replace('_', ' ')}
                </Badge>
              </Td>
              <Td>
                {r.lastFailPeriod ? (
                  <span className="font-mono text-xs">{r.lastFailPeriod}</span>
                ) : (
                  '—'
                )}
              </Td>
              <Td>
                {r.safetyCriticalFailure ? (
                  <Badge tone="red">Yes</Badge>
                ) : (
                  '—'
                )}
              </Td>
              <Td>
                {r.openCorrectiveActions > 0 ? (
                  <Link
                    to={`/corrective-actions?equipmentCode=${encodeURIComponent(r.equipmentCode)}`}
                    className="text-brand-700 hover:underline"
                  >
                    {r.openCorrectiveActions}
                  </Link>
                ) : (
                  '—'
                )}
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
