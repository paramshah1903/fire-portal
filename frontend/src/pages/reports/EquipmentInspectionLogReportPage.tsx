import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchEquipmentInspectionLogReport,
  reportExportUrl,
  type InspectionLogReport,
} from '../../lib/apiReports';
import { listEquipment, type Equipment } from '../../lib/apiEquipment';
import { ROLES } from '../../lib/permissions';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../../components/ui';
import { DateRangeFilter } from '../../components/DateRangeFilter';
import { ExportBar, ReportSummary } from './ReportShell';

/**
 * Per-equipment inspection log. Every completed inspection is one row;
 * every unique checklist question seen in the range is one column, so
 * the whole audit trail for one item is visible / exportable side by
 * side. Same shape reads well in Excel.
 */
export function EquipmentInspectionLogReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [data, setData] = useState<InspectionLogReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!search) {
      setOptions([]);
      return;
    }
    listEquipment({ search, pageSize: 25 })
      .then((r) => setOptions(r.rows))
      .catch(() => setOptions([]));
  }, [search]);

  useEffect(() => {
    if (!equipmentId) {
      setData(null);
      return;
    }
    setError(null);
    fetchEquipmentInspectionLogReport({
      equipmentId,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    })
      .then(setData)
      .catch((err) => setError(toApiError(err).message));
  }, [equipmentId, fromDate, toDate]);

  const exportParams = useMemo(
    () => ({
      equipmentId,
      fromDate,
      toDate,
    }),
    [equipmentId, fromDate, toDate],
  );

  return (
    <div>
      <PageHeader
        title="Equipment inspection log"
        description="For one equipment: every completed inspection plus every checklist answer, side by side."
        actions={
          data && (
            <ExportBar
              csvUrl={reportExportUrl(
                'equipment-inspection-log',
                'csv',
                exportParams,
              )}
              xlsxUrl={reportExportUrl(
                'equipment-inspection-log',
                'xlsx',
                exportParams,
              )}
            />
          )
        }
      />

      <form
        className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchInput.trim());
        }}
      >
        <Input
          label="Search equipment"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Code, name, QR, serial…"
        />
        <Select
          label={
            centralOrSuper
              ? 'Equipment'
              : 'Equipment (limited to your unit)'
          }
          value={equipmentId}
          onChange={(e) => setEquipmentId(e.target.value)}
        >
          <option value="">
            {options.length === 0
              ? 'Search first, then pick an equipment'
              : 'Pick an equipment…'}
          </option>
          {options.map((eq) => (
            <option key={eq.id} value={eq.id}>
              {eq.equipmentCode} — {eq.name}
            </option>
          ))}
        </Select>
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
          title="No equipment selected"
          description="Search and pick an equipment to see its full inspection log."
        />
      )}

      {data && (
        <>
          <EquipmentInfoCard equipment={data.equipment} />

          <ReportSummary
            items={[
              {
                label: 'Completed inspections',
                value: data.summary.totalInspections,
              },
              { label: 'Passed', value: data.summary.passed, tone: 'green' },
              { label: 'Failed', value: data.summary.failed, tone: 'amber' },
              {
                label: 'Safety-critical fails',
                value: data.summary.safetyCriticalFailures,
                tone: data.summary.safetyCriticalFailures ? 'red' : 'slate',
              },
              {
                label: 'Last completed',
                value: data.summary.lastCompletedAt
                  ? new Date(data.summary.lastCompletedAt).toLocaleDateString()
                  : '—',
              },
            ]}
          />

          {data.rows.length === 0 ? (
            <EmptyState
              title="No completed inspections in this range"
              description="Try broadening the date range or leaving it blank for all-time."
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
// Equipment header card
// ============================================================================

function EquipmentInfoCard({
  equipment,
}: {
  equipment: InspectionLogReport['equipment'];
}) {
  const locationParts = [
    equipment.building,
    equipment.floor,
    equipment.area,
    equipment.location,
  ]
    .filter((p) => !!p && String(p).trim().length > 0)
    .join(' · ');

  const fields: Array<[string, React.ReactNode]> = [
    ['Equipment code', <span className="font-mono">{equipment.equipmentCode}</span>],
    ['QR value', <span className="font-mono text-xs">{equipment.qrCodeValue}</span>],
    ['Type', equipment.equipmentTypeName],
    ['Unit', `${equipment.unitCode} — ${equipment.unitName}`],
    [
      'Department',
      equipment.departmentCode
        ? `${equipment.departmentCode} — ${equipment.departmentName}`
        : '—',
    ],
    ['Location', locationParts || '—'],
    ['Exact location', equipment.exactLocation ?? '—'],
    ['Serial number', equipment.serialNumber ?? '—'],
    ['Asset number', equipment.assetNumber ?? '—'],
    ['Manufacturer', equipment.manufacturer ?? '—'],
    ['Model', equipment.model ?? '—'],
    ['Capacity', equipment.capacity ?? '—'],
    [
      'Installation date',
      equipment.installationDate
        ? new Date(equipment.installationDate).toLocaleDateString()
        : '—',
    ],
    ['Status', equipment.status.replace('_', ' ')],
  ];

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
        Equipment
      </p>
      <p className="text-lg font-semibold text-slate-900">
        {equipment.name}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ============================================================================
// Wide log table
// ============================================================================

function LogTable({ data }: { data: InspectionLogReport }) {
  // Fixed inspection-metadata columns first, then one per question.
  const fixedCols = [
    { key: 'period', header: 'Period', className: 'font-mono text-xs' },
    { key: 'completedAt', header: 'Completed', className: '' },
    { key: 'inspector', header: 'Inspector', className: '' },
    { key: 'result', header: 'Result', className: '' },
    { key: 'template', header: 'Template', className: 'text-xs text-slate-600' },
    { key: 'remarks', header: 'Overall remarks', className: 'text-xs text-slate-700' },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {fixedCols.map((c) => (
              <Th key={c.key}>{c.header}</Th>
            ))}
            {data.questions.map((q) => (
              <Th key={q.key}>
                <div className="min-w-[160px]">
                  {q.sectionTitle && (
                    <p className="text-[9px] font-normal uppercase tracking-widest text-slate-400">
                      {q.sectionTitle}
                    </p>
                  )}
                  <p className="whitespace-normal text-[11px] font-semibold normal-case text-slate-700">
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
        <tbody className="divide-y divide-slate-200">
          {data.rows.map((r) => (
            <tr key={r.inspectionId} className="hover:bg-slate-50">
              <Td className="whitespace-nowrap font-mono text-xs">
                {r.periodKey}
              </Td>
              <Td className="whitespace-nowrap">
                {r.completedAt
                  ? new Date(r.completedAt).toLocaleString()
                  : '—'}
              </Td>
              <Td className="whitespace-nowrap">
                <span className="text-slate-800">{r.inspectorName}</span>
                {r.confirmationName && (
                  <span className="ml-1 text-xs text-slate-500">
                    (signed as {r.confirmationName})
                  </span>
                )}
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
              <Td className="whitespace-nowrap text-xs text-slate-600">
                {r.templateName} v{r.templateVersion}
              </Td>
              <Td className="max-w-xs">
                {r.remarks ? (
                  <span className="text-xs text-slate-700">{r.remarks}</span>
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
                  a.isFail;
                return (
                  <Td key={q.key} className="align-top">
                    <div className="min-w-[140px]">
                      {isBadge && a.valueString ? (
                        <Badge tone={tone}>{a.valueString}</Badge>
                      ) : (
                        <span className="text-slate-800">
                          {a.display || '—'}
                        </span>
                      )}
                      {a.notes && (
                        <p className="mt-1 text-[11px] italic text-slate-500">
                          {a.notes}
                        </p>
                      )}
                      {a.attachmentCount > 0 && q.type === 'PHOTO' && (
                        <p className="mt-1 text-[11px] text-slate-500">
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
      className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 align-top"
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
    <td className={`px-3 py-2 text-sm text-slate-700 ${className}`}>
      {children}
    </td>
  );
}
