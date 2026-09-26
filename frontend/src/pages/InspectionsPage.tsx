import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  listInspections,
  listSchedule,
  startInspection,
  type InspectionListItem,
  type ScheduleResponse,
  type ScheduleStatus,
} from '../lib/apiInspections';
import {
  listEquipmentTypes,
  type EquipmentType,
} from '../lib/apiEquipment';
import { listUnits, type Unit } from '../lib/apiUnits';
import { PERMS, ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../components/ui';

type Tab = 'schedule' | 'history';

export function InspectionsPage() {
  const { hasPermission, user } = useAuth();
  const canPerform = hasPermission(PERMS.INSPECTION_PERFORM);
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [tab, setTab] = useState<Tab>('schedule');
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  useEffect(() => {
    listEquipmentTypes(true).then(setTypes).catch(() => setTypes([]));
    listUnits(true).then(setUnits).catch(() => setUnits([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Inspections"
        description="Monthly inspection schedule and history."
      />

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabButton active={tab === 'schedule'} onClick={() => setTab('schedule')}>
          Monthly schedule
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          All inspections
        </TabButton>
      </div>

      {tab === 'schedule' ? (
        <SchedulePanel
          canPerform={canPerform}
          units={units}
          types={types}
          centralOrSuper={centralOrSuper}
        />
      ) : (
        <HistoryPanel
          units={units}
          types={types}
          centralOrSuper={centralOrSuper}
        />
      )}
    </div>
  );
}

// =============================================================================
// Monthly schedule
// =============================================================================

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function SchedulePanel({
  canPerform,
  units,
  types,
  centralOrSuper,
}: {
  canPerform: boolean;
  units: Unit[];
  types: EquipmentType[];
  centralOrSuper: boolean;
}) {
  const navigate = useNavigate();
  const [periodKey, setPeriodKey] = useState<string>(currentPeriodKey());
  const [unitId, setUnitId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState<ScheduleStatus | ''>('');
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const res = await listSchedule({
        periodKey,
        unitId: centralOrSuper ? unitId || undefined : undefined,
        equipmentTypeId: typeId || undefined,
        monthlyStatus: (status || undefined) as ScheduleStatus | undefined,
      });
      setData(res);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey, unitId, typeId, status]);

  async function onStartOrOpen(row: ScheduleResponse['rows'][number]) {
    // If completed or in-progress, go straight to detail/perform.
    if (row.inspection) {
      if (row.inspection.status === 'COMPLETED') {
        navigate(`/inspections/${row.inspection.id}`);
      } else {
        navigate(`/inspections/${row.inspection.id}/perform`);
      }
      return;
    }
    if (!canPerform) return;

    setStarting(row.equipment.id);
    setError(null);
    try {
      const insp = await startInspection(row.equipment.id);
      navigate(`/inspections/${insp.id}/perform`);
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setStarting(null);
    }
  }

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input
          label="Period"
          type="month"
          value={periodKey}
          onChange={(e) => setPeriodKey(e.target.value)}
          hint="YYYY-MM"
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
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
        >
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ScheduleStatus | '')}
        >
          <option value="">All statuses</option>
          <option value="DUE">Due</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="OVERDUE">Overdue</option>
        </Select>
      </div>

      {data && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <SummaryPill tone="slate" label="Due" value={data.summary.DUE} />
          <SummaryPill
            tone="amber"
            label="In progress"
            value={data.summary.IN_PROGRESS}
          />
          <SummaryPill
            tone="green"
            label="Completed"
            value={data.summary.COMPLETED}
          />
          <SummaryPill tone="red" label="Overdue" value={data.summary.OVERDUE} />
        </div>
      )}

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {data === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading schedule…</p>
      ) : data.rows.length === 0 ? (
        <EmptyState title="Nothing to show for this filter" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Unit</Th>
                <Th>Status</Th>
                <Th>Result</Th>
                <Th>Inspector</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {data.rows.map((r) => (
                <tr key={r.equipment.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Td className="font-mono text-xs">
                    <Link
                      to={`/equipment/${r.equipment.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.equipment.equipmentCode}
                    </Link>
                  </Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">{r.equipment.name}</Td>
                  <Td>{r.equipment.equipmentType.name}</Td>
                  <Td className="font-mono text-xs">{r.equipment.unit.code}</Td>
                  <Td>
                    <ScheduleStatusBadge status={r.monthlyStatus} />
                  </Td>
                  <Td>
                    {r.inspection?.result ? (
                      <Badge
                        tone={
                          r.inspection.hasSafetyCriticalFailure
                            ? 'red'
                            : r.inspection.result === 'FAIL'
                              ? 'amber'
                              : 'green'
                        }
                      >
                        {r.inspection.result}
                        {r.inspection.hasSafetyCriticalFailure ? ' · SC' : ''}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td>{r.inspection?.inspector?.fullName ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button
                      variant={r.monthlyStatus === 'COMPLETED' ? 'secondary' : 'primary'}
                      onClick={() => onStartOrOpen(r)}
                      disabled={
                        starting === r.equipment.id ||
                        (!canPerform && !r.inspection)
                      }
                    >
                      {starting === r.equipment.id
                        ? 'Starting…'
                        : r.monthlyStatus === 'COMPLETED'
                          ? 'View'
                          : r.monthlyStatus === 'IN_PROGRESS'
                            ? 'Resume'
                            : canPerform
                              ? 'Start'
                              : 'View'}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// History (all inspections)
// =============================================================================

const PAGE_SIZE = 25;

function HistoryPanel({
  units,
  types: _types,
  centralOrSuper,
}: {
  units: Unit[];
  types: EquipmentType[];
  centralOrSuper: boolean;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InspectionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'PENDING' | 'COMPLETED' | ''>('');
  const [result, setResult] = useState<'PASS' | 'FAIL' | ''>('');
  const [unitId, setUnitId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setError(null);
    try {
      const res = await listInspections({
        page,
        pageSize: PAGE_SIZE,
        status: (status || undefined) as 'PENDING' | 'COMPLETED' | undefined,
        result: (result || undefined) as 'PASS' | 'FAIL' | undefined,
        unitId: centralOrSuper ? unitId || undefined : undefined,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, status, result, unitId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {centralOrSuper && (
          <Select
            label="Unit"
            value={unitId}
            onChange={(e) => {
              setPage(1);
              setUnitId(e.target.value);
            }}
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
          label="Status"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as 'PENDING' | 'COMPLETED' | '');
          }}
        >
          <option value="">All statuses</option>
          <option value="PENDING">In progress</option>
          <option value="COMPLETED">Completed</option>
        </Select>
        <Select
          label="Result"
          value={result}
          onChange={(e) => {
            setPage(1);
            setResult(e.target.value as 'PASS' | 'FAIL' | '');
          }}
        >
          <option value="">All results</option>
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
        </Select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No inspections match" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Inspection #</Th>
                <Th>Period</Th>
                <Th>Equipment</Th>
                <Th>Unit</Th>
                <Th>Inspector</Th>
                <Th>Status</Th>
                <Th>Result</Th>
                <Th>Completed</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Td className="font-mono text-xs">
                    {r.inspectionNumber ?? (
                      <span className="text-slate-400">—</span>
                    )}
                  </Td>
                  <Td className="font-mono text-xs">{r.periodKey}</Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">
                    <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {r.equipment.equipmentCode}
                    </span>{' '}
                    {r.equipment.name}
                  </Td>
                  <Td className="font-mono text-xs">{r.unit.code}</Td>
                  <Td>{r.inspector.fullName}</Td>
                  <Td>
                    <Badge tone={r.status === 'COMPLETED' ? 'green' : 'amber'}>
                      {r.status === 'COMPLETED' ? 'Completed' : 'In progress'}
                    </Badge>
                  </Td>
                  <Td>
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
                  <Td>
                    {r.completedAt
                      ? new Date(r.completedAt).toLocaleString()
                      : '—'}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        navigate(
                          r.status === 'COMPLETED'
                            ? `/inspections/${r.id}`
                            : `/inspections/${r.id}/perform`,
                        )
                      }
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <p>
            Page {page} of {totalPages} — {total} inspection
            {total === 1 ? '' : 's'}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// helpers
// =============================================================================

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
        active
          ? 'border-brand-600 text-brand-800'
          : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900'
      }`}
    >
      {children}
    </button>
  );
}

function SummaryPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'amber' | 'green' | 'red';
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5">
      <Badge tone={tone}>{value}</Badge>
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
    </div>
  );
}

function ScheduleStatusBadge({ status }: { status: ScheduleStatus }) {
  const tone: 'slate' | 'amber' | 'green' | 'red' =
    status === 'COMPLETED'
      ? 'green'
      : status === 'OVERDUE'
        ? 'red'
        : status === 'IN_PROGRESS'
          ? 'amber'
          : 'slate';
  const label =
    status === 'DUE'
      ? 'Due'
      : status === 'IN_PROGRESS'
        ? 'In progress'
        : status === 'COMPLETED'
          ? 'Completed'
          : 'Overdue';
  return <Badge tone={tone}>{label}</Badge>;
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
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
