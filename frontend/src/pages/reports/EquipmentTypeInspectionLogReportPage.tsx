import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchEquipmentTypeInspectionLogReport,
  reportExportUrl,
  type EquipmentTypeLogReport,
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
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { ExportBar, ReportSummary } from './ReportShell';

/**
 * Equipment-type-wide inspection log. Picks a type; returns every
 * completed inspection for equipment of that type, in a wide table with
 * fixed metadata columns (inspection #, date, inspector, equipment
 * details) plus one column per unique checklist question in the range.
 */
export function EquipmentTypeInspectionLogReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<EquipmentTypeLogReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEquipmentTypes(true).then(setTypes).catch(() => setTypes([]));
    listUnits(true).then(setUnits).catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    if (!equipmentTypeId) {
      setData(null);
      return;
    }
    setError(null);
    fetchEquipmentTypeInspectionLogReport({
      equipmentTypeId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
      unitId: centralOrSuper ? unitId || undefined : undefined,
    })
      .then(setData)
      .catch((err) => setError(toApiError(err).message));
  }, [equipmentTypeId, fromDate, toDate, unitId, centralOrSuper]);

  const exportParams = useMemo(
    () => ({
      equipmentTypeId,
      fromDate,
      toDate,
      unitId: centralOrSuper ? unitId : '',
    }),
    [equipmentTypeId, fromDate, toDate, unitId, centralOrSuper],
  );

  return (
    <div>
      <PageHeader
        title="Inspections by equipment type"
        actions={
          data && (
            <ExportBar
              csvUrl={reportExportUrl(
                'equipment-type-inspection-log',
                'csv',
                exportParams,
              )}
              xlsxUrl={reportExportUrl(
                'equipment-type-inspection-log',
                'xlsx',
                exportParams,
              )}
            />
          )
        }
      />

      <form
        className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => e.preventDefault()}
      >
        <Select
          label="Equipment type"
          value={equipmentTypeId}
          onChange={(e) => setEquipmentTypeId(e.target.value)}
        >
          <option value="">Select a type…</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        {centralOrSuper && (
          <Select
            label="Unit (optional)"
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
        <DateRangeFilter
          fromDate={fromDate}
          toDate={toDate}
          onChange={({ fromDate: f, toDate: t }) => {
            setFromDate(f);
            setToDate(t);
          }}
        />
      </form>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!data && !error && (
        <EmptyState
          title="No equipment type selected"
          description="Pick a type above to load its inspection log."
        />
      )}

      {data && (
        <>
          <ReportSummary
            items={[
              {
                label: 'Completed inspections',
                value: data.summary.totalInspections,
              },
              {
                label: 'Equipment covered',
                value: data.summary.equipmentCount,
              },
              { label: 'Passed', value: data.summary.passed, tone: 'green' },
              { label: 'Failed', value: data.summary.failed, tone: 'amber' },
              {
                label: 'Safety-critical fails',
                value: data.summary.safetyCriticalFailures,
                tone: data.summary.safetyCriticalFailures ? 'red' : 'slate',
              },
            ]}
          />

          {data.rows.length === 0 ? (
            <EmptyState
              title="No completed inspections in this range"
              description="Try broadening the date range or removing the unit filter."
            />
          ) : (
            <LogTable data={data} />
          )}
        </>
      )}
    </div>
  );
}

// ============================================================================
// Wide log table
// ============================================================================

function LogTable({ data }: { data: EquipmentTypeLogReport }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
        <thead className="bg-slate-50 dark:bg-slate-800">
          <tr>
            <Th>Inspection #</Th>
            <Th>Completed</Th>
            <Th>Inspector</Th>
            <Th>Equipment</Th>
            <Th>Serial</Th>
            <Th>Asset</Th>
            <Th>Location</Th>
            <Th>Unit</Th>
            <Th>Result</Th>
            {data.questions.map((q) => (
              <Th key={q.key}>
                <div className="min-w-[160px]">
                  <p className="whitespace-normal text-[11px] font-semibold normal-case text-slate-700 dark:text-slate-300">
                    {q.text}
                  </p>
                  {q.isSafetyCritical && (
                    <span className="mt-1 inline-block">
                      <Badge tone="red">Safety</Badge>
                    </span>
                  )}
                </div>
              </Th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {data.rows.map((r) => (
            <tr key={r.inspectionId} className="hover:bg-slate-50 dark:hover:bg-slate-800">
              <Td className="whitespace-nowrap font-mono text-xs">
                {r.inspectionNumber || (
                  <span className="text-slate-400">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                {r.completedAt
                  ? new Date(r.completedAt).toLocaleString()
                  : '—'}
              </Td>
              <Td className="whitespace-nowrap">
                <span className="text-slate-800 dark:text-slate-200">{r.inspectorName}</span>
                {r.confirmationName && r.confirmationName !== r.inspectorName && (
                  <span className="ml-1 text-xs text-slate-500 dark:text-slate-400">
                    (signed as {r.confirmationName})
                  </span>
                )}
              </Td>
              <Td className="whitespace-nowrap">
                <div>
                  <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {r.equipmentCode}
                  </span>
                  <br />
                  <span className="text-slate-800 dark:text-slate-200">{r.equipmentName}</span>
                </div>
              </Td>
              <Td className="whitespace-nowrap text-xs">
                {r.serialNumber || (
                  <span className="text-slate-400">—</span>
                )}
              </Td>
              <Td className="whitespace-nowrap text-xs">
                {r.assetNumber || <span className="text-slate-400">—</span>}
              </Td>
              <Td className="max-w-[240px] text-xs">
                {r.location || <span className="text-slate-400">—</span>}
              </Td>
              <Td className="whitespace-nowrap font-mono text-xs">
                {r.unitCode}
              </Td>
              <Td className="whitespace-nowrap">
                {r.result ? (
                  <Badge
                    tone={
                      r.hasSafetyCriticalFailure
                        ? 'red'
                        : r.result === 'FAIL'
                          ? 'amber'
                          : 'green'
                    }
                  >
                    {r.result}
                    {r.hasSafetyCriticalFailure ? ' · SC' : ''}
                  </Badge>
                ) : (
                  '—'
                )}
              </Td>
              {data.questions.map((q) => {
                const a = r.answers[q.key];
                if (!a) {
                  return (
                    <Td key={q.key} className="text-xs text-slate-400">
                      —
                    </Td>
                  );
                }
                const tone: 'red' | 'amber' | 'green' | 'slate' =
                  a.isFail && q.isSafetyCritical
                    ? 'red'
                    : a.isFail
                      ? 'amber'
                      : q.type === 'PASS_FAIL' || q.type === 'YES_NO'
                        ? 'green'
                        : 'slate';
                const isBadge =
                  q.type === 'PASS_FAIL' ||
                  q.type === 'YES_NO' ||
                  q.type === 'DROPDOWN' ||
                  q.type === 'RADIO' ||
                  a.isFail;
                return (
                  <Td key={q.key} className="align-top">
                    <div className="min-w-[140px]">
                      {isBadge && a.valueString ? (
                        <Badge tone={tone}>{a.valueString}</Badge>
                      ) : (
                        <span className="text-slate-800 dark:text-slate-200">
                          {a.display || '—'}
                        </span>
                      )}
                      {a.attachmentCount > 0 && q.type === 'PHOTO' && (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {a.attachmentCount} photo
                          {a.attachmentCount === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 align-top"
      scope="col"
    >
      {children}
    </th>
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
    <td className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>
      {children}
    </td>
  );
}
