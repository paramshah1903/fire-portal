import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createDepartment,
  listDepartments,
  listUnits,
  updateDepartment,
  type Department,
  type DepartmentInput,
  type Unit,
} from '../lib/apiUnits';
import { PERMS } from '../lib/permissions';
import {
  Badge,
  Button,
  EmptyState,
  ErrorBanner,
  Input,
  PageHeader,
  Select,
  TextArea,
} from '../components/ui';
import { Modal } from '../components/Modal';

export function DepartmentsPage() {
  const { hasPermission, user } = useAuth();
  const canManage = hasPermission(PERMS.DEPARTMENT_MANAGE);

  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [rows, setRows] = useState<Department[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  useEffect(() => {
    listUnits(true)
      .then(setUnits)
      .catch((err) => setError(toApiError(err).message));
  }, []);

  useEffect(() => {
    if (user?.unitId && !selectedUnitId) setSelectedUnitId(user.unitId);
  }, [user?.unitId, selectedUnitId]);

  const effectiveUnitId = useMemo(
    () => selectedUnitId || undefined,
    [selectedUnitId],
  );

  async function reload() {
    setError(null);
    try {
      setRows(await listDepartments(effectiveUnitId, includeInactive));
    } catch (err) {
      setError(toApiError(err).message);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUnitId, includeInactive]);

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Departments within each unit. Users can belong to a specific department."
        actions={
          canManage && (
            <Button onClick={() => setCreating(true)}>New department</Button>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Select
            label="Unit"
            value={selectedUnitId}
            onChange={(e) => setSelectedUnitId(e.target.value)}
          >
            <option value="">All units</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.code} — {u.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="mb-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading departments…</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="No departments"
          description="Choose a unit or create a new department to get started."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <Th>Unit</Th>
                <Th>Code</Th>
                <Th>Name</Th>
                <Th>Users</Th>
                <Th>Status</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {rows.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                  <Td className="font-mono text-xs">{d.unit?.code ?? '—'}</Td>
                  <Td className="font-mono text-xs">{d.code}</Td>
                  <Td className="font-medium text-slate-900 dark:text-slate-100">{d.name}</Td>
                  <Td>{d._count?.users ?? 0}</Td>
                  <Td>
                    {d.isActive ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="slate">Inactive</Badge>
                    )}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <Button variant="secondary" onClick={() => setEditing(d)}>
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

      <DepartmentFormModal
        open={creating}
        units={units}
        defaultUnitId={selectedUnitId}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void reload();
        }}
      />
      <DepartmentFormModal
        open={!!editing}
        department={editing}
        units={units}
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
  unitId: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
}

function DepartmentFormModal({
  open,
  department,
  units,
  defaultUnitId,
  onClose,
  onSaved,
}: {
  open: boolean;
  department?: Department | null;
  units: Unit[];
  defaultUnitId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    unitId: '',
    code: '',
    name: '',
    description: '',
    isActive: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (department) {
      setForm({
        unitId: department.unitId,
        code: department.code,
        name: department.name,
        description: department.description ?? '',
        isActive: department.isActive,
      });
    } else {
      setForm({
        unitId: defaultUnitId ?? '',
        code: '',
        name: '',
        description: '',
        isActive: true,
      });
    }
  }, [open, department, defaultUnitId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: DepartmentInput = {
        unitId: form.unitId,
        code: form.code,
        name: form.name,
        description: form.description || null,
        isActive: form.isActive,
      };
      if (department) {
        await updateDepartment(department.id, payload);
      } else {
        await createDepartment(payload);
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
      title={department ? `Edit department ${department.code}` : 'New department'}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="department-form" disabled={submitting}>
            {submitting ? 'Saving…' : department ? 'Save changes' : 'Create department'}
          </Button>
        </>
      }
    >
      <form id="department-form" onSubmit={onSubmit} className="space-y-3">
        <Select
          label="Unit"
          name="unitId"
          required
          value={form.unitId}
          onChange={(e) => setForm({ ...form, unitId: e.target.value })}
        >
          <option value="">Select a unit…</option>
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.code} — {u.name}
            </option>
          ))}
        </Select>
        <Input
          label="Code"
          name="code"
          required
          maxLength={32}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value })}
        />
        <Input
          label="Name"
          name="name"
          required
          maxLength={120}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
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
