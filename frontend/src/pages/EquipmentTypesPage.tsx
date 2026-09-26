import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { toApiError } from '../lib/api';
import {
  createEquipmentType,
  listEquipmentTypes,
  updateEquipmentType,
  type EquipmentType,
  type EquipmentTypeInput,
} from '../lib/apiEquipment';
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

export function EquipmentTypesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission(PERMS.EQUIPMENT_MANAGE);

  const [rows, setRows] = useState<EquipmentType[] | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EquipmentType | null>(null);

  async function reload() {
    setError(null);
    try {
      setRows(await listEquipmentTypes(includeInactive));
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
        title="Equipment Types"
        description="Configurable equipment classifications used by the equipment master and checklist templates."
        actions={
          <>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
              />
              Show inactive
            </label>
            {canManage && (
              <Button onClick={() => setCreating(true)}>New type</Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} />
        </div>
      )}

      {rows === null ? (
        <p className="text-sm text-slate-500">Loading equipment types…</p>
      ) : rows.length === 0 ? (
        <EmptyState title="No equipment types" />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <Th>Key</Th>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Frequency</Th>
                <Th>Equipment</Th>
                <Th>Status</Th>
                {canManage && <Th className="text-right">Actions</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <Td className="font-mono text-xs">{t.key}</Td>
                  <Td className="font-medium text-slate-900">{t.name}</Td>
                  <Td className="text-slate-600">{t.description ?? '—'}</Td>
                  <Td>{t.inspectionFrequencyDays} days</Td>
                  <Td>{t._count?.equipment ?? 0}</Td>
                  <Td>
                    {t.isActive ? (
                      <Badge tone="green">Active</Badge>
                    ) : (
                      <Badge tone="slate">Inactive</Badge>
                    )}
                  </Td>
                  {canManage && (
                    <Td className="text-right">
                      <Button variant="secondary" onClick={() => setEditing(t)}>
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

      <TypeFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          void reload();
        }}
      />
      <TypeFormModal
        open={!!editing}
        type={editing}
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
      className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${className}`}
      scope="col"
    >
      {children}
    </th>
  );
}
function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2 text-sm text-slate-700 ${className}`}>{children}</td>;
}

interface FormState {
  key: string;
  name: string;
  description: string;
  inspectionFrequencyDays: number;
  isActive: boolean;
}

function TypeFormModal({
  open,
  type,
  onClose,
  onSaved,
}: {
  open: boolean;
  type?: EquipmentType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    key: '',
    name: '',
    description: '',
    inspectionFrequencyDays: 30,
    isActive: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (type) {
      setForm({
        key: type.key,
        name: type.name,
        description: type.description ?? '',
        inspectionFrequencyDays: type.inspectionFrequencyDays,
        isActive: type.isActive,
      });
    } else {
      setForm({
        key: '',
        name: '',
        description: '',
        inspectionFrequencyDays: 30,
        isActive: true,
      });
    }
  }, [open, type]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: EquipmentTypeInput = {
        key: form.key,
        name: form.name,
        description: form.description || null,
        inspectionFrequencyDays: form.inspectionFrequencyDays,
        isActive: form.isActive,
      };
      if (type) await updateEquipmentType(type.id, payload);
      else await createEquipmentType(payload);
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
      title={type ? `Edit type ${type.key}` : 'New equipment type'}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="eqtype-form" disabled={submitting}>
            {submitting ? 'Saving…' : type ? 'Save changes' : 'Create type'}
          </Button>
        </>
      }
    >
      <form id="eqtype-form" onSubmit={onSubmit} className="space-y-3">
        <Input
          label="Key"
          name="key"
          required
          maxLength={64}
          value={form.key}
          onChange={(e) => setForm({ ...form, key: e.target.value })}
          hint='Uppercased with underscores automatically, e.g. "FIRE_EXTINGUISHER".'
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
        <Input
          label="Inspection frequency (days)"
          name="inspectionFrequencyDays"
          type="number"
          min={1}
          max={3650}
          required
          value={form.inspectionFrequencyDays}
          onChange={(e) =>
            setForm({
              ...form,
              inspectionFrequencyDays: Number.parseInt(e.target.value, 10) || 30,
            })
          }
          hint="30 = monthly. Used from Phase 5 to compute due dates."
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
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
