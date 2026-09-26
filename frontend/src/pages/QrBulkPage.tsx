import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  EQUIPMENT_STATUS_LABELS,
  EQUIPMENT_STATUSES,
  listEquipment,
  listEquipmentTypes,
  type Equipment,
  type EquipmentStatus,
  type EquipmentType,
} from '../lib/apiEquipment';
import { listUnits, type Unit } from '../lib/apiUnits';
import { ROLES } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
} from '../components/ui';
import { QrLabel } from '../components/QrLabel';

const PAGE_SIZE = 100;

type Mode = 'select' | 'preview';

export function QrBulkPage() {
  const { user } = useAuth();
  const centralOrSuper =
    user?.roleKey === ROLES.SUPER_ADMIN || user?.roleKey === ROLES.CENTRAL_ADMIN;

  const [mode, setMode] = useState<Mode>('select');
  const [rows, setRows] = useState<Equipment[] | null>(null);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [unitId, setUnitId] = useState('');
  const [equipmentTypeId, setEquipmentTypeId] = useState('');
  const [status, setStatus] = useState<EquipmentStatus | ''>('');
  const [selected, setSelected] = useState<Record<string, Equipment>>({});
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [labelSize, setLabelSize] = useState<'sm' | 'md' | 'lg'>('md');

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
        page: 1,
        pageSize: PAGE_SIZE,
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
  }, [search, unitId, equipmentTypeId, status]);

  function toggle(eq: Equipment) {
    setSelected((cur) => {
      const next = { ...cur };
      if (next[eq.id]) delete next[eq.id];
      else next[eq.id] = eq;
      return next;
    });
  }

  function selectAllVisible() {
    if (!rows) return;
    const next = { ...selected };
    for (const eq of rows) next[eq.id] = eq;
    setSelected(next);
  }
  function clearAll() {
    setSelected({});
  }

  const selectedList = useMemo(
    () => Object.values(selected).sort((a, b) =>
      a.equipmentCode.localeCompare(b.equipmentCode),
    ),
    [selected],
  );

  return (
    <div>
      <PageHeader
        title="Bulk QR labels"
        description="Select multiple equipment items and print their labels as one sheet."
        actions={
          <div className="print-hide flex flex-wrap gap-2">
            {mode === 'select' ? (
              <>
                <Button variant="secondary" onClick={clearAll} disabled={selectedList.length === 0}>
                  Clear selection ({selectedList.length})
                </Button>
                <Button
                  disabled={selectedList.length === 0}
                  onClick={() => setMode('preview')}
                >
                  Preview {selectedList.length} label{selectedList.length === 1 ? '' : 's'}
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => setMode('select')}>
                  Back to selection
                </Button>
                <Button onClick={() => window.print()}>Print</Button>
              </>
            )}
          </div>
        }
      />

      {error && (
        <div className="mb-4 print-hide">
          <ErrorBanner message={error} />
        </div>
      )}

      {mode === 'select' && (
        <>
          <form
            className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(searchInput.trim());
            }}
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
              label="Type"
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
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as EquipmentStatus | '')}
            >
              <option value="">All statuses</option>
              {EQUIPMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {EQUIPMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
            <div className="flex items-end">
              <Button type="submit" variant="secondary">
                Apply search
              </Button>
            </div>
          </form>

          <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
            <p>
              {rows === null
                ? 'Loading…'
                : `Showing ${rows.length} of ${total} equipment${total > PAGE_SIZE ? ` (first ${PAGE_SIZE})` : ''}`}
            </p>
            <Button variant="secondary" onClick={selectAllVisible}>
              Select all visible
            </Button>
          </div>

          {rows && rows.length === 0 ? (
            <EmptyState title="No equipment matches your filters" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th className="w-8">&nbsp;</Th>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>Type</Th>
                    <Th>Unit</Th>
                    <Th>Location</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows?.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => toggle(r)}
                      className={`cursor-pointer hover:bg-slate-50 ${
                        selected[r.id] ? 'bg-brand-50/70' : ''
                      }`}
                    >
                      <Td>
                        <input
                          type="checkbox"
                          checked={!!selected[r.id]}
                          onChange={() => toggle(r)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Td>
                      <Td className="font-mono text-xs">{r.equipmentCode}</Td>
                      <Td className="font-medium text-slate-900">{r.name}</Td>
                      <Td>{r.equipmentType.name}</Td>
                      <Td className="font-mono text-xs">{r.unit.code}</Td>
                      <Td className="text-slate-600">
                        {[r.building, r.floor, r.location].filter(Boolean).join(' · ') || '—'}
                      </Td>
                      <Td>
                        <Badge tone={r.status === 'ACTIVE' ? 'green' : 'slate'}>
                          {EQUIPMENT_STATUS_LABELS[r.status]}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {mode === 'preview' && (
        <>
          <div className="print-hide mb-4 flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-700">
              {selectedList.length} label{selectedList.length === 1 ? '' : 's'} ready
              to print.
            </p>
            <Select
              label="Label size"
              value={labelSize}
              onChange={(e) =>
                setLabelSize(e.target.value as 'sm' | 'md' | 'lg')
              }
              className="max-w-[9rem]"
            >
              <option value="sm">Small (55mm)</option>
              <option value="md">Medium (70mm)</option>
              <option value="lg">Large (90mm)</option>
            </Select>
          </div>

          <div className="rounded-lg bg-white p-4 print:bg-white print:p-0">
            <div className="flex flex-wrap gap-3">
              {selectedList.map((eq) => (
                <QrLabel key={eq.id} equipment={eq} size={labelSize} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
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
