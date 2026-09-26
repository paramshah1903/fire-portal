import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchEquipmentHistoryReport,
  reportExportUrl,
  type EquipmentHistoryReport,
} from '../../lib/apiReports';
import {
  listEquipment,
  type Equipment,
} from '../../lib/apiEquipment';
import { ROLES } from '../../lib/permissions';
import {
  Badge,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../../components/ui';
import { ExportBar, ReportSummary, ReportTable } from './ReportShell';

export function EquipmentHistoryReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<Equipment[]>([]);
  const [equipmentId, setEquipmentId] = useState('');
  const [data, setData] = useState<EquipmentHistoryReport | null>(null);
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
    fetchEquipmentHistoryReport(equipmentId)
      .then(setData)
      .catch((err) => setError(toApiError(err).message));
  }, [equipmentId]);

  return (
    <div>
      <PageHeader
        title="Equipment history report"
        description="Pick an equipment to see every inspection ever performed on it."
        actions={
          data && (
            <ExportBar
              csvUrl={reportExportUrl('equipment-history', 'csv', {
                equipmentId,
              })}
              xlsxUrl={reportExportUrl('equipment-history', 'xlsx', {
                equipmentId,
              })}
            />
          )
        }
      />

      <form
        className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2"
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
      </form>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {!data && !error && (
        <EmptyState
          title="No equipment selected"
          description="Search and select an equipment to see its inspection history."
        />
      )}

      {data && (
        <>
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Equipment
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {data.equipment.name}
            </p>
            <p className="text-xs font-mono text-slate-600">
              {data.equipment.equipmentCode} · {data.equipment.unitCode} ·{' '}
              {data.equipment.equipmentTypeName}
            </p>
          </div>

          <ReportSummary
            items={[
              {
                label: 'Total inspections',
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
            <EmptyState title="No inspections yet for this equipment" />
          ) : (
            <ReportTable
              headers={[
                'Period',
                'Status',
                'Result',
                'Inspector',
                'Completed',
                'Template',
                'Version',
              ]}
            >
              {data.rows.map((r) => (
                <tr key={r.periodKey + r.completedAt} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{r.periodKey}</Td>
                  <Td>
                    <Badge tone={r.status === 'COMPLETED' ? 'green' : 'amber'}>
                      {r.status}
                    </Badge>
                  </Td>
                  <Td>
                    {r.result ? (
                      <Badge
                        tone={
                          r.safetyCriticalFailure
                            ? 'red'
                            : r.result === 'FAIL'
                              ? 'amber'
                              : 'green'
                        }
                      >
                        {r.result}
                        {r.safetyCriticalFailure ? ' · SC' : ''}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{r.inspectorName}</Td>
                  <Td>
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleString()
                      : '—'}
                  </Td>
                  <Td>{r.templateName}</Td>
                  <Td className="font-mono text-xs">v{r.templateVersion}</Td>
                </tr>
              ))}
            </ReportTable>
          )}
        </>
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
