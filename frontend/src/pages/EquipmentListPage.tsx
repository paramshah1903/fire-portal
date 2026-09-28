import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUSES,
  deleteEquipment,
  listEquipment,
  listEquipmentTypes,
  type Equipment,
  type EquipmentStatus,
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
import { EquipmentFormModal } from './EquipmentFormModal';

const PAGE_SIZE = 25;

function statusTone(status: EquipmentStatus): 'green' | 'amber' | 'red' | 'slate' {
  switch (status) {
    case 'ACTIVE':
      return 'green';
    case 'UNDER_MAINTENANCE':
      return 'amber';
    case 'OUT_OF_SERVICE':
      return 'red';
    case 'RETIRED':
      return 'slate';
  }
}

export function EquipmentListPage() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission(PERMS.EQUIPMENT_MANAGE);
  const isSuperAdmin = user?.roleKey === ROLES.SUPER_ADMIN;
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;
  const [busy, setBusy] = useState<string | null>(null);

  async function onDelete(e: Equipment) {
    if (
      !confirm(
        `Permanently delete "${e.equipmentCode} — ${e.name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(e.id);
    setError(null);
    try {
      await deleteEquipment(e.id);
      await reload();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setBusy(null);
    }
  }

  const [rows, setRows] = useState<Equipment[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [unitId, setUnitId] = useState('');
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [status, setStatus] = useState<EquipmentStatus | ''>('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [units, setUnits] = useState<Unit[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listUnits(true).then(setUnits).catch(() => undefined);
    listEquipmentTypes(true).then(setTypes).catch(() => undefined);
  }, []);

  async function reload() {
    setError(null);
    try {
      const res = await listEquipment({
        search: search || undefined,
        unitId: centralOrSuper ? unitId || undefined : undefined,
        equipmentTypeId: equipmentTypeId || undefined,
        status: (status || undefined) as EquipmentStatus | undefined,
        includeInactive,
        page,
        pageSize: PAGE_SIZE,
      });
      setRows(res.rows);
      setTotal(res.total);
    } catch (err) {
      setError(toApiError(err).message);
      setRows([]);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, unitId, equipmentTypeId, status, includeInactive]);

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Fire safety equipment master. Each item has a unique code and QR value."
        actions={
          canManage && (
            <>
              <Button variant="secondary" onClick={() => navigate('/equipment/import')}>
                Bulk import
              </Button>
              <Button onClick={() => setCreating(true)}>New equipment</Button>
            </>
          )
        }
      />

      <form
        onSubmit={onSubmitSearch}
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Input
          label="Search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Code, name, QR, serial…"
        />
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
          label="Type"
          value={equipmentTypeId}
          onChange={(e) => {
            setPage(1);
            setEquipmentTypeId(e.target.value);
          }}
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
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as EquipmentStatus | '');
          }}
        >
          <option value="">All statuses</option>
          {EQUIPMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {EQUIPMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <div className="flex flex-col justify-end gap-2">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => {
                setPage(1);
                setIncludeInactive(e.target.checked);
              }}
            />
            Include inactive
          </label>
          <Button variant="secondary" type="submit">
            Apply search
          </Button>
        </div>
      </form>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading equipment…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No equipment matches"
          description="Try clearing filters or search terms."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Type</Th>
                <Th>Unit</Th>
                <Th>Location</Th>
                <Th>Status</Th>
                <Th>Active</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Td className="font-mono text-xs">
                    <Link
                      to={`/equipment/${r.id}`}
                      className="text-brand-700 hover:underline"
                    >
                      {r.equipmentCode}
                    </Link>
                  </Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">{r.name}</Td>
                  <Td>{r.equipmentType.name}</Td>
                  <Td className="font-mono text-xs">{r.unit.code}</Td>
                  <Td className="text-slate-600 dark:text-slate-400">
                    {[r.building, r.floor, r.location]
                      .filter(Boolean)
                      .join(' · ') || '—'}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(r.status)}>
                      {EQUIPMENT_STATUS_LABELS[r.status]}
                    </Badge>
                  </Td>
                  <Td>
                    {r.isActive ? (
                      <Badge tone="green">Yes</Badge>
                    ) : (
                      <Badge tone="slate">No</Badge>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <Button
                      variant="secondary"
                      onClick={() => navigate(`/equipment/${r.id}`)}
                    >
                      Open
                    </Button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        disabled={busy === r.id}
                        onClick={() => void onDelete(r)}
                        className="ml-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 shadow-sm hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/40"
                        title="Only allowed if no inspection or CA references this equipment."
                      >
                        {busy === r.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
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
            Page {page} of {totalPages} — {total} equipment record
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

      <EquipmentFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(created) => {
          setCreating(false);
          if (created) navigate(`/equipment/${created.id}`);
          else void reload();
        }}
      />
    </div>
  );
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 dark:text-slate-300 ${className}`}>{children}</td>;
}
