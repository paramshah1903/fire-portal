import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createUnit,
  listUnits,
  updateUnit,
  type Unit,
  type UnitInput,
} from '../lib/apiUnits';
import { PERMS } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';

export function UnitsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.UNIT_MANAGE);

  const [units, setUnits] = useState<Unit[] | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Unit | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setError(null);
    try {
      setUnits(await listUnits(includeInactive));
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  return (
    <div>
      <PageHeader
        title="Units"
        description="Manufacturing units. Each unit contains departments, users and equipment."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Show inactive
            </label>
            {canManage && (
              <Button onClick={() => setCreating(true)}>New unit</Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {units === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading units…</p>
      ) : units.length === 0 ? (
        <EmptyState
          title="No units found"
          description={
            includeInactive
              ? 'There are no units in the system yet.'
              : 'There are no active units. Toggle "Show inactive" or create one.'
          }
          action={
            canManage ? (
              <Button onClick={() => setCreating(true)}>Create the first unit</Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Location</Th>
                <Th>Departments</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Td className="font-mono text-xs">{u.code}</Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">{u.name}</Td>
                  <Td>{u.location ?? '—'}</Td>
                  <Td>{u._count?.departments ?? 0}</Td>
                  <Td>{u._count?.users ?? 0}</Td>
                  <Td>
                    {u.isActive ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="slate">Inactive</Badge>
                    )}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <Button variant="secondary" onClick={() => setEditing(u)}>
                        Edit
                      </Button>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <UnitFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void reload();
        }}
      />
      <UnitFormModal
        open={!!editing}
        unit={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void reload();
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

interface FormState {
  code: string;
  name: string;
  location: string;
  description: string;
  isActive: boolean;
}

function UnitFormModal({
  open,
  unit,
  onClose,
  onSaved,
}: {
  open: boolean;
  unit?: Unit | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    location: '',
    description: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (unit) {
      setForm({
        code: unit.code,
        name: unit.name,
        location: unit.location ?? '',
        description: unit.description ?? '',
        isActive: unit.isActive,
      });
    } else {
      setForm({
        code: '',
        name: '',
        location: '',
        description: '',
        isActive: true,
      });
    }
  }, [open, unit]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: UnitInput = {
        code: form.code,
        name: form.name,
        location: form.location || null,
        description: form.description || null,
        isActive: form.isActive,
      };
      if (unit) {
        await updateUnit(unit.id, payload);
      } else {
        await createUnit(payload);
      }
      onSaved();
    } catch (err) {
      setError(toApiError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={unit ? `Edit unit ${unit.code}` : 'New unit'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="unit-form" disabled={submitting}>
            {submitting ? 'Saving…' : unit ? 'Save changes' : 'Create unit'}
          </Button>
        </>
      }
    >
      <form id="unit-form" onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Code"
          name="code"
          required
          maxLength={32}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
          hint="Short code, e.g. UNIT-A. Uppercased automatically."
        />
        <Input
          label="Name"
          name="name"
          required
          maxLength={120}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          label="Location"
          name="location"
          maxLength={200}
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
        />
        <TextArea
          label="Description"
          name="description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Active
        </label>
        {error && <ErrorBanner message={error} />}
      </form>
    </Modal>
  );
}
