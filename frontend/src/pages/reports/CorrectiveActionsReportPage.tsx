import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { toApiError } from '../../lib/api';
import {
  fetchCorrectiveActionsReport,
  reportExportUrl,
  type CorrectiveActionsReport,
} from '../../lib/apiReports';
import {
  CA_PRIORITIES,
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  CA_STATUSES,
} from '../../lib/apiCorrectiveActions';
import { listUnits, type Unit } from '../../lib/apiUnits';
import { ROLES } from '../../lib/permissions';
import {
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../../components/ui';
import { PriorityBadge, StatusBadge } from '../CorrectiveActionsPage';
import { ExportBar, ReportSummary, ReportTable } from './ReportShell';

export function CorrectiveActionsReportPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [unitId, setUnitId] = useState('');
  const [raisedFrom, setRaisedFrom] = useState('');
  const [raisedTo, setRaisedTo] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [data, setData] = useState<CorrectiveActionsReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => setUnits([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      setData(
        await fetchCorrectiveActionsReport({
          status: status || undefined,
          priority: priority || undefined,
          unitId: centralOrSuper ? unitId || undefined : undefined,
          raisedFrom: raisedFrom || undefined,
          raisedTo: raisedTo || undefined,
        }),
      );
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, unitId, raisedFrom, raisedTo]);

  const exportParams = useMemo(
    () => ({
      status,
      priority,
      unitId: centralOrSuper ? unitId : undefined,
      raisedFrom,
      raisedTo,
    }),
    [status, priority, unitId, raisedFrom, raisedTo, centralOrSuper],
  );

  return (
    <div>
      <PageHeader
        title="Corrective actions report"
        description="Corrective actions by status, priority, and unit — with time-to-close metrics."
        actions={
          <ExportBar
            csvUrl={reportExportUrl('corrective-actions', 'csv', exportParams)}
            xlsxUrl={reportExportUrl('corrective-actions', 'xlsx', exportParams)}
          />
        }
      />

      <div className="print-hide mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {CA_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CA_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {CA_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {CA_PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
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
        <Input
          label="Raised from"
          type="date"
          value={raisedFrom}
          onChange={(e) => setRaisedFrom(e.target.value)}
        />
        <Input
          label="Raised to"
          type="date"
          value={raisedTo}
          onChange={(e) => setRaisedTo(e.target.value)}
        />
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data && (
        <ReportSummary
          items={[
            { label: 'Total', value: data.summary.total },
            { label: 'Open', value: data.summary.open, tone: 'red' },
            {
              label: 'In progress',
              value: data.summary.inProgress,
              tone: 'amber',
            },
            {
              label: 'Resolved',
              value: data.summary.resolved,
              tone: 'green',
            },
            { label: 'Closed', value: data.summary.closed, tone: 'slate' },
            {
              label: 'Overdue',
              value: data.summary.overdue,
              tone: data.summary.overdue ? 'red' : 'slate',
            },
            {
              label: 'Avg days to close',
              value: data.summary.avgDaysToClose,
              tone: 'blue',
            },
          ]}
        />
      )}

      {data === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState title="No corrective actions match" />
      ) : (
        <ReportTable
          headers={[
            'Code',
            'Unit',
            'Equipment',
            'Title',
            'Priority',
            'Status',
            'Assignee',
            'Raised',
            'Target',
            'Days open',
          ]}
        >
          {data.rows.map((r) => (
            <tr key={r.code} className="hover:bg-slate-50">
              <Td className="font-mono text-xs">
                <Link
                  to={`/corrective-actions?code=${encodeURIComponent(r.code)}`}
                  className="text-brand-700 hover:underline"
                >
                  {r.code}
                </Link>
              </Td>
              <Td className="font-mono text-xs">{r.unitCode}</Td>
              <Td>
                <span className="font-mono text-xs text-slate-500">
                  {r.equipmentCode}
                </span>{' '}
                {r.equipmentName}
              </Td>
              <Td className="font-medium text-slate-900">{r.title}</Td>
              <Td>
                <PriorityBadge priority={r.priority as never} />
              </Td>
              <Td>
                <StatusBadge status={r.status as never} />
              </Td>
              <Td>{r.assigneeName || '—'}</Td>
              <Td>{new Date(r.raisedAt).toLocaleDateString()}</Td>
              <Td>
                {r.targetDate
                  ? new Date(r.targetDate).toLocaleDateString()
                  : '—'}
              </Td>
              <Td>{r.daysOpen}</Td>
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
