import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  CA_PRIORITIES,
  CA_PRIORITY_LABELS,
  CA_STATUS_LABELS,
  CA_STATUSES,
  listCorrectiveActions,
  type CaPriority,
  type CaStatus,
  type CorrectiveActionListItem,
} from '../lib/apiCorrectiveActions';
import { listUnits, type Unit } from '../lib/apiUnits';
import { ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Select,
} from '../components/ui';

const PAGE_SIZE = 25;

export function CorrectiveActionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [rows, setRows] = useState<CorrectiveActionListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<CaStatus | ''>('');
  const [priority, setPriority] = useState<CaPriority | ''>('');
  const [unitId, setUnitId] = useState('');
  const [units, setUnits] = useState<Unit[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => setUnits([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      const res = await listCorrectiveActions({
        page,
        pageSize: PAGE_SIZE,
        status: (status || undefined) as CaStatus | undefined,
        priority: (priority || undefined) as CaPriority | undefined,
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
  }, [page, status, priority, unitId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Corrective Actions"
        description="Track failures to closure. New CAs are auto-created when a failed inspection question is configured for it."
      />

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
            setStatus(e.target.value as CaStatus | '');
          }}
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
          onChange={(e) => {
            setPage(1);
            setPriority(e.target.value as CaPriority | '');
          }}
        >
          <option value="">All priorities</option>
          {CA_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {CA_PRIORITY_LABELS[p]}
            </option>
          ))}
        </Select>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No corrective actions match" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <Th>Code</Th>
                <Th>Title</Th>
                <Th>Equipment</Th>
                <Th>Unit</Th>
                <Th>Priority</Th>
                <Th>Status</Th>
                <Th>Assignee</Th>
                <Th>Target date</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">
                    <Link
                      to={`/corrective-actions/${r.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.code}
                    </Link>
                  </Td>
                  <Td className="font-medium text-slate-900">{r.title}</Td>
                  <Td>
                    <span className="font-mono text-xs text-slate-500">
                      {r.equipment.equipmentCode}
                    </span>{' '}
                    {r.equipment.name}
                  </Td>
                  <Td className="font-mono text-xs">{r.unit.code}</Td>
                  <Td>
                    <PriorityBadge priority={r.priority} />
                  </Td>
                  <Td>
                    <StatusBadge status={r.status} />
                  </Td>
                  <Td>{r.assignee?.fullName ?? '—'}</Td>
                  <Td>
                    {r.targetDate
                      ? new Date(r.targetDate).toLocaleDateString()
                      : '—'}
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/corrective-actions/${r.id}`)}
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
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <p>
            Page {page} of {totalPages} — {total} corrective action
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

export function PriorityBadge({ priority }: { priority: CaPriority }) {
  const tone: 'red' | 'amber' | 'blue' | 'slate' =
    priority === 'CRITICAL'
      ? 'red'
      : priority === 'HIGH'
        ? 'amber'
        : priority === 'MEDIUM'
          ? 'blue'
          : 'slate';
  return <Badge tone={tone}>{CA_PRIORITY_LABELS[priority]}</Badge>;
}

export function StatusBadge({ status }: { status: CaStatus }) {
  const tone: 'red' | 'amber' | 'green' | 'slate' =
    status === 'OPEN'
      ? 'red'
      : status === 'IN_PROGRESS'
        ? 'amber'
        : status === 'RESOLVED'
          ? 'green'
          : 'slate';
  return <Badge tone={tone}>{CA_STATUS_LABELS[status]}</Badge>;
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
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
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
