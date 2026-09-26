import { useEffect, useState } from 'react';
import { toApiError } from '../lib/api';
import {
  listAuditActions,
  listAuditEntityTypes,
  listAuditLogs,
  type AuditLogRow,
} from '../lib/apiAuditLogs';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../components/ui';

const PAGE_SIZE = 50;

export function AuditLogsPage() {
  const [rows, setRows] = useState<AuditLogRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    listAuditActions().then(setActions).catch(() => setActions([]));
    listAuditEntityTypes().then(setEntityTypes).catch(() => setEntityTypes([]));
  }, []);

  async function reload() {
    setError(null);
    try {
      const res = await listAuditLogs({
        page,
        pageSize: PAGE_SIZE,
        action: action || undefined,
        entityType: entityType || undefined,
        search: search || undefined,
        fromDate: fromDate ? new Date(fromDate).toISOString() : undefined,
        toDate: toDate
          ? new Date(toDate + 'T23:59:59.999').toISOString()
          : undefined,
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
  }, [page, action, entityType, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Audit logs"
        description="Every sensitive action recorded by the system. Read-only, immutable."
      />

      <form
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
      >
        <Select
          label="Action"
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
        <Select
          label="Entity type"
          value={entityType}
          onChange={(e) => {
            setPage(1);
            setEntityType(e.target.value);
          }}
        >
          <option value="">All entities</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Input
          label="From"
          type="date"
          value={fromDate}
          onChange={(e) => {
            setPage(1);
            setFromDate(e.target.value);
          }}
        />
        <Input
          label="To"
          type="date"
          value={toDate}
          onChange={(e) => {
            setPage(1);
            setToDate(e.target.value);
          }}
        />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Action, entity id, metadata…"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
      </form>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No audit records match" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Entity ID</Th>
                <Th className="text-right">&nbsp;</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((r) => (
                <RowGroup
                  key={r.id}
                  row={r}
                  open={expanded[r.id] ?? false}
                  onToggle={() =>
                    setExpanded((cur) => ({ ...cur, [r.id]: !cur[r.id] }))
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows !== null && total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
          <p>
            Page {page} of {totalPages} — {total} record{total === 1 ? '' : 's'}
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

function RowGroup({
  row,
  open,
  onToggle,
}: {
  row: AuditLogRow;
  open: boolean;
  onToggle: () => void;
}) {
  const meta = safeParseJson(row.metadata);
  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800">
        <Td className="whitespace-nowrap text-xs text-slate-600 dark:text-slate-400">
          {new Date(row.createdAt).toLocaleString()}
        </Td>
        <Td>
          {row.actor ? (
            <span className="text-slate-800 dark:text-slate-200">
              {row.actor.fullName}{' '}
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                ({row.actor.username})
              </span>
            </span>
          ) : (
            <span className="text-xs text-slate-500 dark:text-slate-400">— system —</span>
          )}
        </Td>
        <Td>
          <ActionBadge action={row.action} />
        </Td>
        <Td>{row.entityType ?? '—'}</Td>
        <Td className="font-mono text-xs">{row.entityId ?? '—'}</Td>
        <Td className="whitespace-nowrap text-right">
          {row.metadata && (
            <Button variant="ghost" onClick={onToggle}>
              {open ? 'Hide details' : 'Show details'}
            </Button>
          )}
        </Td>
      </tr>
      {open && row.metadata && (
        <tr className="bg-slate-50 dark:bg-slate-800">
          <td colSpan={6} className="px-3 py-2">
            <pre className="max-h-64 overflow-auto rounded bg-slate-900 px-3 py-2 font-mono text-xs text-slate-100">
              {meta ? JSON.stringify(meta, null, 2) : row.metadata}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBadge({ action }: { action: string }) {
  const tone: 'green' | 'amber' | 'red' | 'blue' | 'slate' = action.includes(
    'failure',
  )
    ? 'red'
    : action.includes('deactivate') || action.includes('close')
      ? 'slate'
      : action.startsWith('auth.')
        ? 'blue'
        : action.includes('publish') ||
            action.includes('submit') ||
            action.includes('create')
          ? 'green'
          : 'amber';
  return (
    <Badge tone={tone}>
      <span className="font-mono text-xs">{action}</span>
    </Badge>
  );
}

function safeParseJson(v: string | null): unknown {
  if (!v) return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
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
      className={`whitespace-nowrap px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
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
